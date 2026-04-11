/**
 * kapy-components — UI components for kapy TUI, built on @opentui/core.
 *
 * These are factory functions that create and return OpenTUI Renderable instances.
 * Each component takes a renderer and returns instantiated OpenTUI primitives.
 */
import {
	ASCIIFontRenderable,
	BoxRenderable,
	type CliRenderer,
	InputRenderable,
	type Renderable,
	RGBA,
	ScrollBoxRenderable,
	SelectRenderable,
	TextRenderable,
} from "@opentui/core";

// ─── Types ────────────────────────────────────────────────────────

/** Options common to all kapy components */
export interface ComponentBaseOptions {
	/** Unique ID for the renderable */
	id?: string;
	/** Foreground color (hex string or RGBA) */
	fg?: string | RGBA;
	/** Background color (hex string or RGBA) */
	bg?: string | RGBA;
}

// ─── Banner ───────────────────────────────────────────────────────

export interface BannerProps extends ComponentBaseOptions {
	/** Show the capybara ASCII art */
	showMascot?: boolean;
	/** Show the tagline */
	showTagline?: boolean;
	/** Banner style */
	style?: "full" | "compact" | "minimal";
}

/** Compact capybara ASCII */
export const CAPYBARA_COMPACT = `
   ┌─────┐
   │ ◕ ◕ │
   │  ∪  │
   └─┬──┘
     ╰─╯`;

/** Full capybara ASCII */
export const CAPYBARA_FULL = `
        ░░░░░░░
      ░░░  ◕  ◕  ░░░
     ░░░    ∪     ░░░    🐹
     ░░░  ┌──┐   ░░░
      ░░░ └──┘ ░░░
        ╰─────╯`;

/** Create a kapy banner component */
export function createBanner(renderer: CliRenderer, props: BannerProps = {}): Renderable {
	const { showMascot = true, showTagline = true, style = "full", fg, id = "banner" } = props;
	const color = fg ?? "#00AAFF";

	const container = new BoxRenderable(renderer, {
		id,
		flexDirection: "column",
		padding: 1,
		gap: 1,
	});

	if (showMascot && style !== "minimal") {
		const mascot = new TextRenderable(renderer, {
			id: `${id}-mascot`,
			content: style === "compact" ? CAPYBARA_COMPACT : CAPYBARA_FULL,
			fg: color instanceof RGBA ? color : RGBA.fromHex(color as string),
		});
		container.add(mascot);
	}

	if (style === "minimal") {
		const wordmark = new TextRenderable(renderer, {
			id: `${id}-wordmark`,
			content: "🐹 kapy",
			fg: color instanceof RGBA ? color : RGBA.fromHex(color as string),
		});
		container.add(wordmark);
	} else {
		const title = new ASCIIFontRenderable(renderer, {
			id: `${id}-title`,
			text: "KAPY",
			font: "block",
			color: color instanceof RGBA ? color : RGBA.fromHex(color as string),
		});
		container.add(title);
	}

	if (showTagline) {
		const tagline = new TextRenderable(renderer, {
			id: `${id}-tagline`,
			content: "the pi.dev for CLI",
			fg: RGBA.fromHex("#888888"),
		});
		container.add(tagline);
	}

	return container;
}

// ─── Box ──────────────────────────────────────────────────────────

export interface BoxProps extends ComponentBaseOptions {
	/** Flex direction */
	flexDirection?: "row" | "column" | "row-reverse" | "column-reverse";
	/** Gap between children */
	gap?: number;
	/** Padding */
	padding?: number;
	/** Border style */
	border?: "single" | "double" | "rounded" | "bold" | "none";
	/** Border color */
	borderColor?: string | RGBA;
	/** Background color */
	backgroundColor?: string | RGBA;
	/** Width */
	width?: number | string;
	/** Height */
	width?: number | string;
	height?: number | string;
	/** Whether the box can receive focus */
	focusable?: boolean;
	/** Children to add */
	children?: Renderable[];
}

