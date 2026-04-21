import type { JSX } from "solid-js";
import { Show } from "solid-js";
import { typography, useThemeColors } from "../theme.js";

export interface BannerProps {
	showMascot?: boolean;
	showTagline?: boolean;
	fg?: string;
	style?: "full" | "compact" | "minimal";
}

export const CAPYBARA_COMPACT = `
   ┌─────┐
   │ ◕ ◕ │
   │  ∪  │
   └─┬──┘
     ╰─╯`;

export const CAPYBARA_FULL = `
        ░░░░░░░
      ░░░  ◕  ◕  ░░░
     ░░░    ∪     ░░░    🐹
     ░░░  ┌──┐   ░░░
      ░░░ └──┘ ░░░
        ╰─────╯`;

export function Banner(props: BannerProps): JSX.Element {
	const c = useThemeColors();
	const showMascot = () => props.showMascot ?? true;
	const showTagline = () => props.showTagline ?? true;
	const style = () => props.style ?? "full";
	const fg = () => props.fg ?? c().primary;

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
				<text fg={c().muted}>{typography.tagline}</text>
			</Show>
		</box>
	);
}
