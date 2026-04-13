/** kapy remove — uninstall an extension */
import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { CommandContext } from "../command/context.js";
import { detectPackageManagers } from "./package-managers.js";

/** Run a command safely without shell injection */
async function runCommand(
	command: string,
	args: string[],
	options?: { cwd?: string; stdio?: "pipe" | "inherit" },
): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
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
function getUninstallArgs(pmName: string, pkg: string): string[] {
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

interface ExtensionEntry {
	version: string;
	source: string;
	checksum?: string;
	installedAt: string;
}

export const removeCommand = async (ctx: CommandContext): Promise<void> => {
	const positionalArgs = (ctx.args as Record<string, unknown>).rest as string[] | undefined;
	const name = positionalArgs?.[0];

	if (!name) {
		ctx.error("Usage: kapy remove <extension-name>");
		ctx.abort(2);
	}

	const manifestPath = join(homedir(), ".kapy", "extensions.json");
	let manifest: Record<string, ExtensionEntry> = {};
	try {
		const content = await readFile(manifestPath, "utf-8");
		manifest = JSON.parse(content);
	} catch {
		ctx.error("No extensions installed.");
		return;
	}

	if (!manifest[name]) {
		ctx.error(`Extension "${name}" not found.`);
		return;
	}

	const info = manifest[name];
	const spinner = ctx.spinner(`Removing ${name}...`);
	spinner.start();

	// Uninstall via package manager for npm-installed extensions
	if (info.source.startsWith("npm:")) {
		const pkg = info.source.slice(4);
		const available = detectPackageManagers();
		const pm = available[0] ?? "npm";
		const args = getUninstallArgs(pm, pkg);
		const result = await runCommand(pm, args, {
			stdio: ctx.json ? "pipe" : "inherit",
		});
		if (result.exitCode !== 0 && result.exitCode !== null) {
			// Uninstall failed but continue cleanup — the package might
			// not be installed globally (e.g. was a local install)
			if (!ctx.json) {
				ctx.warn(`Package manager uninstall returned exit code ${result.exitCode}, continuing cleanup.`);
			}
		}
	}

	// For git extensions, remove the cloned directory
	if (info.source.startsWith("git:")) {
		const extDir = join(homedir(), ".kapy", "extensions", name);
		try {
			const { rm } = await import("node:fs/promises");
			await rm(extDir, { recursive: true, force: true });
		} catch {
			// Directory may not exist
		}
	}

	// Remove from manifest
	delete manifest[name];
	await writeFile(manifestPath, JSON.stringify(manifest, null, 2));

	// Remove from global config
	const configPath = join(homedir(), ".kapy", "config.json");
	try {
		const content = await readFile(configPath, "utf-8");
		const globalConfig = JSON.parse(content) as Record<string, unknown>;
		if (globalConfig.extensions && typeof globalConfig.extensions === "object") {
			delete (globalConfig.extensions as Record<string, unknown>)[name];
			await writeFile(configPath, JSON.stringify(globalConfig, null, 2));
		}
	} catch {
		// No global config
	}

	spinner.succeed(`Removed ${name}`);

	if (ctx.json) {
		console.log(JSON.stringify({ status: "success", removed: name }));
	}
};
