/** Home screen — kapy welcome and overview */
import type { ScreenDefinition } from "../../extension/types.js";

export const homeScreen: ScreenDefinition = {
	name: "home",
	label: "Home",
	icon: "🐹",
	render: () =>
		[
			"",
			"  🐹 kapy — the pi.dev for CLI",
			"",
			"  An extensible CLI framework with first-class support for",
			"  extensions, hooks, middleware, and a built-in TUI.",
			"",
			"  Navigate with ↑↓ arrows and press Enter to select.",
			"  Press q to quit, Esc to go back.",
			"",
		].join("\n"),
	keyBindings: { q: "quit" },
};
