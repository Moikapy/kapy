/**
 * MessageInput — shared textarea with command palette for kapy TUI.
 *
 * Encapsulates: styled textarea, slash command palette overlay,
 * palette keyboard navigation (↑↓ Tab/Enter), input value tracking,
 * and submit routing (slash commands vs regular messages vs exit).
 *
 * Used by both HomeScreen and ChatScreen for consistent behavior.
 */

import type { KeyBinding } from "@opentui/core";
import type { JSX } from "solid-js";
import { createEffect, createSignal, on, Show } from "solid-js";
import { SLASH_COMMANDS } from "../hooks/use-slash-commands.js";
import { CommandPalette, filterCommands } from "./command-palette.js";

export interface MessageInputProps {
	/** Keyboard bindings for textarea */
	keyBindings: KeyBinding[];
	/** Placeholder text */
	placeholder?: string;
	/** Global key handler for non-palette keys (Escape, Ctrl+\) */
	onKeyDown: (evt: any) => void;
	/** Called when user submits a regular (non-slash, non-exit) message */
	onSubmit: (text: string) => void;
	/** Called when user submits a recognized slash command */
	onSlashCommand: (text: string) => boolean;
	/** Called when user types "exit" or ":q" */
	onExit: () => void;
	/** Callback ref for the textarea element */
	inputRef: (el: any) => void;
	/** Max width for the input box (e.g. on home screen) */
	maxWidth?: number;
}

export function MessageInput(props: MessageInputProps): JSX.Element {
	const [inputVal, setInputVal] = createSignal("");
	const [paletteIndex, setPaletteIndex] = createSignal(0);
	/** Flag to skip the next onSubmit (when Enter was consumed by palette) */
	let skipNextSubmit = false;
	let textRef: any;

	// Reset palette selection when input changes
	createEffect(
		on(inputVal, () => {
			setPaletteIndex(0);
		}),
	);

	const showPalette = () => inputVal().startsWith("/") && filterCommands(inputVal(), SLASH_COMMANDS).length > 0;

	/** Clear input and reset textarea */
	function clearInput() {
		setInputVal("");
		if (textRef) textRef.clear();
	}

	/** Fill input with a command from palette — Tab autocomplete only */
	function autoCompleteCommand(cmd: string) {
		const suffix = cmd.endsWith(":") || cmd.endsWith(" ") ? "" : " ";
		const text = cmd + suffix;
		// For commands that take an arg, fill input and let user type the arg
		// For argumentless commands, just fill — user presses Enter to execute
		setInputVal(text);
		if (textRef) {
			textRef.clear();
			textRef.insertText(text);
		}
	}

	/** Immediately execute a command from the palette — Enter selection */
	function executeCommand(cmd: string) {
		clearInput();
		// For commands taking an arg, auto-complete + space but don't execute yet
		const cmdDef = SLASH_COMMANDS.find((c) => c.name === cmd);
		if (cmdDef?.takesArg) {
			const text = `${cmd} `;
			setInputVal(text);
			if (textRef) {
				textRef.insertText(text);
			}
			return;
		}
		// No arg needed — execute immediately
		props.onSlashCommand(cmd);
	}

	/** Process submission — routes to onSlashCommand, onExit, or onSubmit */
	function handleSubmit() {
		// If Enter was consumed by palette selection, skip this submit
		if (skipNextSubmit) {
			skipNextSubmit = false;
			return;
		}

		const t = inputVal().trim();
		if (!t) return;
		if (t === "exit" || t === ":q") {
			clearInput();
			props.onExit();
			return;
		}
		if (t.startsWith("/") && props.onSlashCommand(t)) {
			clearInput();
			return;
		}
		clearInput();
		props.onSubmit(t);
	}

	return (
		<box flexDirection="column" width="100%" maxWidth={props.maxWidth}>
			{/* Command palette overlay */}
			<Show when={showPalette()}>
				<CommandPalette input={inputVal()} selectedIndex={paletteIndex()} commands={SLASH_COMMANDS} />
			</Show>
			<box flexShrink={0}>
				<box border={["left"]} borderColor="#00AAFF" width="100%">
					<box paddingLeft={2} paddingRight={2} paddingTop={1} paddingBottom={1} backgroundColor="#22223a">
						<textarea
							focused
							placeholder={props.placeholder ?? "Message..."}
							placeholderColor="#565f89"
							textColor="#c0caf5"
							focusedTextColor="#c0caf5"
							focusedBackgroundColor="#22223a"
							cursorColor="#c0caf5"
							minHeight={1}
							maxHeight={4}
							keyBindings={props.keyBindings}
							onContentChange={() => {
								if (textRef) setInputVal(textRef.plainText);
							}}
							onKeyDown={(evt: any) => {
								// Command palette navigation intercepts keys
								if (showPalette()) {
									if (evt.name === "up") {
										const cmds = filterCommands(inputVal(), SLASH_COMMANDS);
										setPaletteIndex((i) => (i - 1 + cmds.length) % cmds.length);
										return;
									}
									if (evt.name === "down") {
										const cmds = filterCommands(inputVal(), SLASH_COMMANDS);
										setPaletteIndex((i) => (i + 1) % cmds.length);
										return;
									}
									if (evt.name === "tab") {
										// Tab → autocomplete only (fill input, don't execute)
										const cmds = filterCommands(inputVal(), SLASH_COMMANDS);
										if (cmds.length > 0) autoCompleteCommand(cmds[paletteIndex()].name);
										return;
									}
									if (evt.name === "return" && !evt.shift) {
										// Enter → execute the selected command immediately
										const cmds = filterCommands(inputVal(), SLASH_COMMANDS);
										if (cmds.length > 0) {
											skipNextSubmit = true;
											executeCommand(cmds[paletteIndex()].name);
										}
										return;
									}
								}
								// Fall through to parent key handler
								props.onKeyDown(evt);
							}}
							onSubmit={handleSubmit}
							ref={(r: any) => {
								textRef = r;
								props.inputRef(r);
								setTimeout(() => r?.focus(), 10);
							}}
						/>
					</box>
				</box>
			</box>
		</box>
	);
}
