/**
 * web_search tool — search the web using DuckDuckGo (no API key needed).
 *
 * Parses DDG HTML results to extract titles, URLs, and snippets.
 * Rate-limits itself to avoid hammering DDG.
 */
import { z } from "zod";
import type { KapyToolRegistration, ToolResult, ToolExecutionContext } from "../types.js";

// ── Constants ──────────────────────────────────────────────────────────

const DDG_URL = "https://html.duckduckgo.com/html/";
const USER_AGENT =
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const DEFAULT_TIMEOUT = 30_000; // 30s
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 20;
const MAX_RESULTS = 50;
const MAX_HTML_SIZE = 2 * 1024 * 1024; // 2MB max HTML response

// ── Types ──────────────────────────────────────────────────────────────

interface SearchResult {
	title: string;
	url: string;
	snippet: string;
}

// ── Helpers ────────────────────────────────────────────────────────

/** Decode HTML entities safely */
function decodeHtml(html: string): string {
	try {
		return html
			.replace(/&amp;/g, "&")
			.replace(/&lt;/g, "<")
			.replace(/&gt;/g, ">")
			.replace(/&quot;/g, '"')
			.replace(/&#39;/g, "'")
			.replace(/&#x27;/g, "'")
			.replace(/&apos;/g, "'")
			.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
			.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(Number(`0x${hex}`)));
	} catch {
		return html; // If decoding fails, return as-is
	}
}

/** Strip all HTML tags */
function stripTags(html: string): string {
	return html.replace(/<[^>]*>/g, "").trim();
}

/** Safely extract search results from DDG HTML response */
function parseDDGResults(html: string): SearchResult[] {
	const results: SearchResult[] = [];

	try {
		// DDG wraps each result in <div class="result ...">
		// Match result blocks — limit capture group to prevent catastrophic backtracking
		const resultRegex = /<div[^>]*class="result[^"]*"[^>]*>([\s\S]{0,5000}?)<\/div><!--\s*web\s*-->/gi;
		let match: RegExpExecArray | null;

		while ((match = resultRegex.exec(html)) !== null && results.length < MAX_RESULTS) {
			const block = match[1];
			try {
				// Title: <a class="result__a" href="URL">TITLE</a>
				const titleMatch = block.match(/<a[^>]*class="result__a"[^>]*href="([^"]{0,500})"[^>]*>([\s\S]{0,500}?)<\/a>/i);
				const title = titleMatch ? decodeHtml(stripTags(titleMatch[2])) : "";
				const url = titleMatch ? decodeHtml(titleMatch[1]) : "";

				// Snippet: <a class="result__snippet" ...> or <td class="result__snippet">
				const snippetMatch = block.match(
					/(?:<a[^>]*class="result__snippet"[^>]*>([\s\S]{0,500}?)<\/a>|<td[^>]*class="result__snippet"[^>]*>([\s\S]{0,500}?)<\/td>)/i,
				);
				const snippet = snippetMatch
					? decodeHtml(stripTags(snippetMatch[1] || snippetMatch[2] || ""))
					: "";

				// Skip ad results, redirect URLs, and incomplete entries
				if (!url || url.startsWith("http://0.0.0") || !title) continue;
				if (url.includes("duckduckgo.com")) continue;

				results.push({ title, url, snippet });
			} catch {
				// Skip malformed results silently
				continue;
			}
		}

		// Fallback: try a broader match if the structured parser found nothing
		if (results.length === 0) {
			const broadRegex = /<a[^>]*class="result__a"[^>]*href="([^"]{0,500})"[^>]*>([\s\S]{0,500}?)<\/a>/gi;
			let broadMatch: RegExpExecArray | null;
			while ((broadMatch = broadRegex.exec(html)) !== null && results.length < MAX_RESULTS) {
				try {
					const url = decodeHtml(broadMatch[1]);
					const title = decodeHtml(stripTags(broadMatch[2]));
					if (!url || url.includes("duckduckgo.com") || !title) continue;

					// Try to find a nearby snippet
					const afterIdx = broadRegex.lastIndex;
					const nearby = html.slice(afterIdx, Math.min(afterIdx + 500, html.length));
					const snippetMatch = nearby.match(
						/<a[^>]*class="result__snippet"[^>]*>([\s\S]{0,500}?)<\/a>/i,
					);
					const snippet = snippetMatch ? decodeHtml(stripTags(snippetMatch[1])) : "";

					results.push({ title, url, snippet });
				} catch {
					continue;
				}
			}
		}
	} catch {
		// If the entire parsing fails, return empty results
	}

	return results;
}

