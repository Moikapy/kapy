/** kapy list — show installed extensions */
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { CommandContext } from "../command/context.js";

interface ExtensionEntry {
	version: string;
	source: string;
	checksum?: string;
	installedAt: string;
}

export const listCommand = async (ctx: CommandContext): Promise<void> => {
	const manifestPath = join(homedir(), ".kapy", "extensions.json");

	let manifest: Record<string, ExtensionEntry> = {};
	try {
		const content = await readFile(manifestPath, "utf-8");
		manifest = JSON.parse(content);
	} catch {
		// No extensions installed
	}

	const entries = Object.entries(manifest);

	if (ctx.json) {
		console.log(JSON.stringify({ extensions: entries.map(([name, info]) => ({ name, ...info })) }));
		return;
	}

	if (entries.length === 0) {
		ctx.log("No extensions installed.");
		ctx.log("Use 'kapy install <source>' to add one.");
		return;
	}

	ctx.log("Installed extensions:");
	for (const [name, info] of entries) {
		ctx.log(`  ${name.padEnd(30)} ${info.version.padEnd(10)} ${info.source}`);
	}
};
