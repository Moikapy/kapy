/**
 * Grimoire search — hybrid search over markdown wiki pages.
 *
 * MVP: filename + content substring matching with simple scoring.
 * No embeddings required. The index.md file is primary navigation.
 * At scale (~500+ pages), upgrade to BM25 or qmd.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { PageMeta, SearchResult } from "./types.js";

/** Extract a search query from a user message */
export function extractQuery(content: string): string {
	// Strip common prefixes, keep the core question
	let query = content
		.replace(/^(how do i|how|what is|what|why|when|where|who|which|can you|tell me|show me|explain|describe)\s+/i, "")
		.replace(/[?.!]+$/, "")
		.trim();

	// Truncate to reasonable length
	if (query.length > 200) {
		query = query.slice(0, 200);
	}

	return query;
}

/** Simple tokenization: lowercase, split on non-alphanumeric */
function tokenize(text: string): string[] {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, " ")
		.split(/\s+/)
		.filter((t) => t.length > 1);
}

/** Calculate term frequency score for a document given query terms */
function termFrequencyScore(docTokens: string[], queryTokens: string[]): number {
	if (queryTokens.length === 0 || docTokens.length === 0) return 0;

	const docFreq = new Map<string, number>();
	for (const t of docTokens) {
		docFreq.set(t, (docFreq.get(t) ?? 0) + 1);
	}

	let score = 0;
	let matched = 0;
	for (const qt of queryTokens) {
		const freq = docFreq.get(qt) ?? 0;
		if (freq > 0) {
			matched++;
			// TF weighting: more occurrences = higher score, diminishing returns
			score += 1 + Math.log(freq + 1);
		}
	}

	// Coverage bonus: how many query terms matched
	const coverage = matched / queryTokens.length;
	return score * coverage;
}

/** Find best snippet around a match in content */
function findSnippet(content: string, queryTokens: string[], maxLen = 200): string {
	const _lower = content.toLowerCase();
	const lines = content.split("\n");

	// Find the line with the most query term matches
	let bestLine = 0;
	let bestScore = 0;

	for (let i = 0; i < lines.length; i++) {
		const lineTokens = tokenize(lines[i]);
		const score = termFrequencyScore(lineTokens, queryTokens);
		if (score > bestScore) {
			bestScore = score;
			bestLine = i;
		}
	}

	// Extract snippet around best line
	const start = Math.max(0, bestLine - 1);
	const end = Math.min(lines.length, bestLine + 3);
	let snippet = lines.slice(start, end).join("\n").trim();

	if (snippet.length > maxLen) {
		snippet = `${snippet.slice(0, maxLen - 3)}...`;
	}

	return snippet || lines[0]?.slice(0, maxLen) || "";
}

/** Search across wiki pages by content and metadata */
export async function searchPages(
	rootDir: string,
	pages: PageMeta[],
	query: string,
	topK = 5,
): Promise<SearchResult[]> {
	const queryTokens = tokenize(query);
	if (queryTokens.length === 0) return [];

	const results: SearchResult[] = [];

	for (const page of pages) {
		let score = 0;
		const matchedFields: SearchResult["matchedFields"] = [];

		// 1. Path match (highest weight — file name is strong signal)
		const pathTokens = tokenize(page.path);
		const pathScore = termFrequencyScore(pathTokens, queryTokens) * 2;
		if (pathScore > 0) {
			score += pathScore;
			matchedFields.push("path");
		}

		// 2. Title/summary match
		if (page.summary) {
			const summaryTokens = tokenize(page.summary);
			const summaryScore = termFrequencyScore(summaryTokens, queryTokens) * 1.5;
			if (summaryScore > 0) {
				score += summaryScore;
				matchedFields.push("title");
			}
		}

		// 3. Tags match
		if (page.tags && page.tags.length > 0) {
			const tagTokens = tokenize(page.tags.join(" "));
			const tagScore = termFrequencyScore(tagTokens, queryTokens) * 1.5;
			if (tagScore > 0) {
				score += tagScore;
				matchedFields.push("tags");
			}
		}

		// 4. Content match (read file, score)
		try {
			const content = await readFile(join(rootDir, page.path), "utf-8");
			const contentTokens = tokenize(content);
			const contentScore = termFrequencyScore(contentTokens, queryTokens);
			if (contentScore > 0) {
				score += contentScore;
				matchedFields.push("content");
			}

			if (score > 0) {
				results.push({
					path: page.path,
					score: Math.min(1, score / (queryTokens.length * 3)), // normalize to 0-1
					snippet: matchedFields.includes("content") ? findSnippet(content, queryTokens) : page.summary || "",
					matchedFields,
				});
			}
		} catch {
			// Can't read file, skip content scoring
			if (score > 0) {
				results.push({
					path: page.path,
					score: Math.min(1, score / (queryTokens.length * 3)),
					snippet: page.summary || "",
					matchedFields,
				});
			}
		}
	}

	// Sort by score descending, take top K
	results.sort((a, b) => b.score - a.score);
	return results.slice(0, topK);
}

/** Search just the index.md for quick navigation (no file reads needed) */
export function searchIndex(indexContent: string, query: string, topK = 5): SearchResult[] {
	const queryTokens = tokenize(query);
	if (queryTokens.length === 0) return [];

	const lines = indexContent.split("\n");
	const results: SearchResult[] = [];

	for (const line of lines) {
		const lineTokens = tokenize(line);
		const score = termFrequencyScore(lineTokens, queryTokens);
		if (score > 0) {
			// Extract link path from markdown link if present
			const linkMatch = line.match(/\[\[([^\]]+)\]\]|\[([^\]]+)\]\(([^)]+)\)/);
			const path = linkMatch ? linkMatch[1] || linkMatch[3] || "" : "";

			results.push({
				path,
				score: Math.min(1, score / queryTokens.length),
				snippet: line.trim().replace(/^[-*]\s*/, ""),
				matchedFields: ["content"],
			});
		}
	}

	results.sort((a, b) => b.score - a.score);
	return results.slice(0, topK);
}
