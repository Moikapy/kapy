import type { JSX } from "solid-js";
import { useThemeColors } from "../theme.js";

export interface StatusBarProps {
	left?: string;
	center?: string;
	right?: string;
	bg?: string;
	fg?: string;
}

export function StatusBar(props: StatusBarProps): JSX.Element {
	const c = useThemeColors();
	const bgColor = () => props.bg ?? c().bgAlt;
	const fgColor = () => props.fg ?? c().muted;

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
