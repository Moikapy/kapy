/**
 * Footer component — status bar showing cwd, agent, model, context.
 * Spec §9: No plan/build mode. Shows agent name, model, context usage.
 */

import { createMemo, Show } from "solid-js";
import { useTheme } from "../context/theme.jsx";

interface FooterProps {
	cwd?: string;
	toolCount?: number;
	providerStatus?: "connected" | "disconnected" | "error";
	contextUsage?: number; // fraction 0-1
	/** Current agent name */
	agentName?: string;
	/** Current model display name */
	modelName?: string;
}

export function Footer(props: FooterProps) {
	const { theme } = useTheme();

	const directory = createMemo(() => {
		const cwd = props.cwd ?? process.cwd();
		const home = process.env.HOME ?? "";
		return cwd.replace(home, "~");
	});

	const contextPct = createMemo(() =>
		props.contextUsage != null ? `${Math.round(props.contextUsage * 100)}%` : "—"
	);

	const modelDisplay = createMemo(() => {
		const agent = props.agentName ?? "kapy";
		const model = props.modelName ?? "";
		return model ? `${agent}/${model}` : agent;
	});

	return (
		<box flexDirection="row" justifyContent="space-between" gap={1} flexShrink={0}>
			<text fg={theme().textMuted}>{directory()}</text>
			<box gap={2} flexDirection="row" flexShrink={0}>
				<text fg={theme().text}>
					{modelDisplay()}
				</text>
				<text fg={theme().textMuted}>
					ctx: {contextPct()}
				</text>
				<Show when={props.toolCount != null && props.toolCount > 0}>
					<text fg={theme().text}>
						{props.toolCount} tools
					</text>
				</Show>
				<Show when={props.providerStatus === "connected"}>
					<text fg={theme().success}>⊙</text>
				</Show>
				<Show when={props.providerStatus === "error"}>
					<text fg={theme().error}>⊙</text>
				</Show>
				<text fg={theme().textMuted}>?</text>
			</box>
		</box>
	);
}