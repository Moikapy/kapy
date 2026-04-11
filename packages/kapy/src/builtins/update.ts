/** kapy update — update all or a specific extension */
import { execSync } from "node:child_process";
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

export const updateCommand = async (ctx: CommandContext): Promise<void> => {
	const positionalArgs = (ctx.args as Record<string, unknown>).rest as string[] | undefined;
	const name = positionalArgs?.[0];

	const manifestPath = join(homedir(), ".kapy", "extensions.json");
	let manifest: Record<string, ExtensionEntry> = {};
	try {
		const content = await readFile(manifestPath, "utf-8");
		manifest = JSON.parse(content);
	} catch {
		if (ctx.json) {
			console.log(JSON.stringify({ status: "error", message: "No extensions installed" }));
		} else {
			ctx.warn("No extensions installed.");
		}
		return;
	}

	const entries = name ? { [name]: manifest[name] } : manifest;
	let updated = 0;

	for (const [extName, info] of Object.entries(entries)) {
		if (!info) {
			ctx.warn(`Extension "${extName}" not found.`);
			continue;
		}

		const spinner = ctx.spinner(`Updating ${extName}...`);
		spinner.start();

		try {
			if (info.source.startsWith("npm:")) {
				const pkg = info.source.slice(4);
				execSync(`bun add -g ${pkg}`, { stdio: ctx.json ? "pipe" : "inherit" });
				manifest[extName].installedAt = new Date().toISOString();
				updated++;
				spinner.succeed(`Updated ${extName}`);
			} else if (info.source.startsWith("git:")) {
				const extDir = join(homedir(), ".kapy", "extensions", extName);
				execSync(`git -C ${extDir} pull`, { stdio: ctx.json ? "pipe" : "inherit" });
				manifest[extName].installedAt = new Date().toISOString();
				updated++;
				spinner.succeed(`Updated ${extName}`);
			} else {
				spinner.stop();
				ctx.warn(`Cannot update local extension: ${extName}`);
			}
		} catch {
			spinner.fail(`Failed to update ${extName}`);
		}
	}

	await writeFile(manifestPath, JSON.stringify(manifest, null, 2));

	if (ctx.json) {
		console.log(JSON.stringify({ status: "success", updated }));
	} else if (!name) {
		ctx.log(`Updated ${updated} extension(s).`);
	}
};