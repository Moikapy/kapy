import type { KeyBinding } from "@opentui/core";
import type { JSX } from "solid-js";
import { createEffect, createSignal, on, Show } from "solid-js";
import { CommandPalette } from "../components/command-palette.js";
import { MessageItem } from "../components/message-item.js";
import { filterCommands } from "../hooks/use-slash-commands.js";
import type { Msg } from "../types.js";

interface ChatScreenProps {
	msgs: () => Msg[];
	err: () => string;
	streaming: () => boolean;
	keyBindings: KeyBinding[];
	onKeyDown: (evt: any) => void;
	onSubmit: () => void;
	scrollRef: (el: any) => void;
	inputRef: (el: any) => void;
	onContentChange: () => void;
	/** Current input text — drives the command palette */
	inputVal: string;
	/** Callback when user selects a command from the palette */
	onSelectCommand: (text: string) => void;
}

export function ChatScreen(props: ChatScreenProps): JSX.Element {
	// Command palette state
	const [paletteIndex, setPaletteIndex] = createSignal(0);

	// Reset palette selection when input changes
	createEffect(
		on(
			() => props.inputVal,
			() => {
				setPaletteIndex(0);
			},
		),
	);

	// Whether palette is visible
	const showPalette = () => props.inputVal.startsWith("/") && filterCommands(props.inputVal).length > 0;

	return (
		<box flexDirection="column" height="100%" paddingLeft={2} paddingRight={2}>
			<scrollbox ref={props.scrollRef} flexGrow={1} minHeight={0}>
				<box height={1} />
				<Show when={props.msgs().length === 0}>
					<text fg="#565f89">No messages yet.</text>
				</Show>
				{props.msgs().map((m) => (
					<MessageItem msg={m} />
				))}
				<box height={2} />
			</scrollbox>
			<Show when={props.err().length > 0}>
				<text fg="#f7768e">Error: {props.err()}</text>
			</Show>
			<Show when={props.streaming()}>
				<text fg="#565f89">thinking...</text>
			</Show>
			{/* Command palette overlay — appears when typing / */}
			<Show when={showPalette()}>
				<CommandPalette input={props.inputVal} selectedIndex={paletteIndex()} />
			</Show>
			<box flexShrink={0}>
				<box border={["left"]} borderColor="#00AAFF" width="100%">
					<box paddingLeft={2} paddingRight={2} paddingTop={1} paddingBottom={1} backgroundColor="#22223a">
						<textarea
							focused
							placeholder="Message..."
							placeholderColor="#565f89"
							textColor="#c0caf5"
							focusedTextColor="#c0caf5"
							focusedBackgroundColor="#22223a"
							cursorColor="#c0caf5"
							minHeight={1}
							maxHeight={4}
							keyBindings={props.keyBindings}
							onContentChange={props.onContentChange}
							onKeyDown={(evt: any) => {
								// Command palette navigation
								if (showPalette()) {
									if (evt.name === "up") {
										const cmds = filterCommands(props.inputVal);
										setPaletteIndex((i) => (i - 1 + cmds.length) % cmds.length);
										return;
									}
									if (evt.name === "down") {
										const cmds = filterCommands(props.inputVal);
										setPaletteIndex((i) => (i + 1) % cmds.length);
										return;
									}
									if (evt.name === "tab" || (evt.name === "return" && !evt.shift)) {
										const cmds = filterCommands(props.inputVal);
										if (cmds.length > 0) {
											props.onSelectCommand(cmds[paletteIndex()].name);
										}
										return;
									}
								}
								// Fall through to parent handler
								props.onKeyDown(evt);
							}}
							onSubmit={props.onSubmit}
							ref={props.inputRef}
						/>
					</box>
				</box>
			</box>
		</box>
	);
}
