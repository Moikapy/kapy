/**
 * Box — layout container component.
 *
 * Renders a flex container with configurable direction, gap, padding,
 * and border. Delegates to @opentui/core's Box primitive with kapy defaults.
 */
import type { Component } from "../types.js";

export interface BoxProps {
	/** Flex direction */
	flexDirection?: "row" | "column";
	/** Gap between children */
	gap?: number;
	/** Padding */
	padding?: number | { top?: number; right?: number; bottom?: number; left?: number };
	/** Border style */
	border?: "single" | "double" | "none";
	/** Border color */
	borderColor?: string;
	/** Background color */
	bg?: string;
	/** Width */
	width?: number | string;
	/** Height */
	height?: number | string;
	/** Whether the box can receive focus */
	focusable?: boolean;
	/** Custom styles */
	style?: Record<string, unknown>;
	/** Children */
	children?: unknown[];
}

/** Render a Box layout container */
export const Box: Component<BoxProps> = (props: BoxProps) => {
	// TODO: delegate to @opentui/core Box primitive
	// For now, return props as a render descriptor
	return {
		type: "Box",
		props: {
			flexDirection: props.flexDirection ?? "column",
			gap: props.gap ?? 0,
			padding: props.padding ?? 0,
			border: props.border ?? "none",
			borderColor: props.borderColor,
			background: props.bg,
			width: props.width,
			height: props.height,
			focusable: props.focusable ?? false,
			style: props.style,
		},
		children: props.children ?? [],
	};
};