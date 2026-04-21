import type { JSX } from "solid-js";
import { For, Show } from "solid-js";
import { useThemeColors } from "../theme.js";

export interface CommandEntry {
	name: string;
	description: string;
	aliases?: string[];
	takesArg?: boolean;
	argLabel?: string;
}

export interface CommandPaletteProps {
	input: string;
	selectedIndex: number;
	commands: CommandEntry[];
	width?: number;
}

function CommandRow(props: { cmd: CommandEntry; selected: boolean }): JSX.Element {
	const c = useThemeColors();
	const bg = () => (props.selected ? `${c().primary}22` : "transparent");
	const fg = () => (props.selected ? c().text : c().textMuted);
	const marker = () => (props.selected ? "▸" : " ");
	const alias = () => (props.cmd.aliases?.length ? ` (${props.cmd.aliases.join(", ")})` : "");
	const arg = () => (props.cmd.takesArg ? ` <${props.cmd.argLabel ?? "arg"}>` : "");

	return (
		<box width="100%" backgroundColor={bg()}>
			<text fg={c().primary}>
				{marker()} {props.cmd.name}
			</text>
			<text fg={fg()}>
				{arg()} — {props.cmd.description}
				{alias()}
			</text>
		</box>
	);
}

export function filterCommands(prefix: string, commands: CommandEntry[]): CommandEntry[] {
	const lower = prefix.toLowerCase();
	return commands.filter((cmd) => {
		if (cmd.name.toLowerCase().startsWith(lower)) return true;
		return cmd.aliases?.some((a) => a.toLowerCase().startsWith(lower)) ?? false;
	});
}

export function CommandPalette(props: CommandPaletteProps): JSX.Element {
	const c = useThemeColors();
	const filtered = () => filterCommands(props.input, props.commands);

	return (
		<Show when={props.input.startsWith("/") && filtered().length > 0}>
			<box
				flexShrink={0}
				border={["top"]}
				borderColor={c().border}
				paddingLeft={2}
				paddingRight={2}
				paddingTop={0}
				paddingBottom={0}
				backgroundColor={c().bg}
			>
				<box flexDirection="column" width={props.width ?? "100%"}>
					<For each={filtered()}>{(cmd, i) => <CommandRow cmd={cmd} selected={i() === props.selectedIndex} />}</For>
				</box>
			</box>
		</Show>
	);
}
