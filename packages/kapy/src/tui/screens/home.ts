/** Home screen — kapy welcome and overview with live extension count */
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ScreenDefinition } from "../../extension/types.js";

export const homeScreen: ScreenDefinition = {
	name: "home",
	label: "Home",
	icon: "🐹",
	render: async () => {
		// Load extension count from manifest
		let extCount = 0;
		try {
			const content = await readFile(join(homedir(), ".kapy", "extensions.json"), "utf-8");
			const manifest = JSON.parse(content);
			extCount = Object.keys(manifest).length;
		} catch {
			// No extensions yet
		}

		const lines = [
			"",
			"  🐹 kapy — the pi.dev for CLI",
			"",
			"  An extensible CLI framework with first-class support for",
			"  extensions, hooks, middleware, and a built-in TUI.",
			"",
			`  📦 ${extCount} extension${extCount !== 1 ? "s" : ""} installed`,
			"",
			"  Quick Reference:",
			"    kapy install <source>   Install an extension",
			"    kapy list               List extensions",
			"    kapy commands           Show all commands",
			"    kapy config             View/edit config",
			"",
			"  Navigation:",
			"    ↑↓     Move between screens",
			"    Enter  Select a screen",
			"    Esc    Go back",
			"    q      Quit",
			"",
		];
		return lines.join("\n");
	},
	keyBindings: { q: "quit", r: "refresh" },
};