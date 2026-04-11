/** kapy upgrade — upgrade kapy itself to the latest version */
import { execSync } from "node:child_process";
import type { CommandContext } from "../command/context.js";

export const upgradeCommand = async (ctx: CommandContext): Promise<void> => {
	const spinner = ctx.spinner("Checking for kapy updates...");
	spinner.start();

	try {
		// Try bun first, then npm
		let currentVersion = "unknown";
		try {
			currentVersion = execSync("bun pm ls -g kapy 2>/dev/null || npm ls -g kapy --depth=0 --json 2>/dev/null", {
				encoding: "utf-8",
				stdio: ["pipe", "pipe", "pipe"],
			}).trim();
		} catch {
			// Version detection failed
		}

		spinner.update("Upgrading kapy...");

		try {
			execSync("bun add -g kapy@latest", { stdio: ctx.json ? "pipe" : "inherit" });
			spinner.succeed("kapy upgraded to latest version");
		} catch {
			// Fall back to npm
			try {
				execSync("npm install -g kapy@latest", { stdio: ctx.json ? "pipe" : "inherit" });
				spinner.succeed("kapy upgraded to latest version");
			} catch {
				spinner.fail("Failed to upgrade kapy. Try running: bun add -g kapy@latest");
			}
		}

		if (ctx.json) {
			console.log(JSON.stringify({ status: "success", previousVersion: currentVersion }));
		}
	} catch (err) {
		spinner.fail("Upgrade failed");
		throw err;
	}
};
