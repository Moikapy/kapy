/**
 * Kapy logo component — ASCII capybara with branding.
 * Matches the kapy capybara mascot from assets/capybara.webp
 * alongside the KAPY wordmark and tagline.
 */

import { For } from "solid-js";
import { useTheme } from "../context/theme.jsx";

// Hand-crafted ASCII capybara (side profile, matching our mascot)
const CAPYBARA = [
	"       ╭──────────╮       ",
	"    ╭──╯  ╱  ╲    ╰──╮    ",
	"    │  ╭─╯    ╰─╮   │    ",
	"    │  │  ◉    ◉  │  │    ",
	"    │  │    ╰──╯   │  │    ",
	"    │  ╰─╮  ╱╲  ╭─╯  │    ",
	"    │    │ ╱  ╲ │    │    ",
	"    ╰──╮ ╱ ╱╲ ╲╮ ╭──╯    ",
	"       ╰─╯  ╰───╯        ",
];

const KAPY = "KAPY";
const TAGLINE = "agent-first cli";

export function Logo() {
	const { theme } = useTheme();

	return (
		<box flexDirection="column" alignItems="center">
			<box flexDirection="row" gap={2} alignItems="center">
				{/* ASCII capybara */}
				<box flexDirection="column">
					<For each={CAPYBARA}>
						{(line) => (
							<text fg={theme().textMuted} selectable={false}>
								{line}
							</text>
						)}
					</For>
				</box>
				{/* KAPY wordmark + tagline */}
				<box flexDirection="column">
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
			</box>
		</box>
	);
}