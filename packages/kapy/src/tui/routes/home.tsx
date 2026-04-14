/**
 * Home route — Logo + prompt + suggestions.
 * 1:1 with OpenCode's Home component.
 */

import { Prompt } from "../component/prompt.jsx";
import { Logo } from "../component/logo.jsx";
import { useTheme } from "../context/theme.jsx";

const placeholder = {
	normal: [
		"Fix a TODO in the codebase",
		"What is the tech stack of this project?",
		"Fix broken tests",
	],
	shell: ["ls -la", "git status", "pwd"],
};

export function Home() {
	const { theme } = useTheme();

	return (
		<>
			<box flexGrow={1} alignItems="center" paddingLeft={2} paddingRight={2}>
				<box flexGrow={1} minHeight={0} />
				<box height={4} minHeight={0} flexShrink={1} />
				<box flexShrink={0}>
					<Logo />
				</box>
				<box height={1} minHeight={0} flexShrink={1} />
				<box width="100%" maxWidth={75} zIndex={1000} paddingTop={1} flexShrink={0}>
					<Prompt placeholder={placeholder} />
				</box>
				<box height={6} minHeight={0} flexShrink={1} />
				{/* Tips */}
				<box flexDirection="column" gap={1} flexShrink={0}>
					<text fg={theme().textMuted} selectable={false}>
						<span style={{ fg: theme().accent }}>Tip:</span> Type a question or command to get started
					</text>
					<text fg={theme().textMuted} selectable={false}>
						<span style={{ fg: theme().accent }}>Tip:</span> Use /help for available commands
					</text>
				</box>
				<box flexGrow={1} minHeight={0} />
			</box>
		</>
	);
}