/** Create a Box layout container */
export function createBox(renderer: CliRenderer, props: BoxProps = {}): BoxRenderable {
	const {
		id = "box",
		flexDirection = "column",
		gap = 0,
		padding = 0,
		border,
		borderColor,
		backgroundColor,
		width,
		height,
		focusable = false,
		children = [],
	} = props;

	const box = new BoxRenderable(renderer, {
		id,
		flexDirection,
		gap,
		padding,
		border: border !== "none" && border !== undefined,
		borderStyle: border ?? "none",
		borderColor:
			borderColor instanceof RGBA ? borderColor : borderColor ? RGBA.fromHex(borderColor as string) : undefined,
		backgroundColor:
			backgroundColor instanceof RGBA
				? backgroundColor
				: backgroundColor
					? RGBA.fromHex(backgroundColor as string)
					: undefined,
		width,
		height,
	} as never);

	if (focusable) {
		// Make box focusable via key events
	}

	for (const child of children) {
		box.add(child as Renderable);
	}

	return box;
}

// ─── Text ──────────────────────────────────────────────────────────

export interface TextProps extends ComponentBaseOptions {
	/** Text content */
	content: string;
	/** Text attributes: bold, underline, etc. */
	bold?: boolean;
	underline?: boolean;
	/** Selectable text */
	selectable?: boolean;
}

/** Create a Text display component */
export function createText(renderer: CliRenderer, props: TextProps): TextRenderable {
	const { id = "text", content, fg, bg, bold, underline, selectable } = props;

	// Build TextAttributes from boolean props
	let attributes = 0;
	if (bold) attributes |= 1; // TextAttributes.BOLD = 1
	if (underline) attributes |= 4; // TextAttributes.UNDERLINE = 4

	const text = new TextRenderable(renderer, {
		id,
		content,
		fg: fg instanceof RGBA ? fg : fg ? RGBA.fromHex(fg) : undefined,
		bg: bg instanceof RGBA ? bg : bg ? RGBA.fromHex(bg) : undefined,
		attributes: attributes || undefined,
		selectable,
	} as never);

	return text;
}

// ─── Input ─────────────────────────────────────────────────────────

export interface InputProps extends ComponentBaseOptions {
	/** Placeholder text */
	placeholder?: string;
	/** Initial value */
	value?: string;
	/** Width */
	width?: number;
	/** Background color when focused */
	focusedBackgroundColor?: string | RGBA;
	/** Cursor color */
	cursorColor?: string | RGBA;
}

/** Create an Input component */
export function createInput(renderer: CliRenderer, props: InputProps = {}): InputRenderable {
	const { id = "input", placeholder = "", value = "", width = 30, focusedBackgroundColor, cursorColor } = props;

	const input = new InputRenderable(renderer, {
		id,
		placeholder,
		value,
		width,
		focusedBackgroundColor:
			focusedBackgroundColor instanceof RGBA
				? focusedBackgroundColor
				: focusedBackgroundColor
					? RGBA.fromHex(focusedBackgroundColor as string)
					: undefined,
		cursorColor:
			cursorColor instanceof RGBA ? cursorColor : cursorColor ? RGBA.fromHex(cursorColor as string) : undefined,
		backgroundColor: RGBA.fromHex("#1a1a2e"),
		textColor: RGBA.fromHex("#FFFFFF"),
	} as never);

	return input;
}

// ─── Select ────────────────────────────────────────────────────────

export interface SelectOption {
	name: string;
	description?: string;
	value: string;
}

export interface SelectProps extends ComponentBaseOptions {
	/** Options to display */
	options: SelectOption[];
	/** Initial selected index */
	selectedIndex?: number;
	/** Width */
	width?: number;
	/** Height */
	height?: number;
}

