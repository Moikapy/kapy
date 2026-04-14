/**
 * Footer component — status bar showing cwd, permissions, tool count.
 * 1:1 with OpenCode's Footer component.
 */

import { createMemo, Show } from "solid-js";
import { useTheme } from "../context/theme.jsx";

interface FooterProps {
	cwd?: string;
	permissionsCount?: number;
	toolCount?: number;
	providerStatus?: "connected" | "disconnected" | "error";
	contextUsage?: number; // fraction 0-1
}

export function Footer(props: FooterProps) {
	const { theme } = useTheme();

	const directory = createMemo(() => props.cwd ?? process.cwd());
	const permissions = createMemo(() => props.permissionsCount ?? 0);
	const tools = createMemo(() => props.toolCount ?? 0);

	return (
		<box flexDirection="row" justifyContent="space-between" gap={1} flexShrink={0}>
			<text fg={theme().textMuted}>{directory()}</text>
			<box gap={2} flexDirection="row" flexShrink={0}>
				<Show when={permissions() > 0}>
					<text fg={theme().warning}>
						△ {permissions()} Permission{permissions() > 1 ? "s" : ""}
					</text>
				</Show>
				<Show when={tools() > 0}>
					<text fg={theme().text}>
						<span style={{ fg: theme().success }}>•</span> {tools()} Tools
					</text>
				</Show>
				<Show when={props.providerStatus === "connected"}>
					<text fg={theme().text}>
						<span style={{ fg: theme().success }}>⊙</span> Provider
					</text>
				</Show>
				<Show when={props.providerStatus === "error"}>
					<text fg={theme().text}>
						<span style={{ fg: theme().error }}>⊙</span> Provider
					</text>
				</Show>
				<text fg={theme().textMuted}>/help</text>
			</box>
		</box>
	);
}