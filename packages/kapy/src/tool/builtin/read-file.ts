/**
 * read_file tool — reads file contents from the local filesystem.
 */
import { z } from "zod";
import type { KapyToolRegistration, ToolResult, ToolExecutionContext } from "../types.js";

const MAX_SIZE = 1024 * 1024; // 1MB max

export const readFileTool: KapyToolRegistration = {
	name: "read_file",
	label: "Read File",
	description: "Read the contents of a file from the local filesystem. Returns the file content as text.",
	promptSnippet: "read_file: read file contents from local filesystem",
	promptGuidelines: [
		"Use read_file to examine source code, configs, and documentation.",
		"Prefer read_file over bash cat for file inspection — it's safer and includes line info.",
	],
	parameters: z.object({
		path: z.string().describe("Path to the file to read (relative to cwd or absolute)"),
		offset: z.number().optional().describe("Line number to start reading from (1-indexed)"),
		limit: z.number().optional().describe("Maximum number of lines to read"),
	}),
	async execute(
		_callId: string,
		params: Record<string, unknown>,
		signal: AbortSignal | undefined,
		_onUpdate: (r: ToolResult) => void,
		ctx: ToolExecutionContext,
	): Promise<ToolResult> {
		const fs = await import("fs");
		const path = await import("path");
		const filePath = path.resolve(ctx.cwd, params.path as string);

		try {
			const stat = await fs.promises.stat(filePath);
			if (stat.isDirectory()) {
				return { content: [{ type: "text", text: `Error: "${params.path}" is a directory, not a file. Use glob to list directory contents.` }], details: { path: filePath, isDirectory: true } };
			}
			if (stat.size > MAX_SIZE) {
				return { content: [{ type: "text", text: `Error: File too large (${(stat.size / 1024).toFixed(0)}KB). Use offset/limit to read portions.` }], details: { path: filePath, size: stat.size } };
			}

			const raw = await fs.promises.readFile(filePath, "utf-8");
			const lines = raw.split("\n");
			const offset = (params.offset as number) ?? 1;
			const limit = (params.limit as number) ?? lines.length;
			const startLine = Math.max(1, offset) - 1;
			const endLine = Math.min(lines.length, startLine + limit);
			const selected = lines.slice(startLine, endLine);

			// Add line numbers
			const numbered = selected.map((line, i) => `${startLine + i + 1}: ${line}`).join("\n");

			if (signal?.aborted) return { content: [{ type: "text", text: "Aborted" }], details: { path: filePath, aborted: true } };

			return {
				content: [{ type: "text", text: numbered || "(empty file)" }],
				details: { path: filePath, totalLines: lines.length, shownLines: selected.length, startLine: startLine + 1 },
			};
		} catch (e: any) {
			if (e.code === "ENOENT") return { content: [{ type: "text", text: `Error: File not found: ${params.path}` }], details: { path: filePath, notFound: true } };
			if (e.code === "EACCES") return { content: [{ type: "text", text: `Error: Permission denied: ${params.path}` }], details: { path: filePath, permissionDenied: true } };
			return { content: [{ type: "text", text: `Error: ${e.message}` }], details: { path: filePath, error: e.message } };
		}
	},
	isReadOnly: () => true,
	isConcurrencySafe: () => true,
};