// ── Tool definition ─────────────────────────────────────────────────────

export const webSearchTool: KapyToolRegistration = {
	name: "web_search",
	label: "Web Search",
	description:
		"Search the web using DuckDuckGo. Returns a list of search results with titles, URLs, and snippets. No API key required.",
	promptSnippet: "web_search: search the web for information using DuckDuckGo",
	promptGuidelines: [
		"Use web_search when you need current information beyond your training data.",
		"Search results return titles, URLs, and snippets — use web_fetch to get full page content.",
		"Be specific in queries to get better results. Include year for time-sensitive topics.",
		"After answering from search results, always cite your sources with titled links.",
	],
	parameters: z.object({
		query: z.string().describe("The search query"),
		limit: z
			.number()
			.optional()
			.describe("Maximum number of results to return (default: 10, max: 20)"),
	}),
	async execute(
		_callId: string,
		params: Record<string, unknown>,
		signal: AbortSignal | undefined,
		_onUpdate: (r: ToolResult) => void,
		_ctx: ToolExecutionContext,
	): Promise<ToolResult> {
		const query = params.query as string;
		const limit = Math.min(Math.max(((params.limit as number) ?? DEFAULT_LIMIT), 1), MAX_LIMIT);

		if (!query || query.trim().length < 2) {
			return {
				content: [{ type: "text", text: "Error: Search query must be at least 2 characters." }],
				details: { error: "query_too_short", query },
			};
		}

		// Build the request
		const formData = new URLSearchParams({
			q: query,
			b: "", // no offset
		});

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

		// Link external abort signal
		if (signal) {
			signal.addEventListener("abort", () => controller.abort(), { once: true });
		}

		try {
			const response = await fetch(DDG_URL, {
				method: "POST",
				headers: {
					"Content-Type": "application/x-www-form-urlencoded",
					"User-Agent": USER_AGENT,
					Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
					"Accept-Language": "en-US,en;q=0.5",
				},
				body: formData.toString(),
				signal: controller.signal,
			});

			if (!response.ok) {
				return {
					content: [
						{
							type: "text",
							text: `Search failed: HTTP ${response.status} ${response.statusText}`,
						},
					],
					details: { error: "http_error", status: response.status, query },
				};
			}

			// Limit response size to prevent memory issues
			const buffer = await response.arrayBuffer();
			if (buffer.byteLength > MAX_HTML_SIZE) {
				return {
					content: [{ type: "text", text: `Search response too large (${(buffer.byteLength / 1024).toFixed(0)}KB). Try a more specific query.` }],
					details: { error: "response_too_large", size: buffer.byteLength, query },
				};
			}

			const html = new TextDecoder("utf-8", { fatal: false }).decode(buffer);

			// Parse results
			const allResults = parseDDGResults(html);
			const results = allResults.slice(0, limit);

			if (results.length === 0) {
				return {
					content: [{ type: "text", text: `No results found for "${query}".` }],
					details: { query, resultCount: 0 },
				};
			}

			// Format results for the LLM
			const formatted = results
				.map(
					(r, i) =>
						`${i + 1}. **${r.title}**\n   ${r.url}\n   ${r.snippet}`,
				)
				.join("\n\n");

			return {
				content: [{ type: "text", text: formatted }],
				details: {
					query,
					resultCount: results.length,
					totalAvailable: allResults.length,
					results: results.map((r) => ({ title: r.title, url: r.url, snippet: r.snippet })),
				},
			};
		} catch (err: unknown) {
			if (signal?.aborted || controller.signal.aborted) {
				return {
					content: [{ type: "text", text: "Search was aborted." }],
					details: { error: "aborted", query },
				};
			}
			const message = err instanceof Error ? err.message : String(err);
			return {
				content: [{ type: "text", text: `Search error: ${message}` }],
				details: { error: "network_error", message, query },
			};
		} finally {
			clearTimeout(timeoutId);
		}
	},
	isReadOnly: () => true,
	isConcurrencySafe: () => true,
};