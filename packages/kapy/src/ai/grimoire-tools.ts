/**
 * Grimoire agent tools — KapyToolRegistration definitions for wiki operations.
 *
 * These are tools the LLM can call to read, write, search, and maintain
 * its persistent knowledge base (the Grimoire).
 *
 * Two stores are available:
 * - Global: ~/.kapy/wiki/ — user preferences, cross-project knowledge
 * - Project: .kapy/wiki/ — codebase-specific knowledge
 */

import { z } from "zod";
import type { GrimoireStore } from "@moikapy/kapy-agent";
import type { KapyToolRegistration, ToolResult } from "../tool/types.js";

/** Resolve the store for a given scope */
function resolveStore(scope: string, globalStore: GrimoireStore, projectStore?: GrimoireStore): GrimoireStore {
	return scope === "project" && projectStore ? projectStore : globalStore;
}

/** Create grimoire tools for both scopes */
export function createGrimoireTools(globalStore: GrimoireStore, projectStore?: GrimoireStore): KapyToolRegistration[] {
	const tools: KapyToolRegistration[] = [];

	// ── Read ──────────────────────────────────────────────────────────

	tools.push({
		name: "grimoire_read",
		label: "Read Grimoire Page",
		description:
			"Read a page from the grimoire (agent knowledge base). Use 'global' scope for user preferences and cross-project knowledge, 'project' scope for codebase-specific knowledge.",
		promptSnippet: "Read pages from the grimoire knowledge base",
		promptGuidelines: [
			"Read relevant grimoire pages before making decisions to leverage accumulated knowledge",
			"Use global scope for user preferences, project scope for codebase architecture",
		],
		parameters: z.object({
			path: z.string().describe("Page path within the wiki (e.g., 'profile/preferences.md')"),
			scope: z.enum(["global", "project"]).default("global").describe("Which grimoire to read from"),
		}),
		execute: async (_toolCallId, rawParams, _signal, _onUpdate, _ctx): Promise<ToolResult> => {
			const params = rawParams as { path: string; scope: string };
			const store = resolveStore(params.scope, globalStore, projectStore);
			const content = await store.read(params.path);
			if (!content) {
				return {
					content: [{ type: "text", text: `Page not found: ${params.path} (scope: ${params.scope})` }],
					details: { found: false },
				};
			}
			return {
				content: [{ type: "text", text: content }],
				details: { found: true, path: params.path, scope: params.scope },
			};
		},
		isReadOnly: () => true,
		isConcurrencySafe: () => true,
	});

	// ── Write ─────────────────────────────────────────────────────────

	tools.push({
		name: "grimoire_write",
		label: "Write Grimoire Page",
		description:
			"Write or update a page in the grimoire. The agent owns this knowledge base — write what you learn so future sessions benefit. Include frontmatter tags when relevant.",
		promptSnippet: "Write pages to the grimoire to persist knowledge across sessions",
		promptGuidelines: [
			"Write to the grimoire when you learn something durable about the user or project",
			"Update existing pages rather than creating duplicates",
			"Add tags in frontmatter for discoverability",
			"Use global scope for user-level knowledge, project scope for codebase knowledge",
		],
		parameters: z.object({
			path: z.string().describe("Page path within the wiki (e.g., 'profile/preferences.md')"),
			content: z.string().describe("Full markdown content of the page"),
			scope: z.enum(["global", "project"]).default("global").describe("Which grimoire to write to"),
			tags: z.array(z.string()).optional().describe("Tags for frontmatter (e.g., ['typescript', 'architecture'])"),
		}),
		execute: async (_toolCallId, rawParams, _signal, _onUpdate, _ctx): Promise<ToolResult> => {
			const params = rawParams as { path: string; content: string; scope: string; tags?: string[] };
			const store = resolveStore(params.scope, globalStore, projectStore);
			await store.write(params.path, params.content, { tags: params.tags });
			return {
				content: [{ type: "text", text: `Written to ${params.scope} grimoire: ${params.path}` }],
				details: { path: params.path, scope: params.scope, tags: params.tags },
			};
		},
		isReadOnly: () => false,
		isConcurrencySafe: () => false,
	});

	// ── Search ────────────────────────────────────────────────────────

	tools.push({
		name: "grimoire_search",
		label: "Search Grimoire",
		description: "Search across grimoire pages by content and metadata. Returns the most relevant pages with snippets.",
		promptSnippet: "Search the grimoire for relevant knowledge before answering questions",
		promptGuidelines: ["Search the grimoire before making assumptions about user preferences or project knowledge"],
		parameters: z.object({
			query: z.string().describe("Search query"),
			scope: z.enum(["global", "project"]).default("global").describe("Which grimoire to search"),
			topK: z.number().min(1).max(20).default(5).describe("Maximum results to return"),
		}),
		execute: async (_toolCallId, rawParams, _signal, _onUpdate, _ctx): Promise<ToolResult> => {
			const params = rawParams as { query: string; scope: string; topK: number };
			const store = resolveStore(params.scope, globalStore, projectStore);
			const results = await store.search(params.query, params.topK);

			if (results.length === 0) {
				return {
					content: [{ type: "text", text: `No results for "${params.query}" in ${params.scope} grimoire` }],
					details: { query: params.query, scope: params.scope, count: 0 },
				};
			}

			const output = results
				.map((r) => `**${r.path}** (score: ${r.score.toFixed(2)})\n${r.snippet}`)
				.join("\n\n");

			return {
				content: [{ type: "text", text: output }],
				details: { query: params.query, scope: params.scope, results: results.length },
			};
		},
		isReadOnly: () => true,
		isConcurrencySafe: () => true,
	});

	// ── List ──────────────────────────────────────────────────────────

	tools.push({
		name: "grimoire_list",
		label: "List Grimoire Pages",
		description: "List all pages in the grimoire, optionally filtered by category.",
		promptSnippet: "List available grimoire pages to find what knowledge exists",
		parameters: z.object({
			scope: z.enum(["global", "project"]).default("global").describe("Which grimoire to list"),
			category: z.string().optional().describe("Filter by category (profile, projects, concepts, sources, etc.)"),
		}),
		execute: async (_toolCallId, rawParams, _signal, _onUpdate, _ctx): Promise<ToolResult> => {
			const params = rawParams as { scope: string; category?: string };
			const store = resolveStore(params.scope, globalStore, projectStore);
			const pages = await store.list(params.category);

			if (pages.length === 0) {
				const cat = params.category ? ` in category '${params.category}'` : "";
				return {
					content: [{ type: "text", text: `No pages${cat} in ${params.scope} grimoire` }],
					details: { scope: params.scope, count: 0 },
				};
			}

			const output = pages
				.map((p) => {
					const summary = p.summary ? ` — ${p.summary}` : "";
					return `- ${p.path}${summary}`;
				})
				.join("\n");

			return {
				content: [{ type: "text", text: `${pages.length} pages in ${params.scope} grimoire:\n${output}` }],
				details: { scope: params.scope, count: pages.length },
			};
		},
		isReadOnly: () => true,
		isConcurrencySafe: () => true,
	});

	// ── Lint ─────────────────────────────────────────────────────────

	tools.push({
		name: "grimoire_lint",
		label: "Lint Grimoire",
		description:
			"Health-check the grimoire for orphans, stale pages, broken links, and missing cross-references. Run periodically to keep the knowledge base healthy.",
		promptSnippet: "Periodically lint the grimoire to maintain knowledge base quality",
		promptGuidelines: ["Run grimoire_lint after writing multiple pages or at the end of a session"],
		parameters: z.object({
			scope: z.enum(["global", "project"]).default("global").describe("Which grimoire to lint"),
		}),
		execute: async (_toolCallId, rawParams, _signal, _onUpdate, _ctx): Promise<ToolResult> => {
			const params = rawParams as { scope: string };
			const store = resolveStore(params.scope, globalStore, projectStore);
			const issues = await store.lint();

			if (issues.length === 0) {
				return {
					content: [{ type: "text", text: `✅ ${params.scope} grimoire is healthy — no issues found` }],
					details: { scope: params.scope, issues: 0 },
				};
			}

			const output = issues
				.map(
					(i) =>
						`${i.severity === "error" ? "❌" : i.severity === "warn" ? "⚠️" : "ℹ️"} [${i.type}] ${i.path}: ${i.message}${i.suggestion ? ` → ${i.suggestion}` : ""}`,
				)
				.join("\n");

			return {
				content: [{ type: "text", text: `${issues.length} issues in ${params.scope} grimoire:\n${output}` }],
				details: { scope: params.scope, issues: issues.length },
			};
		},
		isReadOnly: () => true,
		isConcurrencySafe: () => true,
	});

	return tools;
}