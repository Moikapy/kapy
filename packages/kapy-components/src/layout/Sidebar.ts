/**
 * Sidebar — sidebar layout component for the TUI shell.
 *
 * Renders a vertical navigation sidebar with icons and labels
 * for screen switching.
 */
import type { Component } from "../types.js";
/** Screen definition for sidebar navigation */
export interface SidebarScreen {
	name: string;
	label: string;
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
	/** Border style */
	border?: "single" | "double" | "none";
}

/** Render a sidebar navigation */
export const Sidebar: Component<SidebarProps> = (props: SidebarProps) => {
	return {
		type: "Sidebar",
		props: {
			screens: props.screens,
			activeScreen: props.activeScreen,
			onScreenChange: props.onScreenChange,
			width: props.width ?? 20,
			border: props.border ?? "none",
		},
	};
};
