import type { JSX } from "solid-js";
import { For } from "solid-js";
import { useThemeColors } from "../theme.js";

export interface SidebarScreen {
	name: string;
	label: string;
	icon?: string;
}

export interface SidebarProps {
	screens: SidebarScreen[];
	activeScreen: string;
	onScreenChange?: (screenName: string) => void;
	width?: number;
	bg?: string;
}

export function Sidebar(props: SidebarProps): JSX.Element {
	const c = useThemeColors();
	const bg = () => props.bg ?? c().bgAlt;
	const width = () => props.width ?? 24;

	return (
		<box backgroundColor={bg()} width={width()} flexDirection="column" padding={1} gap={1}>
			<text fg={c().primary}>
				<strong>🐹 kapy</strong>
			</text>
			<text fg={c().border}>────────────────</text>
			<For each={props.screens}>
				{(screen) => {
					const isActive = () => screen.name === props.activeScreen;
					const prefix = () => (isActive() ? " ▸ " : "   ");
					const label = () => `${prefix()}${screen.icon ?? " "} ${screen.label}`;
					return <text fg={isActive() ? c().primary : c().muted}>{label()}</text>;
				}}
			</For>
		</box>
	);
}
