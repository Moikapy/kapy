/**
 * TUI shell — kapy tui command. Launches interactive terminal UI.
 *
 * Uses OpenTUI when available, falls back to text-mode TUI.
 */
import { createInterface } from "node:readline";
import { CommandContext } from "../command/context.js";
import pc from "picocolors";
import type { ScreenDefinition } from "../extension/types.js";

export interface TUIOptions {
	screens: ScreenDefinition[];
	initialScreen?: string;
}

/** Capybara ASCII art for the home screen */
const CAPYBARA = `
   ┌─────┐
   │ ◕ ◕ │   🐹 kapy
   │  ∪  │   the pi.dev for CLI
   └─┬──┘
     ╰─╯
`;

/** Built-in screens */
export const homeScreen: ScreenDefinition = {
	name: "home",
	label: "Home",
	icon: "🐹",
	render: () => CAPYBARA,
	keyBindings: { q: "quit" },
};

export const extensionsScreen: ScreenDefinition = {
	name: "extensions",
	label: "Extensions",
	icon: "📦",
	render: () => "Extensions manager — use 'kapy list' to see installed extensions",
	keyBindings: { q: "quit" },
};

export const configScreen: ScreenDefinition = {
	name: "config",
	label: "Config",
	icon: "🔧",
	render: () => "Configuration editor — use 'kapy config' to view/edit settings",
	keyBindings: { q: "quit" },
};

export const terminalScreen: ScreenDefinition = {
	name: "terminal",
	label: "Terminal",
	icon: "⚡",
	render: () => "Built-in terminal — type commands to execute",
	keyBindings: { q: "quit" },
};

/** Render the sidebar */
function renderSidebar(screens: ScreenDefinition[], activeIndex: number): string {
	const lines: string[] = [];
	lines.push(pc.bold(pc.cyan("  🐹 kapy")));
	lines.push(pc.dim("  ────────────────────"));
	for (let i = 0; i < screens.length; i++) {
		const screen = screens[i];
		const prefix = i === activeIndex ? pc.cyan("▸") : " ";
		const label = i === activeIndex ? pc.cyan(pc.bold(screen.label)) : screen.label;
		lines.push(`${prefix} ${screen.icon ?? " "} ${label}`);
	}
	lines.push(pc.dim("  ────────────────────"));
	lines.push(pc.dim("  q: quit  ↑↓: nav  ↵: select"));
	return lines.join("\n");
}

/** Render a screen */
function renderScreen(screen: ScreenDefinition): string {
	const lines: string[] = [];
	lines.push(pc.bold(`  ${screen.icon ?? "▸"} ${screen.label}`));
	lines.push(pc.dim("  ────────────────────────────────────"));
	const content = screen.render({});
	if (typeof content === "string") {
		lines.push(content);
	}
	lines.push("");
	lines.push(pc.dim("  q: quit  Esc: back"));
	return lines.join("\n");
}

/** Launch the TUI shell */
export async function launchTUI(options: TUIOptions, ctx: CommandContext): Promise<void> {
	if (ctx.noInput || ctx.json) {
		ctx.error("TUI requires an interactive terminal. Use commands without --json or --no-input.");
		process.exit(2);
	}

	if (!process.stdout.isTTY) {
		ctx.error("TUI requires an interactive terminal (TTY).");
		process.exit(2);
	}

	const allScreens = [homeScreen, extensionsScreen, configScreen, terminalScreen, ...options.screens];
	let activeIndex = allScreens.findIndex((s) => s.name === options.initialScreen);
	if (activeIndex === -1) activeIndex = 0;
	let currentView: "sidebar" | "screen" = options.initialScreen ? "screen" : "sidebar";

	const rl = createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	const clearScreen = (): void => {
		process.stdout.write("\x1b[2J\x1b[H");
	};

	const draw = (): void => {
		clearScreen();
		if (currentView === "sidebar") {
			process.stdout.write(renderSidebar(allScreens, activeIndex));
		} else {
			process.stdout.write(renderScreen(allScreens[activeIndex]));
		}
	};

	draw();

	return new Promise<void>((resolve) => {
		rl.on("line", (input) => {
			const key = input.trim().toLowerCase();

			if (key === "q" || key === "quit" || key === "exit") {
				clearScreen();
				console.log(pc.dim("Goodbye! 🐹"));
				rl.close();
				resolve();
				return;
			}

			if (currentView === "sidebar") {
				if (key === "up" || key === "k") {
					activeIndex = Math.max(0, activeIndex - 1);
				} else if (key === "down" || key === "j") {
					activeIndex = Math.min(allScreens.length - 1, activeIndex + 1);
				} else if (key === "" || key === "enter") {
					currentView = "screen";
				} else {
					const num = Number.parseInt(key);
					if (!Number.isNaN(num) && num >= 1 && num <= allScreens.length) {
						activeIndex = num - 1;
						currentView = "screen";
					} else {
						const match = allScreens.findIndex((s) => s.name === key);
						if (match !== -1) {
							activeIndex = match;
							currentView = "screen";
						}
					}
				}
			} else {
				if (key === "escape" || key === "esc" || key === "back") {
					currentView = "sidebar";
				}
			}

			draw();
		});

		rl.on("close", () => {
			resolve();
		});
	});
}