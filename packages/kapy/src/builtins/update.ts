/** kapy update — update all or a specific extension */
import { readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { CommandContext } from "../command/context.js";
import { detectPackageManagers, getInstallArgs } from "./package-managers.js";
import { runCommand } from "./spawn-helper.js";

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

	// Detect available package managers once
	const available = detectPackageManagers();
	const pm = available[0] ?? "npm";

	for (const [extName, info] of Object.entries(entries)) {
		if (!info) {
			ctx.warn(`Extension "${extName}" not found.`);
			continue;
		}

		const spinner = ctx.spinner(`Updating ${extName}...`);
		spinner.start();

		try {
			let result: { stdout: string; stderr: string; exitCode: number | null };

			if (info.source.startsWith("npm:")) {
				const pkg = info.source.slice(4);
				const args = getInstallArgs(pm, pkg) ?? ["install", "-g", pkg];
				result = await runCommand(pm, args, {
					stdio: ctx.json ? "pipe" : "inherit",
				});
				if (result.exitCode === 0 || result.exitCode === null) {
					manifest[extName].installedAt = new Date().toISOString();
					updated++;
					spinner.succeed(`Updated ${extName}`);
				} else {
					spinner.fail(`Failed to update ${extName}`);
				}
			} else if (info.source.startsWith("git:")) {
				const extDir = join(homedir(), ".kapy", "extensions", extName);
				result = await runCommand("git", ["-C", extDir, "pull"], {
					stdio: ctx.json ? "pipe" : "inherit",
				});
				if (result.exitCode === 0 || result.exitCode === null) {
					manifest[extName].installedAt = new Date().toISOString();
					updated++;
					spinner.succeed(`Updated ${extName}`);
				} else {
					spinner.fail(`Failed to update ${extName}`);
				}
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
