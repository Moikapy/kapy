import { createContext, createSignal, type JSX, useContext } from "solid-js";

function hexToRgb(hex: string): { r: number; g: number; b: number } {
	const h = hex.replace("#", "");
	return {
		r: parseInt(h.slice(0, 2), 16) / 255,
		g: parseInt(h.slice(2, 4), 16) / 255,
		b: parseInt(h.slice(4, 6), 16) / 255,
	};
}

export function tint(base: string, overlay: string, alpha: number): string {
	const b = hexToRgb(base);
	const o = hexToRgb(overlay);
	const r = Math.round((b.r + (o.r - b.r) * alpha) * 255);
	const g = Math.round((b.g + (o.g - b.g) * alpha) * 255);
	const bl = Math.round((b.b + (o.b - b.b) * alpha) * 255);
	return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${bl.toString(16).padStart(2, "0")}`;
}

export interface ThemeColors {
	primary: string;
	muted: string;
	text: string;
	textMuted: string;
	success: string;
	warning: string;
	error: string;
	bg: string;
	bgAlt: string;
	bgInput: string;
	border: string;
	borderDim: string;
	bgPanel: string;
	bgElement: string;
	toolFile: string;
	toolEdit: string;
	toolSearch: string;
	toolShell: string;
	toolGrimoire: string;
	toolWeb: string;
	diffAdded: string;
	diffRemoved: string;
	diffContext: string;
	diffAddedBg: string;
	diffRemovedBg: string;
	diffContextBg: string;
	diffHighlightAdded: string;
	diffHighlightRemoved: string;
	diffLineNumber: string;
	diffAddedLineNumberBg: string;
	diffRemovedLineNumberBg: string;
	diffHunkHeader: string;
	markdownHeading: string;
	markdownLink: string;
	markdownLinkText: string;
	markdownCode: string;
	markdownCodeBlock: string;
	markdownBlockQuote: string;
	markdownEmph: string;
	markdownStrong: string;
	markdownListItem: string;
	syntaxKeyword: string;
	syntaxFunction: string;
	syntaxString: string;
	syntaxNumber: string;
	syntaxComment: string;
	syntaxType: string;
	syntaxVariable: string;
	syntaxOperator: string;
	syntaxPunctuation: string;
	syntaxConstant: string;
	syntaxProperty: string;
	syntaxRegexp: string;
	thinkingOpacity: number;
}

const TOKYO_NIGHT: ThemeColors = {
	primary: "#00AAFF",
	muted: "#565f89",
	text: "#c0caf5",
	textMuted: "#a9b1d6",
	success: "#9ece6a",
	warning: "#e0af68",
	error: "#f7768e",
	bg: "#1a1b26",
	bgAlt: "#1a1a2e",
	bgInput: tint("#1a1b26", "#00AAFF", 0.08),
	border: "#444466",
	borderDim: "#414868",
	bgPanel: "#1e1e2e",
	bgElement: tint("#1a1b26", "#c0caf5", 0.06),
	toolFile: "#f7768e",
	toolEdit: "#ff9e64",
	toolSearch: "#2ac3de",
	toolShell: "#ff9e64",
	toolGrimoire: "#bb9af7",
	toolWeb: "#7dcfff",
	diffAdded: "#9ece6a",
	diffRemoved: "#f7768e",
	diffContext: "#565f89",
	diffAddedBg: tint("#1a1b26", "#9ece6a", 0.12),
	diffRemovedBg: tint("#1a1b26", "#f7768e", 0.12),
	diffContextBg: "#1e1e2e",
	diffHighlightAdded: "#9ece6a",
	diffHighlightRemoved: "#f7768e",
	diffLineNumber: "#565f89",
	diffAddedLineNumberBg: tint("#1a1b26", "#9ece6a", 0.12),
	diffRemovedLineNumberBg: tint("#1a1b26", "#f7768e", 0.12),
	diffHunkHeader: "#7dcfff",
	markdownHeading: "#7dcfff",
	markdownLink: "#00AAFF",
	markdownLinkText: "#9ece6a",
	markdownCode: "#ff9e64",
	markdownCodeBlock: "#565f89",
	markdownBlockQuote: "#565f89",
	markdownEmph: "#a9b1d6",
	markdownStrong: "#c0caf5",
	markdownListItem: "#e0af68",
	syntaxKeyword: "#bb9af7",
	syntaxFunction: "#7dcfff",
	syntaxString: "#9ece6a",
	syntaxNumber: "#ff9e64",
	syntaxComment: "#565f89",
	syntaxType: "#2ac3de",
	syntaxVariable: "#c0caf5",
	syntaxOperator: "#89ddff",
	syntaxPunctuation: "#565f89",
	syntaxConstant: "#ff9e64",
	syntaxProperty: "#7dcfff",
	syntaxRegexp: "#b4f9f8",
	thinkingOpacity: 0.6,
};

const CATPPUCCIN_MOCHA: ThemeColors = {
	primary: "#89b4fa",
	muted: "#6c7086",
	text: "#cdd6f4",
	textMuted: "#a6adc8",
	success: "#a6e3a1",
	warning: "#f9e2af",
	error: "#f38ba8",
	bg: "#1e1e2e",
	bgAlt: "#181825",
	bgInput: tint("#1e1e2e", "#89b4fa", 0.08),
	border: "#45475a",
	borderDim: "#313244",
	bgPanel: "#1e1e2e",
	bgElement: tint("#1e1e2e", "#cdd6f4", 0.06),
	toolFile: "#f38ba8",
	toolEdit: "#fab387",
	toolSearch: "#89dceb",
	toolShell: "#fab387",
	toolGrimoire: "#cba6f7",
	toolWeb: "#89b4fa",
	diffAdded: "#a6e3a1",
	diffRemoved: "#f38ba8",
	diffContext: "#6c7086",
	diffAddedBg: tint("#1e1e2e", "#a6e3a1", 0.12),
	diffRemovedBg: tint("#1e1e2e", "#f38ba8", 0.12),
	diffContextBg: "#1e1e2e",
	diffHighlightAdded: "#a6e3a1",
	diffHighlightRemoved: "#f38ba8",
	diffLineNumber: "#6c7086",
	diffAddedLineNumberBg: tint("#1e1e2e", "#a6e3a1", 0.12),
	diffRemovedLineNumberBg: tint("#1e1e2e", "#f38ba8", 0.12),
	diffHunkHeader: "#89dceb",
	markdownHeading: "#89dceb",
	markdownLink: "#89b4fa",
	markdownLinkText: "#a6e3a1",
	markdownCode: "#fab387",
	markdownCodeBlock: "#6c7086",
	markdownBlockQuote: "#6c7086",
	markdownEmph: "#a6adc8",
	markdownStrong: "#cdd6f4",
	markdownListItem: "#f9e2af",
	syntaxKeyword: "#cba6f7",
	syntaxFunction: "#89b4fa",
	syntaxString: "#a6e3a1",
	syntaxNumber: "#fab387",
	syntaxComment: "#6c7086",
	syntaxType: "#89dceb",
	syntaxVariable: "#cdd6f4",
	syntaxOperator: "#94e2d5",
	syntaxPunctuation: "#6c7086",
	syntaxConstant: "#fab387",
	syntaxProperty: "#89b4fa",
	syntaxRegexp: "#f5e0dc",
	thinkingOpacity: 0.6,
};

const DRACULA: ThemeColors = {
	primary: "#bd93f9",
	muted: "#6272a4",
	text: "#f8f8f2",
	textMuted: "#bfc0d0",
	success: "#50fa7b",
	warning: "#f1fa8c",
	error: "#ff5555",
	bg: "#282a36",
	bgAlt: "#21222c",
	bgInput: tint("#282a36", "#bd93f9", 0.08),
	border: "#44475a",
	borderDim: "#343746",
	bgPanel: "#282a36",
	bgElement: tint("#282a36", "#f8f8f2", 0.06),
	toolFile: "#ff5555",
	toolEdit: "#ffb86c",
	toolSearch: "#8be9fd",
	toolShell: "#ffb86c",
	toolGrimoire: "#bd93f9",
	toolWeb: "#8be9fd",
	diffAdded: "#50fa7b",
	diffRemoved: "#ff5555",
	diffContext: "#6272a4",
	diffAddedBg: tint("#282a36", "#50fa7b", 0.12),
	diffRemovedBg: tint("#282a36", "#ff5555", 0.12),
	diffContextBg: "#282a36",
	diffHighlightAdded: "#50fa7b",
	diffHighlightRemoved: "#ff5555",
	diffLineNumber: "#6272a4",
	diffAddedLineNumberBg: tint("#282a36", "#50fa7b", 0.12),
	diffRemovedLineNumberBg: tint("#282a36", "#ff5555", 0.12),
	diffHunkHeader: "#8be9fd",
	markdownHeading: "#8be9fd",
	markdownLink: "#8be9fd",
	markdownLinkText: "#50fa7b",
	markdownCode: "#ffb86c",
	markdownCodeBlock: "#6272a4",
	markdownBlockQuote: "#6272a4",
	markdownEmph: "#bfc0d0",
	markdownStrong: "#f8f8f2",
	markdownListItem: "#f1fa8c",
	syntaxKeyword: "#ff79c6",
	syntaxFunction: "#8be9fd",
	syntaxString: "#f1fa8c",
	syntaxNumber: "#bd93f9",
	syntaxComment: "#6272a4",
	syntaxType: "#8be9fd",
	syntaxVariable: "#f8f8f2",
	syntaxOperator: "#ff79c6",
	syntaxPunctuation: "#6272a4",
	syntaxConstant: "#bd93f9",
	syntaxProperty: "#50fa7b",
	syntaxRegexp: "#f1fa8c",
	thinkingOpacity: 0.6,
};

export const THEMES: Record<string, ThemeColors> = {
	"tokyo-night": TOKYO_NIGHT,
	"catppuccin-mocha": CATPPUCCIN_MOCHA,
	dracula: DRACULA,
};

export const THEME_NAMES: string[] = Object.keys(THEMES);

const themeChangeCallbacks: Set<(c: ThemeColors) => void> = new Set();

export function onThemeChange(cb: (c: ThemeColors) => void): () => void {
	themeChangeCallbacks.add(cb);
	return () => themeChangeCallbacks.delete(cb);
}

export let colors: ThemeColors = TOKYO_NIGHT;

export let currentThemeName: string = "tokyo-night";

export function setTheme(name: string, persist?: (name: string) => void): boolean {
	const theme = THEMES[name] ?? loadThemeFromFile(name);
	if (!theme) return false;
	colors = theme;
	currentThemeName = name;
	for (const cb of themeChangeCallbacks) cb(colors);
	persist?.(name);
	return true;
}

function loadThemeFromFile(name: string): ThemeColors | null {
	try {
		const fs = require("node:fs");
		const path = require("node:path");
		const homedir = require("node:os").homedir();
		const filePath = path.join(homedir, ".kapy", "themes", `${name}.json`);
		if (!fs.existsSync(filePath)) return null;
		const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
		return { ...TOKYO_NIGHT, ...raw };
	} catch {
		return null;
	}
}

export function listAvailableThemes(): string[] {
	const builtIn = Object.keys(THEMES);
	try {
		const fs = require("node:fs");
		const path = require("node:path");
		const homedir = require("node:os").homedir();
		const dir = path.join(homedir, ".kapy", "themes");
		if (!fs.existsSync(dir)) return builtIn;
		const files = fs.readdirSync(dir).filter((f: string) => f.endsWith(".json"));
		const custom = files.map((f: string) => f.replace(/\.json$/, ""));
		const all = [...builtIn];
		for (const c of custom) {
			if (!all.includes(c)) all.push(c);
		}
		return all;
	} catch {
		return builtIn;
	}
}

const ThemeContext = createContext<() => ThemeColors>();

export function ThemeProvider(props: { children: JSX.Element }): JSX.Element {
	const [currentColors, setCurrentColors] = createSignal<ThemeColors>(colors);
	onThemeChange((c) => setCurrentColors(c));
	return ThemeContext.Provider({
		value: currentColors,
		get children() {
			return props.children;
		},
	}) as unknown as JSX.Element;
}

export function useThemeColors(): () => ThemeColors {
	return useContext(ThemeContext) ?? (() => colors);
}

export const spacing = {
	xs: 1,
	sm: 2,
	md: 3,
	lg: 4,
	xl: 6,
} as const;

export const typography = {
	asciiFont: "slick" as const,
	tagline: "the agent-first CLI framework",
};
