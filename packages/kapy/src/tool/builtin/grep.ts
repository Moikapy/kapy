/**
 * grep tool — search file contents for patterns.
 */
import { z } from "zod";
import type { KapyToolRegistration, ToolResult, ToolExecutionContext } from "../types.js";

const MAX_RESULTS = 50;
const MAX_LINE_LEN = 500;

export const grepTool: KapyToolRegistration = {
	name: "grep",
	label: "Grep",
	description: "Search file contents for a text pattern or regex. Returns matching lines with file paths and line numbers.",
	promptSnippet: "grep: search file contents for patterns",
	promptGuidelines: [
		"Use grep to find where functions, variables, or patterns appear in the codebase.",
		"Supports both plain text and regex patterns.",
		"Searches recursively through the file tree, skipping node_modules/.git.",
	],
	parameters: z.object({
		pattern: z.string().describe("Search pattern (plain text or regex)"),
		path: z.string().optional().describe("Directory or file to search in (defaults to cwd)"),
		ignoreCase: z.boolean().optional().describe("Case-insensitive search (default: false)"),
		filePattern: z.string().optional().describe("Only search files matching this glob (e.g., '*.ts')"),
	}),
	async execute(
		_callId: string,
		params: Record<string, unknown>,
		_signal: AbortSignal | undefined,
		_onUpdate: (r: ToolResult) => void,
		ctx: ToolExecutionContext,
	): Promise<ToolResult> {
		const fs = await import("fs");
		const path = await import("path");
		const searchDir = path.resolve(ctx.cwd, (params.path as string) ?? ".");
		const pattern = params.pattern as string;
		const ignoreCase = (params.ignoreCase as boolean) ?? false;
		const filePattern = params.filePattern as string | undefined;

		const flags = ignoreCase ? "i" : "";
		let regex: RegExp;
		try { regex = new RegExp(pattern, flags); } catch { regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), flags); }

		// Optional file pattern filter
		let fileRegex: RegExp | null = null;
		if (filePattern) {
			try {
				const glob = filePattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".");
				fileRegex = new RegExp(`^${glob}$`, ignoreCase ? "i" : "");
			} catch { /* skip filter */ }
		}

		const results: string[] = [];
		const SKIP_DIRS = new Set(["node_modules", ".git", ".bun", "dist", ".next", "__pycache__", ".turbo"]);

		async function searchFile(filePath: string, relPath: string): Promise<void> {
			if (results.length >= MAX_RESULTS) return;
			if (fileRegex && !fileRegex.test(path.basename(relPath))) return;

			// Skip binary-ish files
			const ext = path.extname(filePath).toLowerCase();
			if ([".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".woff", ".woff2", ".ttf", ".eot", ".map", ".lock"].includes(ext)) return;

			let content: string;
			try { content = await fs.promises.readFile(filePath, "utf-8"); } catch { return; }

			const lines = content.split("\n");
			for (let i = 0; i < lines.length; i++) {
				if (results.length >= MAX_RESULTS) break;
				if (regex.test(lines[i])) {
					const line = lines[i].length > MAX_LINE_LEN ? lines[i].slice(0, MAX_LINE_LEN) + "..." : lines[i];
					results.push(`${relPath}:${i + 1}: ${line.trim()}`);
				}
			}
		}

		async function walk(dir: string, depth: number): Promise<void> {
			if (results.length >= MAX_RESULTS || depth > 20) return;
			let entries;
			try { entries = await fs.promises.readdir(dir, { withFileTypes: true }); }
			catch { return; }

			for (const entry of entries) {
				if (results.length >= MAX_RESULTS) break;
				const full = path.join(dir, entry.name);
				const rel = path.relative(searchDir, full);

				if (entry.isFile()) {
					await searchFile(full, rel);
				} else if (entry.isDirectory() && !SKIP_DIRS.has(entry.name)) {
					await walk(full, depth + 1);
				}
			}
		}

		// If path is a file, search it directly
		let isFile = false;
		try { isFile = (await fs.promises.stat(searchDir)).isFile(); } catch { /* not found, treat as dir */ }

		if (isFile) {
			await searchFile(searchDir, path.basename(searchDir));
		} else {
			await walk(searchDir, 0);
		}

		const text = results.length === 0
			? `No matches for "${pattern}"`
			: results.join("\n");

		return {
			content: [{ type: "text", text }],
			details: { pattern, path: searchDir, matches: results.length, truncated: results.length >= MAX_RESULTS },
		};
	},
	isReadOnly: () => true,
	isConcurrencySafe: () => true,
};