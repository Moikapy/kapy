/**
 * kapy design tokens — colors, spacing, and typography.
 *
 * Shared theme constants used by all kapy-components and the kapy TUI.
 * Single source of truth for the kapy visual identity.
 */

export const colors = {
	/** Primary brand color — electric blue */
	primary: "#00AAFF",
	/** Muted/dimmed text */
	muted: "#565f89",
	/** Default text color */
	text: "#c0caf5",
	/** Secondary text */
	textMuted: "#a9b1d6",
	/** Success/assistant messages */
	success: "#9ece6a",
	/** Warning/tool calls */
	warning: "#e0af68",
	/** Error states */
	error: "#f7768e",
	/** Main background */
	bg: "#1a1b26",
	/** Alternate background (sidebar, inputs) */
	bgAlt: "#1a1a2e",
	/** Input background */
	bgInput: "#22223a",
	/** Border color */
	border: "#444466",
} as const;

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
