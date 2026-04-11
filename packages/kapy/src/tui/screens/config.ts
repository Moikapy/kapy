/** Config screen — view and edit kapy configuration */
import type { ScreenDefinition } from "../../extension/types.js";

export const configScreen: ScreenDefinition = {
	name: "config",
	label: "Config",
	icon: "🔧",
	render: () =>
		[
			"",
			"  🔧 Configuration",
			"",
			"  View and edit kapy configuration.",
			"",
			"  Commands:",
			"    kapy config get <key>    Get a config value",
			"    kapy config set <key> <value>  Set a config value",
			"    kapy config list         List all config values",
			"",
			"  Config hierarchy (highest priority wins):",
			"    1. CLI flags (--json, --no-input)",
			"    2. Environment variables (KAPY_*)",
			"    3. Global config (~/.kapy/config.json)",
			"    4. Project config (kapy.config.ts)",
			"    5. kapy defaults",
			"",
		].join("\n"),
	keyBindings: { q: "quit" },
};
