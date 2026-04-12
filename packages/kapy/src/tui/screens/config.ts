/** Config screen — display kapy configuration by namespace */
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ScreenDefinition } from "../../extension/types.js";

export const configScreen: ScreenDefinition = {
	name: "config",
	label: "Config",
	icon: "🔧",
	render: async () => {
		const lines = ["", "  🔧 Configuration", ""];

		// Project config
		try {
			const content = await readFile(join(process.cwd(), "kapy.config.ts"), "utf-8");
			const hasContent = content.trim().length > 0;
			lines.push("  Project config (kapy.config.ts):");
			lines.push(`    Status: ${hasContent ? "Present" : "Empty"}`);
		} catch {
			lines.push("  Project config: Not found");
		}
		lines.push("");

		// Global config
		let globalConfig: Record<string, unknown> = {};
		try {
			const content = await readFile(join(homedir(), ".kapy", "config.json"), "utf-8");
			globalConfig = JSON.parse(content);
			lines.push("  Global config (~/.kapy/config.json):");
			const extConfig = globalConfig.extensions as Record<string, unknown> | undefined;
			if (extConfig) {
				for (const [name, settings] of Object.entries(extConfig)) {
					lines.push(`    [${name}]`);
					if (typeof settings === "object" && settings !== null) {
						for (const [k, v] of Object.entries(settings as Record<string, unknown>)) {
							lines.push(`      ${k} = ${JSON.stringify(v)}`);
						}
					}
				}
			}
		} catch {
			lines.push("  Global config: Not found");
		}
		lines.push("");

		lines.push("  Config hierarchy (highest priority wins):");
		lines.push("    1. CLI flags");
		lines.push("    2. Environment variables (KAPY_*)");
		lines.push("    3. Global config (~/.kapy/config.json)");
		lines.push("    4. Project config (kapy.config.ts)");
		lines.push("    5. kapy defaults");
		lines.push("");
		lines.push("  Use 'kapy config <key>' to read or 'kapy config <key> <value>' to set.");
		lines.push("");

		return lines.join("\n");
	},
	keyBindings: { q: "quit", e: "edit" },
};