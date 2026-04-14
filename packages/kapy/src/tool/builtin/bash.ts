/**
 * bash tool — execute shell commands.
 */
import { z } from "zod";
import type { KapyToolRegistration, ToolResult, ToolExecutionContext } from "../types.js";

const MAX_OUTPUT = 50_000; // 50KB max output

export const bashTool: KapyToolRegistration = {
	name: "bash",
	label: "Bash",
	description: "Execute a bash shell command. Returns stdout, stderr, and exit code. Use for running builds, tests, git commands, and other shell operations.",
	promptSnippet: "bash: execute shell commands",
	promptGuidelines: [
		"Use bash for running shell commands: builds, tests, git, package managers.",
		"Prefer specific tools (read_file, glob, grep) over bash for file operations — they're safer and more structured.",
		"Be careful with destructive commands (rm, drop, truncate). Consider dry-running first.",
	],
	parameters: z.object({
		command: z.string().describe("The bash command to execute"),
		cwd: z.string().optional().describe("Working directory (defaults to project root)"),
		timeout: z.number().optional().describe("Timeout in seconds (default: 120)"),
	}),
	async execute(
		_callId: string,
		params: Record<string, unknown>,
		signal: AbortSignal | undefined,
		_onUpdate: (r: ToolResult) => void,
		ctx: ToolExecutionContext,
	): Promise<ToolResult> {
		const { spawn } = require("child_process") as typeof import("child_process");
		const cwd = (params.cwd as string) ?? ctx.cwd;
		const timeout = ((params.timeout as number) ?? 120) * 1000;
		const command = params.command as string;

		return new Promise<ToolResult>((resolve) => {
			let stdout = "";
			let stderr = "";

			const proc = spawn("bash", ["-c", command], {
				cwd,
				env: { ...process.env },
				stdio: ["pipe", "pipe", "pipe"],
			});

			const timer = setTimeout(() => {
				proc.kill("SIGTERM");
				stderr += "\n[Timeout: command exceeded time limit]";
			}, timeout);

			proc.stdout.on("data", (data: Buffer) => {
				if (stdout.length < MAX_OUTPUT) stdout += data.toString();
			});
			proc.stderr.on("data", (data: Buffer) => {
				if (stderr.length < MAX_OUTPUT) stderr += data.toString();
			});

			const cleanup = () => { clearTimeout(timer); if (signal) signal.removeEventListener("abort", onAbort); };
			const onAbort = () => { proc.kill("SIGTERM"); stderr += "\n[Aborted]"; };
			if (signal) signal.addEventListener("abort", onAbort, { once: true });

			proc.on("close", (code: number) => {
				cleanup();
				const truncated = stdout.length >= MAX_OUTPUT;
				const out = truncated ? stdout.slice(0, MAX_OUTPUT) + "\n[Output truncated]" : stdout;
				const result: string[] = [];
				if (out) result.push(out);
				if (stderr) result.push(`[stderr]\n${stderr}`);
				if (code !== 0) result.push(`[exit code: ${code}]`);

				resolve({
					content: [{ type: "text", text: result.join("\n") || "(no output)" }],
					details: { cwd, exitCode: code, truncated, command },
				});
			});

			proc.on("error", (err: Error) => {
				cleanup();
				resolve({
					content: [{ type: "text", text: `Error: ${err.message}` }],
					details: { cwd, error: err.message, command },
				});
			});

			proc.stdin.end();
		});
	},
	isReadOnly: (_params) => false,
	isConcurrencySafe: (_params) => false,
};