/** Create a Select component */
export function createSelect(renderer: CliRenderer, props: SelectProps): SelectRenderable {
	const { id = "select", options, selectedIndex = 0, width = 30, height = 10 } = props;

	const select = new SelectRenderable(renderer, {
		id,
		width,
		height,
		options: options.map((o) => ({ name: o.name, description: o.description, value: o.value })),
		selectedIndex,
		backgroundColor: RGBA.fromHex("#1a1a2e"),
	} as never);

	return select;
}

// ─── ScrollBox ────────────────────────────────────────────────────

export interface ScrollBoxProps extends ComponentBaseOptions {
	/** Width */
	width?: number;
	/** Height */
	height?: number;
	/** Show scrollbar */
	showScrollbar?: boolean;
	/** Children to add */
	children?: Renderable[];
}

/** Create a ScrollBox container */
export function createScrollBox(renderer: CliRenderer, props: ScrollBoxProps = {}): ScrollBoxRenderable {
	const { id = "scrollbox", width = 40, height = 20, showScrollbar = true, children = [] } = props;

	const scrollbox = new ScrollBoxRenderable(renderer, {
		id,
		width,
		height,
		showScrollbar,
	} as never);

	for (const child of children) {
		scrollbox.add(child as Renderable);
	}

	return scrollbox;
}

// ─── Code ──────────────────────────────────────────────────────────

export interface CodeProps extends ComponentBaseOptions {
	/** Code content */
	code: string;
	/** Language for syntax highlighting */
	language?: string;
	/** Width */
	width?: number;
}

/** Create a Code display component */
export function createCode(renderer: CliRenderer, props: CodeProps): TextRenderable {
	const { id = "code", code, fg, width } = props;

	// TODO: use language for syntax highlighting
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const _language = props.language;
	const text = new TextRenderable(renderer, {
		id,
		content: code,
		fg: fg instanceof RGBA ? fg : RGBA.fromHex((fg as string) ?? "#c0caf5"),
		width,
		selectable: true,
	} as never);

	return text;
}

// ─── Diff ───────────────────────────────────────────────────────────

export interface DiffProps extends ComponentBaseOptions {
	/** Original content */
	original: string;
	/** Modified content */
	modified: string;
	/** Diff type */
	type?: "unified" | "split";
	/** Width */
	width?: number;
}

/** Create a Diff display component */
export function createDiff(renderer: CliRenderer, props: DiffProps): TextRenderable {
	const { id = "diff", original, modified, fg, width } = props;

	// For MVP, show diff as labeled text
	const content = `--- Original\n${original}\n+++ Modified\n${modified}`;

	const text = new TextRenderable(renderer, {
		id,
		content,
		fg: fg instanceof RGBA ? fg : RGBA.fromHex((fg as string) ?? "#c0caf5"),
		width,
		selectable: true,
	} as never);

	return text;
}

// ─── Spinner ───────────────────────────────────────────────────────

export interface SpinnerProps extends ComponentBaseOptions {
	/** Spinner text */
	text?: string;
	/** Animation frames */
	frames?: string[];
}

/** Create a Spinner component */
export function createSpinner(renderer: CliRenderer, props: SpinnerProps = {}): TextRenderable {
	const {
		id = "spinner",
		text = "Loading...",
		frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
		fg,
	} = props;

	const spinner = new TextRenderable(renderer, {
		id,
		content: `${frames[0]} ${text}`,
		fg: fg instanceof RGBA ? fg : RGBA.fromHex((fg as string) ?? "#00AAFF"),
	} as never);

	return spinner;
}

// ─── Hooks ──────────────────────────────────────────────────────────

export interface Focusable {
	focus(): void;
	blur(): void;
}

export interface UseFocusOptions {
	/** Initial focus state */
	autoFocus?: boolean;
}

export interface UseFocusReturn {
	/** Focus the element */
	focus: () => void;
	/** Blur the element */
	blur: () => void;
	/** Whether the element is focused */
	isFocused: boolean;
}

