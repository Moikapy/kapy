/**
 * StatusBar — status bar layout component for the TUI shell.
 *
 * Displays context information, key hints, and extension info
 * at the bottom of the TUI screen.
 */
import type { Component } from "../types.js";

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
	/** Border style */
	border?: "single" | "double" | "none";
}

/** Render a status bar */
export const StatusBar: Component<StatusBarProps> = (props: StatusBarProps) => {
	return {
		type: "StatusBar",
		props: {
			left: props.left ?? "",
			center: props.center ?? "",
			right: props.right ?? "",
			background: props.bg ?? "gray",
			foreground: props.fg ?? "white",
			border: props.border ?? "none",
		},
	};
};