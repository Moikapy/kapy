/**
 * TUI shell — kapy tui command. Launches OpenTUI-based interactive UI.
 *
 * Extensions register screens via api.addScreen().
 * The TUI provides sidebar navigation, main area rendering, and status bar.
 */
import { CommandContext } from "../command/context.js";
import type { ScreenDefinition } from "../extension/types.js";

export interface TUIOptions {
	screens: ScreenDefinition[];
	initialScreen?: string;
}

/** Built-in home screen */
export const homeScreen: ScreenDefinition = {
	name: "home",
	label: "Home",
	icon: "📊",
	render: () => "Welcome to kapy",
	keyBindings: { q: "quit" },
};

/** Built-in extensions screen */
export const extensionsScreen: ScreenDefinition = {
	name: "extensions",
	label: "Extensions",
	icon: "📦",
	render: () => "Extensions manager",
	keyBindings: { q: "quit" },
};

/** Built-in config screen */
export const configScreen: ScreenDefinition = {
	name: "config",
	label: "Config",
	icon: "🔧",
	render: () => "Configuration editor",
	keyBindings: { q: "quit" },
};

/** Built-in terminal screen */
export const terminalScreen: ScreenDefinition = {
	name: "terminal",
	label: "Terminal",
	icon: "⚡",
	render: () => "Built-in terminal",
	keyBindings: { q: "quit" },
};

/** Launch the TUI shell */
export async function launchTUI(options: TUIOptions, ctx: CommandContext): Promise<void> {
	if (ctx.noInput || ctx.json) {
		ctx.error("TUI requires an interactive terminal. Use commands without --json or --no-input.");
		process.exit(2);
	}

	const allScreens = [homeScreen, extensionsScreen, configScreen, terminalScreen, ...options.screens];

	if (ctx.json) return; // shouldn't reach here due to check above

	// TODO: Implement OpenTUI renderer integration
	// For MVP, print a summary and exit
	ctx.log("kapy TUI");
	ctx.log("");
	ctx.log("Available screens:");
	for (const screen of allScreens) {
		ctx.log(`  ${screen.icon ?? " "} ${screen.label} (${screen.name})`);
	}
	ctx.log("");
	ctx.log("TUI requires @opentui/core to be available. Coming soon.");
}