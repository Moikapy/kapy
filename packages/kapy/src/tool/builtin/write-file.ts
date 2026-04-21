/**
 * write_file tool — writes content to a file on the local filesystem.
 */
import { z } from "zod";
import type { KapyToolRegistration, ToolExecutionContext, ToolResult } from "../types.js";

export const writeFileTool: KapyToolRegistration = {
	name: "write_file",
	label: "Write File",
	description:
		"Write content to a file on the local filesystem. Creates the file if it doesn't exist, overwrites if it does. Creates parent directories as needed.",
	promptSnippet: "write_file: write content to a local file",
	promptGuidelines: [
		"Use write_file to create new files or overwrite existing ones.",
		"Always read_file first before overwriting — verify you're not destroying important content.",
		"Creates parent directories automatically.",
	],
	parameters: z.object({
		path: z.string().describe("Path to the file to write (relative to cwd or absolute)"),
		content: z.string().describe("Content to write to the file"),
	}),
	async execute(
		_callId: string,
		params: Record<string, unknown>,
		signal: AbortSignal | undefined,
		_onUpdate: (r: ToolResult) => void,
		ctx: ToolExecutionContext,
	): Promise<ToolResult> {
		const fs = await import("node:fs");
		const path = await import("node:path");
		const filePath = path.resolve(ctx.cwd, params.path as string);
		const content = params.content as string;

		try {
			// Create parent directories
			const dir = path.dirname(filePath);
			await fs.promises.mkdir(dir, { recursive: true });

			if (signal?.aborted)
				return { content: [{ type: "text", text: "Aborted" }], details: { path: filePath, aborted: true } };

			await fs.promises.writeFile(filePath, content, "utf-8");
			const lines = content.split("\n").length;

			return {
				content: [{ type: "text", text: `Wrote ${lines} lines to ${params.path}` }],
				details: { path: filePath, lines, bytes: content.length },
			};
		} catch (e: any) {
			return {
				content: [{ type: "text", text: `Error: ${e.message}` }],
				details: { path: filePath, error: e.message },
			};
		}
	},
	isReadOnly: () => false,
	isConcurrencySafe: () => false,
};
