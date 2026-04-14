/**
 * Kapy logo component — wordmark + tagline.
 */

import { For } from "solid-js";
import { useTheme } from "../context/theme.jsx";

const KAPY = "KAPY";
const TAGLINE = "agent-first cli";

export function Logo() {
	const { theme } = useTheme();

	return (
		<box flexDirection="column" alignItems="center">
			<box flexDirection="row">
				<For each={KAPY.split("")}>
					{(char) => (
						<text fg={theme().accent} attributes={1} selectable={false}>
							{char}
						</text>
					)}
				</For>
			</box>
			<text fg={theme().textMuted} selectable={false}>
				{TAGLINE}
			</text>
		</box>
	);
}