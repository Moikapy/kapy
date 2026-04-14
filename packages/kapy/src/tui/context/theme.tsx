/**
 * Theme context — dark/light mode, color palette.
 * Kapy branding: 🐹 hamster theme with blue accent.
 */

import { createContext, useContext, type ParentComponent, createSignal } from "solid-js";
import { RGBA } from "@opentui/core";

export interface ThemeColors {
	background: RGBA;
	backgroundPanel: RGBA;
	backgroundElement: RGBA;
	text: RGBA;
	textMuted: RGBA;
	border: RGBA;
	borderActive: RGBA;
	primary: RGBA;
	accent: RGBA;
	success: RGBA;
	warning: RGBA;
	error: RGBA;
	diffAdded: RGBA;
	diffRemoved: RGBA;
	markdownText: RGBA;
}

const DARK: ThemeColors = {
	background: RGBA.fromHex("#16161e"),
	backgroundPanel: RGBA.fromHex("#1a1a2e"),
	backgroundElement: RGBA.fromHex("#22223a"),
	text: RGBA.fromHex("#c0caf5"),
	textMuted: RGBA.fromHex("#565f89"),
	border: RGBA.fromHex("#444466"),
	borderActive: RGBA.fromHex("#00AAFF"),
	primary: RGBA.fromHex("#7aa2f7"),
	accent: RGBA.fromHex("#00AAFF"),
	success: RGBA.fromHex("#9ece6a"),
	warning: RGBA.fromHex("#e0af68"),
	error: RGBA.fromHex("#f7768e"),
	diffAdded: RGBA.fromHex("#9ece6a"),
	diffRemoved: RGBA.fromHex("#f7768e"),
	markdownText: RGBA.fromHex("#c0caf5"),
};

const LIGHT: ThemeColors = {
	background: RGBA.fromHex("#e1e2e7"),
	backgroundPanel: RGBA.fromHex("#e1e2e7"),
	backgroundElement: RGBA.fromHex("#d0d5e3"),
	text: RGBA.fromHex("#3760bf"),
	textMuted: RGBA.fromHex("#a8aecb"),
	border: RGBA.fromHex("#a8aecb"),
	borderActive: RGBA.fromHex("#0070C0"),
	primary: RGBA.fromHex("#2e7de9"),
	accent: RGBA.fromHex("#0070C0"),
	success: RGBA.fromHex("#587539"),
	warning: RGBA.fromHex("#8c6c3e"),
	error: RGBA.fromHex("#c64343"),
	diffAdded: RGBA.fromHex("#587539"),
	diffRemoved: RGBA.fromHex("#c64343"),
	markdownText: RGBA.fromHex("#3760bf"),
};

interface ThemeContextValue {
	theme: () => ThemeColors;
	mode: () => "dark" | "light";
	setMode: (mode: "dark" | "light") => void;
}

const ThemeContext = createContext<ThemeContextValue>();

export function useTheme(): ThemeContextValue {
	const ctx = useContext(ThemeContext);
	if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
	return ctx;
}

export const ThemeProvider: ParentComponent = (props) => {
	const [mode, setMode] = createSignal<"dark" | "light">("dark");
	const theme = () => (mode() === "dark" ? DARK : LIGHT);

	return (
		<ThemeContext.Provider value={{ theme, mode, setMode }}>
			{props.children}
		</ThemeContext.Provider>
	);
}