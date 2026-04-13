/** kapy upgrade — upgrade kapy itself to the latest version */
import { spawn } from "node:child_process";
import type { CommandContext } from "../command/context.js";
import { detectPackageManagers, getInstallArgs } from "./package-managers.js";

const PKG = "@moikapy/kapy";

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
	// Allow overriding the package manager via flag
	const preferredPm = ctx.args.pm as string | undefined;

	const available = detectPackageManagers();
	const spinner = ctx.spinner(`Upgrading ${PKG}...`);

	if (available.length === 0) {
		spinner.start();
		spinner.fail("No package manager found. Install bun, npm, yarn, or pnpm to upgrade.");
		ctx.abort(5);
		return;
	}

	// Determine which PMs to try, in order
	let candidates: string[];
	if (preferredPm) {
		if (!available.includes(preferredPm)) {
			spinner.start();
			spinner.fail(`Package manager "${preferredPm}" not found. Available: ${available.join(", ")}`);
			ctx.abort(5);
			return;
		}
		candidates = [preferredPm];
	} else {
		candidates = available;
	}

	spinner.start();

	let upgraded = false;
	const errors: string[] = [];

	for (const pmName of candidates) {
		const args = getInstallArgs(pmName, `${PKG}@latest`);
		if (!args) continue;

		spinner.update(`Upgrading via ${pmName}...`);

		const result = await runCommand(pmName, args, {
			stdio: ctx.json ? "pipe" : "inherit",
		});

		if (result.exitCode === 0) {
			spinner.succeed(`kapy upgraded via ${pmName}`);
			upgraded = true;
			break;
		}

		errors.push(`${pmName}: ${result.stderr.trim().split("\n").pop() ?? `exit code ${result.exitCode}`}`);
	}

	if (!upgraded) {
		const hint = candidates.map((pm) => `${pm} ${getInstallArgs(pm, `${PKG}@latest`)?.join(" ") ?? ""}`).join("\n  ");
		spinner.fail(`Failed to upgrade kapy. Try manually:\n  ${hint}`);
	}

	if (ctx.json) {
		console.log(
			JSON.stringify({
				status: upgraded ? "success" : "error",
				packageManager: upgraded ? candidates[0] : undefined,
				available,
				...(errors.length ? { errors } : {}),
			}),
		);
	}
};
