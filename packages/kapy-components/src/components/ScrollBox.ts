/**
 * ScrollBox — scrollable container component.
 *
 * Renders a scrollable area with configurable height and overflow behavior.
 */
import type { Component } from "../types.js";

export interface ScrollBoxProps {
	/** Content height */
	height?: number | string;
	/** Content width */
	width?: number | string;
	/** Whether to show scrollbar */
	scrollbar?: boolean;
	/** Scroll offset (controlled mode) */
	scrollOffset?: number;
	/** Border style */
	border?: "single" | "double" | "none";
	/** Border color */
	borderColor?: string;
	/** Focusable for keyboard scrolling */
	focusable?: boolean;
	/** Children */
	children?: unknown[];
}

/** Render a scrollable container */
export const ScrollBox: Component<ScrollBoxProps> = (props: ScrollBoxProps) => {
	return {
		type: "ScrollBox",
		props: {
			height: props.height ?? "100%",
			width: props.width ?? "100%",
			scrollbar: props.scrollbar ?? true,
			scrollOffset: props.scrollOffset ?? 0,
			border: props.border ?? "none",
			borderColor: props.borderColor,
			focusable: props.focusable ?? true,
		},
		children: props.children ?? [],
	};
};
