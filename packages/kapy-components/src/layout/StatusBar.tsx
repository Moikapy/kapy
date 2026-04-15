/**
 * StatusBar — bottom status bar for kapy TUI.
 *
 * Displays context information, key hints, and extension info
 * at the bottom of the TUI screen with left/center/right sections.
 */
import type { JSX } from "solid-js";

export interface StatusBarProps {
	/** Left section content */
	left?: string;
	/** Center section content */
	center?: string;
	/** Right section content (key hints) */
	right?: string;
	/** Background color */
	bg?: string;
	/** Foreground color */
	fg?: string;
}

/** Bottom status bar with left/center/right layout */
export function StatusBar(props: StatusBarProps): JSX.Element {
	const bgColor = () => props.bg ?? "#222233";
	const fgColor = () => props.fg ?? "#888888";

	return (
		<box
			flexDirection="row"
			justifyContent="space-between"
			paddingLeft={2}
			paddingRight={2}
			backgroundColor={bgColor()}
			flexShrink={0}
		>
			<text fg={fgColor()}>{props.left ?? ""}</text>
			<text fg={fgColor()}>{props.center ?? ""}</text>
			<text fg={fgColor()}>{props.right ?? ""}</text>
		</box>
	);
}
