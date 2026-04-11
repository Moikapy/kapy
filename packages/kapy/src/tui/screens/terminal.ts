/** Terminal screen — built-in command execution */
import type { ScreenDefinition } from "../../extension/types.js";

export const terminalScreen: ScreenDefinition = {
	name: "terminal",
	label: "Terminal",
	icon: "⚡",
	render: () =>
		[
			"",
			"  ⚡ Built-in Terminal",
			"",
			"  Run kapy commands from within the TUI.",
			"",
			"  Type a command and press Enter to execute.",
			"  Press Esc to return to the menu.",
			"",
		].join("\n"),
	keyBindings: { q: "quit" },
};
