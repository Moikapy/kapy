/** kapy list — show installed extensions */
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { CommandContext } from "../command/context.js";
import type { ExtensionMeta } from "../extension/types.js";

interface ExtensionEntry {
	version: string;
	source: string;
	checksum?: string;
	installedAt: string;
}

/** Try to load extension metadata for a source */
async function loadExtMeta(source: string): Promise<ExtensionMeta | null> {
	const extensionsDir = join(homedir(), ".kapy", "extensions");
	try {
		const { resolveExtensionSource } = await import("../extension/loader.js");
		const resolvedPath = await resolveExtensionSource(source, extensionsDir);
		const mod = await import(resolvedPath);
		return mod.meta ?? mod.default?.meta ?? null;
	} catch {
		return null;
	}
}

export const listCommand = async (ctx: CommandContext): Promise<void> => {
	const showPermissions = ctx.args["show-permissions"] as boolean;
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
		const extensions = await Promise.all(
			entries.map(async ([name, info]) => {
				const entry: Record<string, unknown> = { name, ...info };
				if (showPermissions) {
					const meta = await loadExtMeta(info.source);
					entry.permissions = meta?.permissions ?? [];
				}
				return entry;
			}),
		);
		console.log(JSON.stringify({ extensions }));
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

		if (showPermissions) {
			const meta = await loadExtMeta(info.source);
			if (meta?.permissions?.length) {
				ctx.log(`    ⚠️  Permissions: ${meta.permissions.join(", ")} (documentation only)`);
			} else {
				ctx.log(`    Permissions: none declared`);
			}
		}
	}
};
