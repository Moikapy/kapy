/**
 * TUI shell — kapy tui command. Launches interactive terminal UI using OpenTUI.
 *
 * Uses @opentui/core for rendering. Falls back gracefully if TTY is unavailable.
 * IMPORTANT: Uses renderer.destroy() for cleanup, never process.exit().
 */
import {
	ASCIIFontRenderable,
	BoxRenderable,
	type CliRenderer,
	createCliRenderer,
	type Renderable,
	RGBA,
	ScrollBoxRenderable,
	TextRenderable,
} from "@opentui/core";
import type { CommandContext } from "../command/context.js";
import type { ScreenContext, ScreenDefinition } from "../extension/types.js";
import { configScreen } from "./screens/config.js";
import { extensionsScreen } from "./screens/extensions.js";
import { homeScreen } from "./screens/home.js";
import { terminalScreen } from "./screens/terminal.js";

export interface TUIOptions {
	screens: ScreenDefinition[];
	initialScreen?: string;
}

/** Build the sidebar */
function buildSidebar(renderer: CliRenderer, screens: ScreenDefinition[], activeIndex: number): BoxRenderable {
	const sidebar = new BoxRenderable(renderer, {
		id: "sidebar",
		width: 24,
		flexDirection: "column",
		padding: 1,
		border: true,
		borderStyle: "single",
		borderColor: RGBA.fromHex("#444466"),
		backgroundColor: RGBA.fromHex("#1a1a2e"),
	} as never);

	// Title
	const title = new ASCIIFontRenderable(renderer, {
		id: "sidebar-title",
		text: "KAPY",
		font: "tiny",
		color: RGBA.fromHex("#00AAFF"),
	});
	sidebar.add(title as never);

	// Separator
	const sep = new TextRenderable(renderer, {
		id: "sidebar-sep",
		content: "────────────────",
		fg: RGBA.fromHex("#444466"),
	});
	sidebar.add(sep as never);

	// Nav items
	for (let i = 0; i < screens.length; i++) {
		const screen = screens[i];
		const isActive = i === activeIndex;
		const prefix = isActive ? " ▸ " : "   ";
		const label = `${prefix}${screen.icon ?? " "} ${screen.label}`;
		const item = new TextRenderable(renderer, {
			id: `nav-${screen.name}`,
			content: label,
			fg: isActive ? RGBA.fromHex("#00AAFF") : RGBA.fromHex("#888888"),
		});
		sidebar.add(item as never);
	}

	return sidebar;
}

/** Build the main content area */
async function buildMainContent(
	renderer: CliRenderer,
	screen: ScreenDefinition,
	width: number,
	height: number,
): Promise<BoxRenderable> {
	const screenCtx: ScreenContext = {
		renderer,
		width,
		height,
	};
	const content = await screen.render(screenCtx);
	const text = typeof content === "string" ? content : String(content);

	const scrollbox = new ScrollBoxRenderable(renderer, {
		id: `screen-${screen.name}`,
		width,
		height,
		showScrollbar: true,
	} as never);

	const contentText = new TextRenderable(renderer, {
		id: `content-${screen.name}`,
		content: text,
		fg: RGBA.fromHex("#c0caf5"),
		selectable: true,
	});
	scrollbox.add(contentText as never);

	const panel = new BoxRenderable(renderer, {
		id: "main-panel",
		flexDirection: "column",
		padding: 1,
		border: true,
		borderStyle: "rounded",
		borderColor: RGBA.fromHex("#444466"),
		backgroundColor: RGBA.fromHex("#16161e"),
	} as never);
	panel.add(scrollbox as never);
	return panel;
}

/** Build the status bar */
function buildStatusBar(renderer: CliRenderer, width: number): BoxRenderable {
	const bar = new BoxRenderable(renderer, {
		id: "statusbar",
		width,
		padding: 1,
		backgroundColor: RGBA.fromHex("#222233"),
	} as never);
	const text = new TextRenderable(renderer, {
		id: "statusbar-text",
		content: "q: quit  ↑↓: navigate  ↵: select  Esc: back",
		fg: RGBA.fromHex("#888888"),
	});
	bar.add(text as never);
	return bar;
}

/** Launch the TUI shell */
export async function launchTUI(options: TUIOptions, ctx: CommandContext): Promise<void> {
	if (ctx.noInput || ctx.json) {
		ctx.error("TUI requires an interactive terminal. Use commands without --json or --no-input.");
		return;
	}

	if (!process.stdout.isTTY) {
		ctx.error("TUI requires an interactive terminal (TTY).");
		return;
	}

	const allScreens: ScreenDefinition[] = [
		homeScreen,
		extensionsScreen,
		configScreen,
		terminalScreen,
		...options.screens,
	];
	let activeIndex = allScreens.findIndex((s) => s.name === options.initialScreen);
	if (activeIndex === -1) activeIndex = 0;
	let inScreen = !!options.initialScreen;

	// Initialize OpenTUI renderer
	const renderer = await createCliRenderer({ exitOnCtrlC: false });

	async function rebuild(): Promise<void> {
		// Clear existing tree
		while ((renderer.root as unknown as { children: Renderable[] }).children.length > 0) {
			(renderer.root as unknown as { children: Renderable[] }).children.pop();
		}

		// Rebuild layout
		const _sidebar = buildSidebar(renderer, allScreens, activeIndex);
		const statusBar = buildStatusBar(renderer, renderer.width);

		if (inScreen) {
			const mainContent = await buildMainContent(
				renderer,
				allScreens[activeIndex],
				renderer.width - 26,
				renderer.height - 4,
			);
			renderer.root.add(mainContent as never);
		} else {
			// Show sidebar with overview text
			const overview = await buildMainContent(
				renderer,
				allScreens[activeIndex],
				renderer.width - 26,
				renderer.height - 4,
			);
			renderer.root.add(overview as never);
		}

		renderer.root.add(statusBar as never);
		renderer.requestRender();
	}

	// Build initial layout
	await rebuild();

	// Handle keyboard navigation
	renderer.keyInput.on("keypress", (key: { name: string; ctrl?: boolean }) => {
		if (key.name === "q" || (key.ctrl && key.name === "c")) {
			renderer.destroy();
			return;
		}

		if (!inScreen) {
			if (key.name === "up" || key.name === "k") {
				activeIndex = Math.max(0, activeIndex - 1);
				rebuild(); // fire-and-forget async is fine
			} else if (key.name === "down" || key.name === "j") {
				activeIndex = Math.min(allScreens.length - 1, activeIndex + 1);
				rebuild();
			} else if (key.name === "return" || key.name === "enter") {
				inScreen = true;
				rebuild();
			}
		} else {
			if (key.name === "escape") {
				inScreen = false;
				rebuild();
			}
		}
	});
}
