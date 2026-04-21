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

import type { GrimoireStore } from "@moikapy/kapy-agent";
import { z } from "zod";
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

			const output = results.map((r) => `**${r.path}** (score: ${r.score.toFixed(2)})\n${r.snippet}`).join("\n\n");

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

	// ── Ingest ────────────────────────────────────────────────────────

	tools.push({
		name: "grimoire_ingest",
		label: "Ingest Source into Grimoire",
		description:
			"Ingest a raw source file into the grimoire. Creates a summary page in sources/ and updates the index and log.",
		promptSnippet: "Ingest documents into the grimoire to build persistent knowledge",
		promptGuidelines: [
			"Ingest sources one at a time and review the summary before moving on",
			"Update relevant concept and entity pages after ingesting a new source",
		],
		parameters: z.object({
			sourcePath: z.string().describe("Path to the source file to ingest"),
			title: z.string().optional().describe("Title for the source (defaults to filename)"),
			scope: z.enum(["global", "project"]).default("global").describe("Which grimoire to ingest into"),
		}),
		execute: async (_toolCallId, rawParams, _signal, _onUpdate, _ctx): Promise<ToolResult> => {
			const params = rawParams as { sourcePath: string; title?: string; scope: string };
			const store = resolveStore(params.scope, globalStore, projectStore);

			try {
				const result = await store.ingest(params.sourcePath, params.title);
				return {
					content: [{ type: "text", text: `📖 ${result.summary}\nUpdated: ${result.pagesUpdated.join(", ")}` }],
					details: { pagesUpdated: result.pagesUpdated, summary: result.summary },
				};
			} catch (err) {
				return {
					content: [{ type: "text", text: `Ingest failed: ${err instanceof Error ? err.message : String(err)}` }],
					details: { error: true },
				};
			}
		},
		isReadOnly: () => false,
		isConcurrencySafe: () => false,
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

	// ── SOUL.md evolve ────────────────────────────────────────────────────

	tools.push({
		name: "soul_evolve",
		label: "Evolve SOUL.md",
		description:
			"Update the SOUL.md identity file. Use this when you learn something fundamental about who you are or how you should behave. ALWAYS tell the user before evolving SOUL.md — it is your soul, and they should know.",
		promptSnippet: "Evolve your SOUL.md identity as you learn about yourself",
		promptGuidelines: [
			"ALWAYS tell the user before evolving SOUL.md — it defines who you are",
			"Evolve SOUL.md only when you discover something fundamental about your identity",
			"Don't evolve for temporary preferences — those go in the grimoire",
			"Changes to core truths, boundaries, or communication style are worth evolving",
		],
		parameters: z.object({
			content: z.string().describe("Full new SOUL.md content (replaces entire file)"),
		}),
		execute: async (_toolCallId, rawParams, _signal, _onUpdate, _ctx): Promise<ToolResult> => {
			const params = rawParams as { content: string };
			const { writeFile: writeFileAsync } = await import("node:fs/promises");
			const soulPath = (await import("../config/defaults.js")).SOUL_FILE;

			try {
				await writeFileAsync(soulPath, params.content, "utf-8");

				// Update the agent's system prompt so changes take effect immediately
				// (ChatSession will need to handle this — for now, the write persists to disk)

				return {
					content: [
						{ type: "text", text: `📖 SOUL.md evolved. The user has been notified of changes to your identity.` },
					],
					details: { path: soulPath, updated: true },
				};
			} catch (err) {
				return {
					content: [
						{ type: "text", text: `Failed to evolve SOUL.md: ${err instanceof Error ? err.message : String(err)}` },
					],
					details: { error: true },
				};
			}
		},
		isReadOnly: () => false,
		isConcurrencySafe: () => false,
	});

	return tools;
}
