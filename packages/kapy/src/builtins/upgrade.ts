/** kapy upgrade — upgrade kapy itself to the latest version */
import { spawn } from "node:child_process";
import type { CommandContext } from "../command/context.js";

/** Run a command safely without shell injection */
async function runCommand(
	command: string,
	args: string[],
	options?: { stdio?: "pipe" | "inherit" },
): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
	return new Promise((resolve) => {
		const proc = spawn(command, args, { stdio: options?.stdio ?? "pipe" });
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

export const upgradeCommand = async (ctx: CommandContext): Promise<void> => {
	const spinner = ctx.spinner("Checking for kapy updates...");
	spinner.start();

	// Try bun first, then npm
	let upgraded = false;

	try {
		const result = await runCommand("bun", ["add", "-g", "kapy@latest"], {
			stdio: ctx.json ? "pipe" : "inherit",
		});
		if (result.exitCode === 0) {
			spinner.succeed("kapy upgraded to latest version");
			upgraded = true;
		}
	} catch {
		// bun failed, try npm
	}

	if (!upgraded) {
		try {
			const result = await runCommand("npm", ["install", "-g", "kapy@latest"], {
				stdio: ctx.json ? "pipe" : "inherit",
			});
			if (result.exitCode === 0) {
				spinner.succeed("kapy upgraded to latest version");
				upgraded = true;
			} else {
				spinner.fail("Failed to upgrade kapy. Try running: bun add -g kapy@latest");
			}
		} catch {
			spinner.fail("Failed to upgrade kapy. Try running: bun add -g kapy@latest");
		}
	}

	if (ctx.json) {
		console.log(JSON.stringify({ status: upgraded ? "success" : "error" }));
	}
};
