/**
 * Sidebar — session info, tools, files.
 * 1:1 with OpenCode's Sidebar component.
 */

import { useTheme } from "../../context/theme.js";
import type { PromptRef } from "../../component/prompt.jsx";

interface SidebarProps {
	onClose?: () => void;
}

export function Sidebar(props: SidebarProps) {
	const { theme } = useTheme();

	return (
		<box
			backgroundColor={theme().backgroundPanel}
			width={42}
			height="100%"
			paddingTop={1}
			paddingBottom={1}
			paddingLeft={2}
			paddingRight={2}
		>
			<scrollbox flexGrow={1}>
				<box flexShrink={0} gap={1} paddingRight={1}>
					<text fg={theme().text}>
						<b>Kapy Session</b>
					</text>
					<text fg={theme().textMuted}>No tools connected yet</text>

					<box height={1} />

					<text fg={theme().textMuted}>
						<span style={{ fg: theme().accent }}>▸</span> Tools
					</text>
					<text fg={theme().textMuted}>
						<span style={{ fg: theme().accent }}>▸</span> Files
					</text>
					<text fg={theme().textMuted}>
						<span style={{ fg: theme().accent }}>▸</span> Terminal
					</text>
				</box>
			</scrollbox>

			<box flexShrink={0} gap={1} paddingTop={1}>
				<text fg={theme().textMuted}>
					<span style={{ fg: theme().success }}>•</span> <b>Ka</b>
					<span style={{ fg: theme().text }}>
						<b>py</b>
					</span>{" "}
					<span>v0.1.0</span>
				</text>
			</box>
		</box>
	);
}