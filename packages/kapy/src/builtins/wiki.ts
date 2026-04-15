/**
 * `kapy wiki` — CLI interface to the Grimoire knowledge base.
 *
 * Subcommands:
 *   kapy wiki list [--category <cat>] [--scope global|project]
 *   kapy wiki read <path> [--scope global|project]
 *   kapy wiki search <query> [--scope global|project] [--top-k 5]
 *   kapy wiki lint [--scope global|project]
 *   kapy wiki stats [--scope global|project]
 *   kapy wiki index [--scope global|project]
 */

import type { CommandHandler, CommandOptions } from "../command/parser.js";
import { GRIMOIRE_DIR, KAPY_HOME } from "../config/defaults.js";
import { GrimoireStore } from "@moikapy/kapy-agent";
import { join } from "node:path";

/** Get the grimoire store for the requested scope */
function getStore(scope: "global" | "project"): GrimoireStore {
	if (scope === "global") {
		return new GrimoireStore({ scope: "global", rootDir: GRIMOIRE_DIR });
	}
	return new GrimoireStore({ scope: "project", rootDir: join(process.cwd(), ".kapy", "wiki") });
}

/** Get positional args from context */
function getPositional(args: Record<string, unknown>): string[] {
	const rest = args.rest;
	if (Array.isArray(rest)) return rest as string[];
	const underscore = args._;
	if (Array.isArray(underscore)) return underscore as string[];
	return [];
}

