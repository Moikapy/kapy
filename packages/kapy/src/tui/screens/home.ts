/** Home screen — overview of installed extensions and recent activity */
import type { ScreenDefinition } from "../../extension/types.js";

export const homeScreen: ScreenDefinition = {
	name: "home",
	label: "Home",
	icon: "📊",
	render: () => "Welcome to kapy",
	keyBindings: { q: "quit" },
};