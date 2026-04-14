/**
 * Home route — Logo + prompt + rotating suggestions.
 * No mode selection. Kapy uses implicit thinking levels.
 * Spec §9: Enter routes to session, no plan/build toggle.
 */

import { Prompt } from "../component/prompt.jsx";
import { Logo } from "../component/logo.jsx";
import { useTheme } from "../context/theme.jsx";

const placeholder = {
	normal: [
		"Fix a TODO in the codebase",
		"What is the tech stack of this project?",
		"Fix broken tests",
		"Add error handling to the auth module",
		"Refactor the config system",
	],
	shell: ["ls -la", "git status", "cat package.json"],
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
				{/* Tips — spec-aligned, no mode references */}
				<box flexDirection="column" gap={1} flexShrink={0}>
					<text fg={theme().textMuted} selectable={false}>
						<span style={{ fg: theme().accent }}>enter</span> send message
						{"   "}
						<span style={{ fg: theme().accent }}>shift+enter</span> follow-up after turn
						{"   "}
						<span style={{ fg: theme().accent }}>!</span> shell command
					</text>
					<text fg={theme().textMuted} selectable={false}>
						<span style={{ fg: theme().accent }}>tab</span> switch agent
						{"   "}
						<span style={{ fg: theme().accent }}>esc</span> abort
						{"   "}
						<span style={{ fg: theme().accent }}>?</span> help
					</text>
				</box>
				<box flexGrow={1} minHeight={0} />
			</box>
		</>
	);
}