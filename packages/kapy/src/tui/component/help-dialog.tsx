/**
 * Help dialog — keyboard shortcuts and slash commands.
 * 1:1 with OpenCode's HelpDialog.
 */

import { useTheme } from "../context/theme.jsx";
import { useDialog } from "../context/dialog.jsx";

export function HelpDialog() {
	const { theme } = useTheme();
	const { closeDialog } = useDialog();

	const shortcuts = [
		["Ctrl+C", "Exit"],
		["Escape", "Back / Close dialog"],
		["Tab", "Switch agent"],
		["\\", "Toggle sidebar"],
		["/help", "Show this dialog"],
		["/compact", "Compact session context"],
		["/tree", "Show session tree"],
		["/fork", "Fork session"],
		["/model", "Change model"],
		["/agent", "Switch agent"],
	];

	return (
		<box
			border
			borderStyle="rounded"
			borderColor={theme().accent}
			backgroundColor={theme().backgroundPanel}
			padding={1}
			width={50}
			maxHeight={20}
		>
			<box flexDirection="column" gap={1}>
				<text fg={theme().accent}>
					<b>Keyboard Shortcuts</b>
				</text>
				{shortcuts.map(([key, desc]) => (
					<box flexDirection="row" gap={1}>
						<text fg={theme().accent}>{key}</text>
						<text fg={theme().textMuted}>{desc}</text>
					</box>
				))}
			</box>
		</box>
	);
}