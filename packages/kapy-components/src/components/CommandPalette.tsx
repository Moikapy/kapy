/**
 * CommandPalette — slash command autocomplete overlay for kapy TUI.
 *
 * Displays a filtered list of commands when the user types "/"
 * in the input. Items highlight on selection with arrow keys.
 */

import type { JSX } from "solid-js";
import { For, Show } from "solid-js";
import { colors } from "../theme.js";

/** A single command definition for the palette. */
export interface CommandEntry {
	/** Command trigger (e.g. "/help", "/model") */
	name: string;
	/** Short description shown in palette */
	description: string;
	/** Aliases (e.g. ["/sb"] for "/sidebar") */
	aliases?: string[];
	/** Whether the command takes an argument (e.g. "/model <id>") */
	takesArg?: boolean;
	/** Label for the argument (e.g. "model-id") */
	argLabel?: string;
}

export interface CommandPaletteProps {
	/** Current input text — used to filter commands */
	input: string;
	/** Currently selected index */
	selectedIndex: number;
	/** Full command list to filter from */
	commands: CommandEntry[];
	/** Width override (defaults to 100%) */
	width?: number;
}

/** Render a single command row with highlight for selected item. */
function CommandRow(props: { cmd: CommandEntry; selected: boolean }): JSX.Element {
	const bg = () => (props.selected ? colors.primary + "22" : "transparent");
	const fg = () => (props.selected ? colors.text : colors.textMuted);
	const marker = () => (props.selected ? "▸" : " ");
	const alias = () => (props.cmd.aliases?.length ? ` (${props.cmd.aliases.join(", ")})` : "");
	const arg = () => (props.cmd.takesArg ? ` <${props.cmd.argLabel ?? "arg"}>` : "");

	return (
		<box width="100%" backgroundColor={bg()}>
			<text fg={colors.primary}>
				{marker()} {props.cmd.name}
			</text>
			<text fg={fg()}>
				{arg()} — {props.cmd.description}
				{alias()}
			</text>
		</box>
	);
}

/**
 * Filter commands by prefix (case-insensitive).
 * Matches name or any alias.
 */
export function filterCommands(prefix: string, commands: CommandEntry[]): CommandEntry[] {
	const lower = prefix.toLowerCase();
	return commands.filter((cmd) => {
		if (cmd.name.toLowerCase().startsWith(lower)) return true;
		return cmd.aliases?.some((a) => a.toLowerCase().startsWith(lower)) ?? false;
	});
}

/** Styled command palette overlay for slash command autocomplete. */
export function CommandPalette(props: CommandPaletteProps): JSX.Element {
	const filtered = () => filterCommands(props.input, props.commands);

	return (
		<Show when={props.input.startsWith("/") && filtered().length > 0}>
			<box
				flexShrink={0}
				border={["top"]}
				borderColor={colors.border}
				paddingLeft={2}
				paddingRight={2}
				paddingTop={0}
				paddingBottom={0}
				backgroundColor={colors.bg}
			>
				<box flexDirection="column" width={props.width ?? "100%"}>
					<For each={filtered()}>{(cmd, i) => <CommandRow cmd={cmd} selected={i() === props.selectedIndex} />}</For>
				</box>
			</box>
		</Show>
	);
}
