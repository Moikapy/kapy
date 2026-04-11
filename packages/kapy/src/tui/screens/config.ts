/** Config screen — edit kapy configuration interactively */
import type { ScreenDefinition } from "../../extension/types.js";

export const configScreen: ScreenDefinition = {
	name: "config",
	label: "Config",
	icon: "🔧",
	render: () => "Configuration editor",
	keyBindings: { q: "quit" },
};
