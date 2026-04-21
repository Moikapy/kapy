import { RGBA } from "@opentui/core";
import { createSignal, type JSX, onCleanup, onMount } from "solid-js";

const TRAIL_CHARS = ["◆", "⬩", "⬪", "·"];
const INACTIVE_CHAR = "·";
const TRAIL_LENGTH = TRAIL_CHARS.length;
const TOTAL_POSITIONS = 8;
const INTERVAL = 60;
const BRAILLE = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

function parseColor(fg?: string): RGBA | null {
	if (!fg) return null;
	try {
		return RGBA.fromHex(fg);
	} catch {
		return null;
	}
}

function deriveTrailColors(base: RGBA): string[] {
	const colors: string[] = [];
	for (let i = 0; i < TRAIL_LENGTH; i++) {
		const alpha = i === 0 ? 1.0 : 0.55 ** i;
		const r = Math.min(1.0, base.r * (i === 1 ? 1.15 : 1.0));
		const g = Math.min(1.0, base.g * (i === 1 ? 1.15 : 1.0));
		const b = Math.min(1.0, base.b * (i === 1 ? 1.15 : 1.0));
		colors.push(RGBA.fromValues(r, g, b, alpha).toString());
	}
	return colors;
}

function deriveInactiveColor(base: RGBA): string {
	return RGBA.fromValues(base.r, base.g, base.b, 0.2).toString();
}

export function useSpinner(_fg?: string) {
	const [frame, setFrame] = createSignal(0);
	let id: ReturnType<typeof setInterval> | undefined;

	onMount(() => {
		id = setInterval(() => setFrame((i) => (i + 1) % 10), INTERVAL);
	});
	onCleanup(() => {
		if (id !== undefined) clearInterval(id);
	});

	return frame;
}

export function SpinnerFrame(props: { fg?: string; text?: string }): JSX.Element {
	const [tick, setTick] = createSignal(0);
	let id: ReturnType<typeof setInterval> | undefined;

	onMount(() => {
		id = setInterval(() => setTick((t) => t + 1), INTERVAL);
	});
	onCleanup(() => {
		if (id !== undefined) clearInterval(id);
	});

	const baseColor = () => parseColor(props.fg);
	const trailColors = () => {
		const base = baseColor();
		return base ? deriveTrailColors(base) : null;
	};
	const _inactiveColor = () => {
		const base = baseColor();
		return base ? deriveInactiveColor(base) : (props.fg ?? "#555555");
	};

	const position = () => {
		const t = tick();
		const cycle = t % (TOTAL_POSITIONS * 2 - 2);
		return cycle < TOTAL_POSITIONS ? cycle : TOTAL_POSITIONS * 2 - 2 - cycle;
	};

	const headColor = () => {
		const tc = trailColors();
		return tc ? tc[0] : (props.fg ?? "#555555");
	};

	const frame = () => {
		const tc = trailColors();
		if (!tc) return BRAILLE[tick() % BRAILLE.length];

		const pos = position();
		let result = "";
		for (let i = 0; i < TOTAL_POSITIONS; i++) {
			const dist = Math.abs(i - pos);
			if (dist < TRAIL_LENGTH) {
				result += TRAIL_CHARS[dist];
			} else {
				result += INACTIVE_CHAR;
			}
		}
		return result;
	};

	return (
		<box flexDirection="row">
			<text fg={headColor()}>
				{frame()}
				{props.text ? ` ${props.text}` : ""}
			</text>
		</box>
	);
}
