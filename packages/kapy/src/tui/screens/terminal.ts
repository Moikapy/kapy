/** Terminal screen — built-in command execution with input prompt */
import type { ScreenDefinition } from "../../extension/types.js";

export const terminalScreen: ScreenDefinition = {
	name: "terminal",
	label: "Terminal",
	icon: "⚡",
	render: () => {
		const lines = [
			"",
			"  ⚡ Built-in Terminal",
			"",
			"  Run kapy commands from within the TUI.",
			"",
			"  Quick commands:",
			"    kapy list               List extensions",
			"    kapy commands           Show commands",
			"    kapy config             View config",
			"    kapy inspect            Full state dump",
			"",
			"  Type a command and press Enter to execute.",
			"  Press Esc to return to the menu.",
			"",
		];
		return lines.join("\n");
	},
	keyBindings: { q: "quit", ":": "command-mode" },
};
