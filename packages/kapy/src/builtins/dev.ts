/** kapy dev — run CLI in dev mode with hot reload */

import { spawn } from "node:child_process";
import { unwatchFile, watchFile } from "node:fs";
import { resolve } from "node:path";
import type { CommandContext } from "../command/context.js";

export const devCommand = async (ctx: CommandContext): Promise<void> => {
	const debug = ctx.args.debug as boolean;
	const configPath = resolve(process.cwd(), "kapy.config.ts");

	ctx.log(`Starting dev mode${debug ? " (debug)" : ""}...`);
	ctx.log(`Watching: ${configPath}`);

	let child: ReturnType<typeof spawn> | null = null;
	let restarting = false;

	function startProcess(): void {
		if (restarting) return;
		restarting = true;

		if (child) {
			child.kill("SIGTERM");
			child = null;
		}

		// Re-spawn the kapy process with all args after "dev"
		const argv = process.argv.slice(2).filter((a) => a !== "dev" && a !== "--debug" && a !== "-d");

		child = spawn("bun", ["run", require.resolve("../cli.js"), ...argv], {
			stdio: "inherit",
			env: {
				...process.env,
				KAPY_DEV: "1",
				...(debug ? { KAPY_DEBUG: "1" } : {}),
			},
		});

		child.on("exit", (code) => {
			if (code !== null && code !== 0 && !restarting) {
				if (debug) ctx.warn(`Process exited with code ${code}`);
			}
		});

		restarting = false;
	}

	// Start initial process
	startProcess();

	// Watch kapy.config.ts for changes
	try {
		watchFile(configPath, { interval: 500 }, () => {
			ctx.log("Config changed. Restarting...");
			startProcess();
		});
	} catch {
		if (debug) ctx.warn(`Could not watch ${configPath} — file not found`);
	}

	// Watch extension dirs
	const extensionsDir = resolve(process.cwd(), ".kapy", "extensions");
	try {
		watchFile(extensionsDir, { interval: 1000 }, () => {
			ctx.log("Extensions changed. Restarting...");
			startProcess();
		});
	} catch {
		// No extensions dir
	}

	// Handle graceful shutdown
	const shutdown = (): void => {
		ctx.log("\nShutting down dev mode...");
		unwatchFile(configPath);
		unwatchFile(extensionsDir);
		if (child) child.kill("SIGTERM");
		process.exit(0);
	};

	process.on("SIGINT", shutdown);
	process.on("SIGTERM", shutdown);

	// Keep process alive
	await new Promise(() => {});
};
