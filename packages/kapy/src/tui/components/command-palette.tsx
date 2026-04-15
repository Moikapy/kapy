/**
 * CommandPalette — slash command autocomplete overlay.
 *
 * Appears when the user types "/" in the input, showing matching commands.
 * Arrow keys navigate, Enter/Tab selects, Escape dismisses.
 */

import type { JSX } from "solid-js";
import { For, Show } from "solid-js";
import { filterCommands, type SlashCommand } from "../hooks/use-slash-commands.js";

interface CommandPaletteProps {
	/** Current input text — used to filter commands */
	input: string;
	/** Currently selected index in the palette */
	selectedIndex: number;
}

/** Render a single command row with highlight for selected item. */
function CommandRow(props: { cmd: SlashCommand; selected: boolean; index: number }): JSX.Element {
	const bg = () => (props.selected ? "#00AAFF22" : "transparent");
	const fg = () => (props.selected ? "#c0caf5" : "#a9b1d6");
	const marker = () => (props.selected ? "▸" : " ");
	const alias = () => (props.cmd.aliases?.length ? ` (${props.cmd.aliases.join(", ")})` : "");
	const arg = () => (props.cmd.takesArg ? ` <${props.cmd.argLabel ?? "arg"}>` : "");

	return (
		<box width="100%" backgroundColor={bg()}>
			<text fg="#00AAFF">
				{marker()} {props.cmd.name}
			</text>
			<text fg={fg()}>
				{arg()} — {props.cmd.description}
				{alias()}
			</text>
		</box>
	);
}

export function CommandPalette(props: CommandPaletteProps): JSX.Element {
	const filtered = () => filterCommands(props.input);

	return (
		<Show when={props.input.startsWith("/") && filtered().length > 0}>
			<box
				flexShrink={0}
				border={["top"]}
				borderColor="#444466"
				paddingLeft={2}
				paddingRight={2}
				paddingTop={0}
				paddingBottom={0}
				backgroundColor="#1a1b26"
			>
				<box flexDirection="column" width="100%">
					<For each={filtered()}>
						{(cmd, i) => <CommandRow cmd={cmd} selected={i() === props.selectedIndex} index={i()} />}
					</For>
				</box>
			</box>
		</Show>
	);
}
