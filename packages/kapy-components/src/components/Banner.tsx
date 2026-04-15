/**
 * Banner — kapy brand banner component for TUI screens.
 *
 * Displays the capybara mascot and kapy wordmark using ASCII art
 * and the ascii_font primitive.
 */
import type { JSX } from "solid-js";
import { Show } from "solid-js";
import { colors, typography } from "../theme.js";

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

/** Create a kapy banner component */
export function Banner(props: BannerProps): JSX.Element {
	const showMascot = () => props.showMascot ?? true;
	const showTagline = () => props.showTagline ?? true;
	const style = () => props.style ?? "full";
	const fg = () => props.fg ?? colors.primary;

	return (
		<box flexDirection="column" alignItems="center" gap={1}>
			<Show when={showMascot() && style() !== "minimal"}>
				<text fg={fg()}>{style() === "compact" ? CAPYBARA_COMPACT : CAPYBARA_FULL}</text>
			</Show>
			<Show when={style() === "minimal"}>
				<text fg={fg()}>🐹 kapy</text>
			</Show>
			<Show when={style() !== "minimal"}>
				<ascii_font text="KAPY" font={typography.asciiFont} color={fg()} />
			</Show>
			<Show when={showTagline()}>
				<text fg={colors.muted}>{typography.tagline}</text>
			</Show>
		</box>
	);
}
