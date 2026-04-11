/**
 * Banner — kapy brand banner component for TUI screens.
 *
 * Displays the capybara mascot and kapy wordmark.
 * Used in the home screen and as a reusable component for extensions.
 */
import type { Component } from "../types.js";

export interface BannerProps {
	/** Show the capybara ASCII art */
	showMascot?: boolean;
	/** Show the tagline */
	showTagline?: boolean;
	/** Foreground color for the wordmark */
	fg?: string;
	/** Banner style */
	style?: "full" | "compact" | "minimal";
}

/** Capybara ASCII mascot (compact style for terminals) */
export const CAPYBARA_COMPACT = `
   ┌─────┐
   │ ◕ ◕ │
   │  ∪  │
   └─┬──┘
     ╰─╯`;

/** Capybara ASCII mascot (full style) */
export const CAPYBARA_FULL = `
        ░░░░░░░
      ░░░  ◕  ◕  ░░░
     ░░░    ∪     ░░░    🐹
     ░░░  ┌──┐   ░░░
      ░░░ └──┘ ░░░
        ╰─────╯`;

/** Render a kapy banner component */
export const Banner: Component<BannerProps> = (props: BannerProps) => {
	const showMascot = props.showMascot ?? true;
	const showTagline = props.showTagline ?? true;
	const style = props.style ?? "full";
	const fg = props.fg ?? "#00AAFF";

	const mascot = style === "minimal" ? "" : style === "compact" ? CAPYBARA_COMPACT : CAPYBARA_FULL;
	const wordmark = style === "minimal" ? "🐹 kapy" : "kapy";
	const tagline = "the pi.dev for CLI";

	return {
		type: "Banner",
		props: {
			foreground: fg,
			mascot: showMascot ? mascot : "",
			wordmark,
			tagline: showTagline ? tagline : "",
			style,
		},
	};
};