export const wikiCommand: CommandHandler = async (ctx) => {
	const positional = getPositional(ctx.args);
	const subcommand = positional[0];
	const scope = (ctx.args.scope as "global" | "project") ?? "global";

	// No subcommand — show stats
	if (!subcommand) {
		const store = getStore(scope);
		const stats = await store.getStats();
		ctx.log(`📖 Grimoire (${scope})`);
		ctx.log(`   Pages: ${stats.totalPages}`);
		ctx.log(`   Size: ${(stats.totalSize / 1024).toFixed(1)}KB`);
		ctx.log(`   Last activity: ${stats.lastActivity || "never"}`);
		ctx.log(`   Log entries: ${stats.logEntries}`);
		if (Object.keys(stats.byCategory).length > 0) {
			ctx.log(`   Categories:`);
			for (const [cat, count] of Object.entries(stats.byCategory)) {
				ctx.log(`     ${cat}: ${count}`);
			}
		}
		ctx.log(`\nUsage: kapy wiki <list|read|search|lint|stats|index|ingest> [options]`);
		return;
	}

	const store = getStore(scope);

	switch (subcommand) {
		case "list": {
			const category = ctx.args.category as string | undefined;
			const pages = await store.list(category);

			if (pages.length === 0) {
				ctx.log(`📖 No pages${category ? ` in '${category}'` : ""} (${scope} grimoire)`);
				return;
			}

			ctx.log(`📖 ${pages.length} pages${category ? ` in '${category}'` : ""} (${scope} grimoire):\n`);
			for (const page of pages) {
				const summary = page.summary ? ` — ${page.summary}` : "";
				ctx.log(`  ${page.path}${summary}`);
			}
			break;
		}

		case "read": {
			const path = positional[1];
			if (!path) {
				ctx.error("Usage: kapy wiki read <path>");
				ctx.exitCode = 2;
				return;
			}

			const content = await store.read(path);
			if (!content) {
				ctx.error(`Page not found: ${path}`);
				ctx.exitCode = 1;
				return;
			}

			ctx.log(content);
			break;
		}

		case "search": {
			const query = positional.slice(1).join(" ");
			if (!query) {
				ctx.error("Usage: kapy wiki search <query>");
				ctx.exitCode = 2;
				return;
			}

			const topK = (ctx.args["top-k"] as number) ?? 5;
			const results = await store.search(query, topK);

			if (results.length === 0) {
				ctx.log(`📖 No results for "${query}"`);
				return;
			}

			ctx.log(`📖 ${results.length} results for "${query}":\n`);
			for (const result of results) {
				ctx.log(`  ${result.path} (score: ${result.score.toFixed(2)})`);
				if (result.snippet) {
					ctx.log(`    ${result.snippet.split("\n")[0]}`);
				}
				ctx.log("");
			}
			break;
		}

		case "lint": {
			const issues = await store.lint();

			if (issues.length === 0) {
				ctx.log(`📖 ✅ Grimoire is healthy — no issues found`);
				return;
			}

			ctx.log(`📖 ${issues.length} issues found:\n`);
			for (const issue of issues) {
				const icon = issue.severity === "error" ? "❌" : issue.severity === "warn" ? "⚠️" : "ℹ️";
				ctx.log(`  ${icon} [${issue.type}] ${issue.path}: ${issue.message}`);
				if (issue.suggestion) {
					ctx.log(`     → ${issue.suggestion}`);
				}
			}
			break;
		}

		case "stats": {
			const stats = await store.getStats();
			ctx.log(`📖 Grimoire Stats (${scope})`);
			ctx.log(`   Total pages: ${stats.totalPages}`);
			ctx.log(`   Total size: ${(stats.totalSize / 1024).toFixed(1)}KB`);
			ctx.log(`   Log entries: ${stats.logEntries}`);
			ctx.log(`   Last activity: ${stats.lastActivity || "never"}`);
			for (const [cat, count] of Object.entries(stats.byCategory)) {
				ctx.log(`   ${cat}: ${count} pages`);
			}
			break;
		}

		case "index": {
			await store.updateIndex();
			ctx.log(`📖 Index regenerated`);
			break;
		}

		case "ingest": {
			const sourcePath = positional[1];
			if (!sourcePath) {
				ctx.error("Usage: kapy wiki ingest <file-path> [--title <title>]");
				ctx.exitCode = 2;
				return;
			}

			const sourceTitle = ctx.args.title as string | undefined;

			try {
				const result = await store.ingest(sourcePath, sourceTitle);
				ctx.log(`📖 Ingested: ${result.summary}`);
				for (const page of result.pagesUpdated) {
					ctx.log(`   Updated: ${page}`);
				}
			} catch (err) {
				ctx.error(`Ingest failed: ${err instanceof Error ? err.message : String(err)}`);
				ctx.exitCode = 1;
			}
			break;
		}

		case "init-obsidian": {
			const obsidianDir = join(store.rootDir, ".obsidian");
			const { mkdir, writeFile: writeFileAsync } = await import("node:fs/promises");

			await mkdir(obsidianDir, { recursive: true });

			// Minimal Obsidian config for a clean vault experience
			await writeFileAsync(
				join(obsidianDir, "app.json"),
				JSON.stringify({
					"attachmentFolderPath": "sources/assets",
					"newFileLocation": "current",
					"promptDelete": true,
				}, null, 2),
			);

			await writeFileAsync(
				join(obsidianDir, "appearance.json"),
				JSON.stringify({
					"baseTheme": "dark",
					"cssTheme": "",
				}, null, 2),
			);

			// Workspace with graph view as default
			await writeFileAsync(
				join(obsidianDir, "workspace.json"),
				JSON.stringify({
					"active": "graph",
					"left": { "type": "file-explorer" },
					"right": { "type": "graph" },
				}, null, 2),
			);

			// Ensure sources/assets dir for attachments
			const { GRIMOIRE_DIR: _gd } = await import("../config/defaults.js");
			await mkdir(join(store.rootDir, "sources", "assets"), { recursive: true });

			ctx.log(`📖 Obsidian vault initialized at ${store.rootDir}`);
			ctx.log(`   Open in Obsidian: File → Open Vault → ${store.rootDir}`);
			ctx.log(`   Attachments will be saved to sources/assets/`);
			break;
		}

		default:
			ctx.error(`Unknown wiki subcommand: ${subcommand}`);
			ctx.log("Available: list, read, search, lint, stats, index, ingest, init-obsidian");
			ctx.exitCode = 2;
	}
};

export const wikiCommandOptions: CommandOptions = {
	description: "Manage the grimoire (agent knowledge base)",
	flags: {
		scope: { type: "string", description: "Grimoire scope: global or project", default: "global" },
		category: { type: "string", description: "Filter by category" },
		"top-k": { type: "number", description: "Max search results", default: 5 },
		title: { type: "string", description: "Title for ingested source" },
	},
};