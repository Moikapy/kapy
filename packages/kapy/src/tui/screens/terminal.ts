/** Terminal screen — built-in terminal for running commands */
import type { ScreenDefinition } from "../../extension/types.js";

export const terminalScreen: ScreenDefinition = {
	name: "terminal",
	label: "Terminal",
	icon: "⚡",
	render: () => "Built-in terminal",
	keyBindings: { q: "quit" },
};
