/**
 * Spinner — progress spinner component.
 *
 * Displays an animated spinner with optional status text.
 * Used in ctx.spinner() for command progress indication.
 */
import type { Component } from "../types.js";

export interface SpinnerProps {
	/** Spinner text/label */
	text?: string;
	/** Foreground color */
	fg?: string;
	/** Custom animation frames */
	frames?: string[];
	/** Whether the spinner is spinning */
	spinning?: boolean;
}

/** Render a progress spinner */
export const Spinner: Component<SpinnerProps> = (props: SpinnerProps) => {
	const text = props.text ? ` ${props.text}` : "";
	return {
		type: "Spinner",
		props: {
			text,
			fg: props.fg,
			frames: props.frames,
			spinning: props.spinning ?? true,
		},
	};
};
