import { useThemeColors } from "@moikapy/kapy-components";
import type { JSX } from "solid-js";
import { Show } from "solid-js";

interface StatusFooterProps {
	thinkingLevel: () => string;
	contextUsage: () => { usedTokens: number; maxTokens: number; fraction: number; shouldCompact: boolean };
}

export function StatusFooter(props: StatusFooterProps): JSX.Element {
	const c = useThemeColors();
	const cwd = process.cwd().split("/").slice(-2).join("/");

	const ctxPercent = () => {
		const usage = props.contextUsage();
		const pct = Math.round(usage.fraction * 100);
		return { pct, warn: usage.fraction >= 0.6, danger: usage.fraction >= 0.8 };
	};

	const ctxColor = () => {
		if (ctxPercent().danger) return c().error;
		if (ctxPercent().warn) return c().warning;
		return c().muted;
	};

	const thinkLabel = () => {
		const level = props.thinkingLevel();
		if (level === "off") return "";
		return level;
	};

	const contextBar = () => {
		const pct = ctxPercent().pct;
		const filled = Math.round(pct / 10);
		const empty = 10 - filled;
		const bar = "█".repeat(filled) + "░".repeat(empty);
		return bar;
	};

	return (
		<box
			flexDirection="row"
			justifyContent="space-between"
			paddingLeft={2}
			paddingRight={2}
			paddingTop={1}
			flexShrink={0}
		>
			<text fg={c().muted}>{cwd}</text>
			<box flexDirection="row" gap={1}>
				<Show when={props.contextUsage().shouldCompact} fallback={null}>
					<text fg={c().error}>⚠</text>
				</Show>
				<text fg={ctxColor()}>{`${contextBar()} ${ctxPercent().pct}%`}</text>
				<Show when={thinkLabel()} fallback={null}>
					<text fg={c().muted}>·</text>
					<text fg={ctxColor()}>{thinkLabel()}</text>
				</Show>
			</box>
		</box>
	);
}
