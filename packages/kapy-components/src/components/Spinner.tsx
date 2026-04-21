import type { JSX } from "solid-js";
import { createSignal, onCleanup, onMount } from "solid-js";
import { useThemeColors } from "../theme.js";

const DEFAULT_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export interface SpinnerProps {
	text?: string;
	fg?: string;
	frames?: string[];
	spinning?: boolean;
}

export function Spinner(props: SpinnerProps): JSX.Element {
	const c = useThemeColors();
	const fg = () => props.fg ?? c().primary;
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
			{frames()[frameIdx()]}
			{props.text ? ` ${props.text}` : ""}
		</text>
	);
}