/** Hook for managing focus on a renderable */
export function useFocus(renderable: Focusable, options: UseFocusOptions = {}): UseFocusReturn {
	const { autoFocus = false } = options;
	let focused = autoFocus;

	if (autoFocus) {
		renderable.focus();
	}

	return {
		focus: () => {
			focused = true;
			renderable.focus();
		},
		blur: () => {
			focused = false;
			renderable.blur();
		},
		isFocused: focused,
	};
}

export type InputHandler = (event: { name: string; ctrl?: boolean; shift?: boolean; meta?: boolean }) => void;

export interface UseInputOptions {
	/** Only handle input when focused */
	focusOnly?: boolean;
}

/** Hook for keyboard input on a renderable */
export function useInput(renderer: CliRenderer, handler: InputHandler, options: UseInputOptions = {}): () => void {
	// TODO: implement focusOnly filtering when focus management is integrated
	void options.focusOnly;

	const keyHandler = (key: { name: string; ctrl?: boolean; shift?: boolean; meta?: boolean }) => {
		handler(key);
	};

	renderer.keyInput.on("keypress", keyHandler);

	// Return unsubscribe function
	return () => {
		renderer.keyInput.off("keypress", keyHandler);
	};
}

// ─── Layout ─────────────────────────────────────────────────────────

export interface SidebarItem {
	name: string;
	icon?: string;
	screen: string;
}

export interface SidebarProps {
	/** Items in the sidebar */
	items: SidebarItem[];
	/** Active item index */
	activeIndex?: number;
	/** Width */
	width?: number;
}

/** Create a Sidebar layout */
export function createSidebar(renderer: CliRenderer, props: SidebarProps): BoxRenderable {
	const { items, activeIndex = 0, width = 24 } = props;

	const sidebar = new BoxRenderable(renderer, {
		id: "sidebar",
		width,
		flexDirection: "column",
		padding: 1,
		border: true,
		borderStyle: "single",
		borderColor: RGBA.fromHex("#444466"),
		backgroundColor: RGBA.fromHex("#1a1a2e"),
	} as never);

	// Header
	const header = new TextRenderable(renderer, {
		id: "sidebar-header",
		content: "🐹 kapy",
		fg: RGBA.fromHex("#00AAFF"),
		bold: true,
	} as never);
	sidebar.add(header);

	// Separator
	const separator = new TextRenderable(renderer, {
		id: "sidebar-separator",
		content: "────────────────",
		fg: RGBA.fromHex("#444466"),
	} as never);
	sidebar.add(separator);

	// Navigation items
	for (let i = 0; i < items.length; i++) {
		const item = items[i];
		const isActive = i === activeIndex;
		const prefix = isActive ? " ▸ " : "   ";
		const label = `${prefix}${item.icon ?? " "} ${item.name}`;
		const itemText = new TextRenderable(renderer, {
			id: `sidebar-item-${i}`,
			content: label,
			fg: isActive ? RGBA.fromHex("#00AAFF") : RGBA.fromHex("#888888"),
		} as never);
		sidebar.add(itemText);
	}

	return sidebar;
}

export interface StatusBarProps {
	/** Status text */
	text?: string;
	/** Width */
	width?: number;
	/** Background color */
	backgroundColor?: string | RGBA;
}

/** Create a StatusBar */
export function createStatusBar(renderer: CliRenderer, props: StatusBarProps = {}): BoxRenderable {
	const { text = "q: quit  ↑↓: navigate  ↵: select", width = 80, backgroundColor } = props;

	const bar = new BoxRenderable(renderer, {
		id: "statusbar",
		width,
		padding: 1,
		backgroundColor: backgroundColor instanceof RGBA ? backgroundColor : RGBA.fromHex(backgroundColor ?? "#222233"),
	} as never);

	const statusText = new TextRenderable(renderer, {
		id: "statusbar-text",
		content: text,
		fg: RGBA.fromHex("#888888"),
	} as never);
	bar.add(statusText);

	return bar;
}
