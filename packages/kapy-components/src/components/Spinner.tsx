/**
 * Spinner — progress spinner component.
 *
 * Displays an animated spinner with status text using Solid signals
 * for reactive frame cycling.
 */
import type { JSX } from "solid-js";
import { createSignal, onCleanup, onMount } from "solid-js";
import { colors } from "../theme.js";

const DEFAULT_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

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

/** Animated spinner with status text */
export function Spinner(props: SpinnerProps): JSX.Element {
	const fg = () => props.fg ?? colors.primary;
	const frames = () => props.frames ?? DEFAULT_FRAMES;
	const [frameIdx, setFrameIdx] = createSignal(0);

	let intervalId: ReturnType<typeof setInterval> | undefined;

	onMount(() => {
		intervalId = setInterval(() => {
			setFrameIdx((i) => (i + 1) % frames().length);
		}, 80);
	});

	onCleanup(() => {
		if (intervalId !== undefined) clearInterval(intervalId);
	});

	return (
		<text fg={fg()}>
			{frames()[frameIdx()]} {props.text ?? "Loading..."}
		</text>
	);
}
