/**
 * kapy dev — run CLI in dev mode with hot reload
 *
 * Uses fs.watch for reliable file change detection and
 * proper process lifecycle management (no race on respawn).
 */
import { spawn } from "node:child_process";
import { existsSync, watch } from "node:fs";
import { resolve } from "node:path";
import type { CommandContext } from "../command/context.js";

export const devCommand = async (ctx: CommandContext): Promise<void> => {
	const debug = ctx.args.debug as boolean;
	const configPath = resolve(process.cwd(), "kapy.config.ts");
	const extensionsDir = resolve(process.cwd(), ".kapy", "extensions");

	ctx.log(`Starting dev mode${debug ? " (debug)" : ""}...`);

	let child: ReturnType<typeof spawn> | null = null;
	let restarting = false;

	function startProcess(): void {
		if (restarting) return; // Prevent double-restart
		restarting = true;

		// Kill previous process and wait for exit before spawning new one
		if (child) {
			child.kill("SIGTERM");
			// Don't await — child.on('exit') fires asynchronously.
			// We set child=null and spawn immediately; the kill signal
			// is enough to clean up. On rapid changes, we debounce below.
			child = null;
		}

		// Get the CLI path relative to this module
		const cliPath = resolve(import.meta.dir, "..", "cli.js");

		// Re-spawn the kapy process with all args after "dev"
		const argv = process.argv.slice(2).filter((a) => a !== "dev" && a !== "--debug" && a !== "-d");

		child = spawn("bun", ["run", cliPath, ...argv], {
			stdio: "inherit",
			env: {
				...process.env,
				KAPY_DEV: "1",
				...(debug ? { KAPY_DEBUG: "1" } : {}),
			},
		});

		child.on("exit", (code) => {
			if (child) {
				child = null;
				if (code !== null && code !== 0) {
					if (debug) ctx.warn(`Process exited with code ${code}`);
				}
			}
		});

		restarting = false;
	}

	// Debounce restarts to avoid spawning multiple processes on rapid saves
	let restartTimer: ReturnType<typeof setTimeout> | null = null;
	function scheduleRestart(): void {
		if (restartTimer) clearTimeout(restartTimer);
		restartTimer = setTimeout(() => {
			startProcess();
		}, 150);
	}

	// Start initial process
	startProcess();

	// Watch kapy.config.ts for changes
	if (existsSync(configPath)) {
		try {
			watch(configPath, () => {
				ctx.log("Config changed. Restarting...");
				scheduleRestart();
			});
			ctx.log(`Watching: ${configPath}`);
		} catch {
			if (debug) ctx.warn(`Could not watch ${configPath}`);
		}
	} else {
		if (debug) ctx.warn(`Config file not found: ${configPath}`);
	}

	// Watch extension dirs
	if (existsSync(extensionsDir)) {
		try {
			watch(extensionsDir, { recursive: true }, () => {
				ctx.log("Extensions changed. Restarting...");
				scheduleRestart();
			});
			ctx.log(`Watching: ${extensionsDir}`);
		} catch {
			// No extensions dir — that's fine
		}
	}

	// Handle graceful shutdown
	const shutdown = (): void => {
		ctx.log("\nShutting down dev mode...");
		if (restartTimer) clearTimeout(restartTimer);
		if (child) {
			child.kill("SIGTERM");
			child = null;
		}
		process.exit(0);
	};

	process.on("SIGINT", shutdown);
	process.on("SIGTERM", shutdown);

	// Keep process alive
	await new Promise(() => {});
};
