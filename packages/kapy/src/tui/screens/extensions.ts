/** Extensions screen — manage installed extensions */
import type { ScreenDefinition } from "../../extension/types.js";

export const extensionsScreen: ScreenDefinition = {
	name: "extensions",
	label: "Extensions",
	icon: "📦",
	render: () =>
		[
			"",
			"  📦 Extensions Manager",
			"",
			"  Manage your kapy extensions.",
			"",
			"  Commands:",
			"    kapy install <source>  Install an extension",
			"    kapy list              List installed extensions",
			"    kapy update [name]     Update an extension",
			"    kapy remove <name>     Remove an extension",
			"",
		].join("\n"),
	keyBindings: { q: "quit" },
};
