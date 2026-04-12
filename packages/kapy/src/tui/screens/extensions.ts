/** Extensions screen — display installed extensions with status */
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ScreenDefinition } from "../../extension/types.js";

export const extensionsScreen: ScreenDefinition = {
	name: "extensions",
	label: "Extensions",
	icon: "📦",
	render: async () => {
		let manifest: Record<string, { version: string; source: string; installedAt?: string }> = {};
		try {
			const content = await readFile(join(homedir(), ".kapy", "extensions.json"), "utf-8");
			manifest = JSON.parse(content);
		} catch {
			// No extensions yet
		}

		const entries = Object.entries(manifest);
		const lines = ["", "  📦 Extensions Manager", ""];

		if (entries.length === 0) {
			lines.push("  No extensions installed.");
			lines.push("");
			lines.push("  Use 'kapy install <source>' to add one.");
			lines.push("    npm:@scope/kapy-ext       from npm");
			lines.push("    git:github.com/user/repo   from git");
			lines.push("    ./path/to/ext             local path");
		} else {
			lines.push(`  ${entries.length} extension${entries.length !== 1 ? "s" : ""} installed:`);
			lines.push("");
			for (const [name, info] of entries) {
				lines.push(`  ${name.padEnd(30)} v${info.version.padEnd(8)} ${info.source}`);
			}
			lines.push("");
			lines.push("  Commands:");
			lines.push("    kapy install <source>  Install an extension");
			lines.push("    kapy update [name]     Update extension(s)");
			lines.push("    kapy remove <name>     Remove an extension");
		}

		lines.push("");
		return lines.join("\n");
	},
	keyBindings: { q: "quit", u: "update", i: "install" },
};
