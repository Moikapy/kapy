/** kapy remove — uninstall an extension */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import type { CommandContext } from "../command/context.js";

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