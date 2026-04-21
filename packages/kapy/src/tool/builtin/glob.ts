/**
 * glob tool — find files matching a glob pattern.
 */
import { z } from "zod";
import type { KapyToolRegistration, ToolExecutionContext, ToolResult } from "../types.js";

const MAX_RESULTS = 200;

export const globTool: KapyToolRegistration = {
	name: "glob",
	label: "Glob",
	description:
		"Find files matching a glob pattern. Returns list of matched file paths relative to the working directory.",
	promptSnippet: "glob: find files by pattern",
	promptGuidelines: [
		"Use glob to discover files: source code, configs, test files.",
		"Common patterns: **/*.ts, src/**/*.js, **/*.test.ts",
	],
	parameters: z.object({
		pattern: z.string().describe("Glob pattern to match (e.g., '**/*.ts', 'src/**/*.js')"),
		cwd: z.string().optional().describe("Base directory to search from (defaults to project root)"),
	}),
	async execute(
		_callId: string,
		params: Record<string, unknown>,
		_signal: AbortSignal | undefined,
		_onUpdate: (r: ToolResult) => void,
		ctx: ToolExecutionContext,
	): Promise<ToolResult> {
		const fs = await import("node:fs");
		const path = await import("node:path");
		const baseDir = path.resolve(ctx.cwd, (params.cwd as string) ?? ".");
		const pattern = params.pattern as string;

		const results: string[] = [];

		// Build regexes from glob pattern
		// **/*.ts should match both "a.ts" and "src/c.ts"
		const makeRegex = (p: string): RegExp => {
			const re = p
				.replace(/[.+^${}()|[\]\\]/g, "\\$&")
				.replace(/\*\*/g, ".*")
				.replace(/\*/g, "[^/]*")
				.replace(/\?/g, "[^/]");
			return new RegExp(`^${re}$`);
		};

		const fullRegex = makeRegex(pattern);
		// Also try without **/ prefix for top-level files
		const barePattern = pattern.replace(/^\*\*\//, "");
		const bareRegex = makeRegex(barePattern);

		async function walk(dir: string, depth: number): Promise<void> {
			if (results.length >= MAX_RESULTS || depth > 20) return;
			let entries;
			try {
				entries = await fs.promises.readdir(dir, { withFileTypes: true });
			} catch {
				return;
			}

			for (const entry of entries) {
				if (results.length >= MAX_RESULTS) break;
				if (
					entry.isDirectory() &&
					["node_modules", ".git", ".bun", "dist", ".next", "__pycache__"].includes(entry.name)
				)
					continue;

				const full = path.join(dir, entry.name);
				const rel = path.relative(baseDir, full);

				if (entry.isFile()) {
					if (fullRegex.test(rel) || bareRegex.test(rel) || bareRegex.test(path.basename(rel))) {
						results.push(rel);
					}
				} else if (entry.isDirectory()) {
					await walk(full, depth + 1);
				}
			}
		}

		await walk(baseDir, 0);

		const text = results.length === 0 ? `No files matching "${pattern}"` : results.sort().join("\n");

		return {
			content: [{ type: "text", text }],
			details: { pattern, cwd: baseDir, count: results.length, truncated: results.length >= MAX_RESULTS },
		};
	},
	isReadOnly: () => true,
	isConcurrencySafe: () => true,
};
