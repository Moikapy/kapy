/**
 * Spinner — progress spinner component.
 *
 * Displays an animated spinner with optional status text.
 * Used in ctx.spinner() for command progress indication.
 */
import type { Component } from "../types.js";

export interface SpinnerProps {
	/** Spinner text/label */
	text: string;
	/** Spinner style */
	style?: "dots" | "line" | "arc" | "bounce";
	/** Foreground color */
	color?: string;
	/** Whether the spinner is spinning */
	spinning?: boolean;
	/** Completion state */
	state?: "running" | "success" | "failure";
}

/** Render a progress spinner */
export const Spinner: Component<SpinnerProps> = (props: SpinnerProps) => {
	return {
		type: "Spinner",
		props: {
			text: props.text,
			style: props.style ?? "dots",
			color: props.color ?? "green",
			spinning: props.spinning ?? true,
			state: props.state ?? "running",
		},
	};
};