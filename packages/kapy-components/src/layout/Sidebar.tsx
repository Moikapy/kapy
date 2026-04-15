/**
 * Sidebar — generic navigation sidebar for kapy TUI.
 *
 * Displays a vertical list of screens with icons and labels.
 * Uses kapy brand colors for active/inactive states.
 */
import type { JSX } from "solid-js";
import { For } from "solid-js";
import { colors } from "../theme.js";

export interface SidebarScreen {
	/** Screen identifier (used for matching activeScreen) */
	name: string;
	/** Display label */
	label: string;
	/** Optional icon */
	icon?: string;
}

export interface SidebarProps {
	/** List of screens to display */
	screens: SidebarScreen[];
	/** Currently active screen name */
	activeScreen: string;
	/** Screen change handler */
	onScreenChange?: (screenName: string) => void;
	/** Width */
	width?: number;
	/** Background color */
	bg?: string;
}

/** Generic navigation sidebar with kapy branding */
export function Sidebar(props: SidebarProps): JSX.Element {
	const bg = () => props.bg ?? colors.bgAlt;
	const width = () => props.width ?? 24;

	return (
		<box backgroundColor={bg()} width={width()} flexDirection="column" padding={1} gap={1}>
			<text fg={colors.primary}>
				<strong>🐹 kapy</strong>
			</text>
			<text fg={colors.border}>────────────────</text>
			<For each={props.screens}>
				{(screen) => {
					const isActive = () => screen.name === props.activeScreen;
					const prefix = () => (isActive() ? " ▸ " : "   ");
					const label = () => `${prefix()}${screen.icon ?? " "} ${screen.label}`;
					return <text fg={isActive() ? colors.primary : colors.muted}>{label()}</text>;
				}}
			</For>
		</box>
	);
}
