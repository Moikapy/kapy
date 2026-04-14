/**
 * Kapy logo component — ASCII art with branding.
 * 🐹 hamster icon + KAPY text, 1:1 layout with OpenCode's logo.
 */

import { For } from "solid-js";
import { useTheme } from "../context/theme.jsx";

const LOGO_LINES = [
	"  ╭━━━╮  ",
	"  ┃╺╮╺┃  ",
	"  ┃╹ ╹┃  ",
	"  ╰┳━┳╯  ",
	"   ┗━┛   ",
];

const KAPY = "KAPY";
const TAGLINE = "agent-first cli";

export function Logo() {
	const { theme } = useTheme();

	return (
		<box flexDirection="row" gap={1}>
			<box>
				<For each={LOGO_LINES}>
					{(line) => (
						<text fg={theme().textMuted} selectable={false}>
							{line}
						</text>
					)}
				</For>
			</box>
			<box>
				<For each={KAPY.split("")}>
					{(char, i) => (
						<text fg={theme().accent} attributes={1} selectable={false}>
							{char}
						</text>
					)}
				</For>
				<text fg={theme().textMuted} selectable={false}>
					{`  ${TAGLINE}`}
				</text>
			</box>
		</box>
	);
}