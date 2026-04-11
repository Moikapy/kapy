/** Extensions screen — browse, install, remove, configure extensions */
import type { ScreenDefinition } from "../../extension/types.js";

export const extensionsScreen: ScreenDefinition = {
	name: "extensions",
	label: "Extensions",
	icon: "📦",
	render: () => "Extensions manager",
	keyBindings: { q: "quit" },
};