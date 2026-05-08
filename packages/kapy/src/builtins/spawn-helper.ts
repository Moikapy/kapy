/**
 * Shared subprocess helper — used by install, remove, update, and upgrade commands.
 *
 * Uses Node's child_process.spawn for broad compatibility.
 * For the ctx-aware spawn with abort/timeout support, use ctx.spawn() instead.
 */
import { spawn } from "node:child_process";

export interface RunCommandResult {
	stdout: string;
	stderr: string;
	exitCode: number | null;
}

/** Run a command safely without shell injection */
export async function runCommand(
	command: string,
	args: string[],
	options?: { cwd?: string; stdio?: "pipe" | "inherit" },
): Promise<RunCommandResult> {
	return new Promise((resolve) => {
		const proc = spawn(command, args, {
			cwd: options?.cwd,
			stdio: options?.stdio ?? "pipe",
		});
		let stdout = "";
		let stderr = "";
		proc.stdout?.on("data", (data: Buffer) => {
			stdout += data.toString();
		});
		proc.stderr?.on("data", (data: Buffer) => {
			stderr += data.toString();
		});
		proc.on("close", (code) => {
			resolve({ stdout, stderr, exitCode: code });
		});
		proc.on("error", (err) => {
			resolve({ stdout, stderr: stderr + err.message, exitCode: 1 });
		});
	});
}

/** Map PM name to its global uninstall command */
export function getUninstallArgs(pmName: string, pkg: string): string[] {
	switch (pmName) {
		case "bun":
			return ["remove", "-g", pkg];
		case "npm":
			return ["uninstall", "-g", pkg];
		case "yarn":
			return ["global", "remove", pkg];
		case "pnpm":
			return ["remove", "-g", pkg];
		default:
			return ["uninstall", "-g", pkg];
	}
}
