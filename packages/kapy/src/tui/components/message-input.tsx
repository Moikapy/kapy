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
import { ALL_PALETTE_COMMANDS, SLASH_COMMANDS } from "../hooks/use-slash-commands.js";
import { filterCommands } from "./command-palette.js";

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

	const showPalette = () => inputVal().startsWith("/") && filterCommands(inputVal(), ALL_PALETTE_COMMANDS).length > 0;

	/** Clear input and reset textarea */
	function clearInput() {
		setInputVal("");
		if (textRef) textRef.clear();
	}

	/** Fill input with a command from palette — Tab autocomplete only */
	function autoCompleteCommand(cmd: string) {
		const suffix = cmd.endsWith(":") || cmd.endsWith(" ") ? "" : " ";
		const text = cmd + suffix;
		setInputVal(text);
		if (textRef) {
			textRef.clear();
			textRef.insertText(text);
		}
	}

	/** Immediately execute a command from the palette — Enter selection */
	function executeCommand(cmd: string) {
		clearInput();
		const cmdDef = SLASH_COMMANDS.find((c) => c.name === cmd);
		if (cmdDef?.takesArg) {
			const text = `${cmd} `;
			setInputVal(text);
			if (textRef) {
				textRef.insertText(text);
			}
			return;
		}
		props.onSlashCommand(cmd);
	}

	/** Process submission — routes to onSlashCommand, onExit, or onSubmit */
	function handleSubmit() {
		if (skipNextSubmit) {
			skipNextSubmit = false;
			return;
		}

		const t = inputVal().trim();
		if (!t) {
			if (textRef?.plainText?.trim()) {
				setInputVal(textRef.plainText);
				const recovered = textRef.plainText.trim();
				if (!recovered) return;
				clearInput();
				props.onSubmit(recovered);
				return;
			}
			return;
		}
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
							onContentChange={(newText: any) => {
								setInputVal(String(newText || textRef?.plainText || ""));
							}}
							onKeyDown={(evt: any) => {
								// Command palette navigation intercepts keys
								if (showPalette()) {
									if (evt.name === "up") {
										const cmds = filterCommands(inputVal(), ALL_PALETTE_COMMANDS);
										setPaletteIndex((i) => (i - 1 + cmds.length) % cmds.length);
										return;
									}
									if (evt.name === "down") {
										const cmds = filterCommands(inputVal(), ALL_PALETTE_COMMANDS);
										setPaletteIndex((i) => (i + 1) % cmds.length);
										return;
									}
									if (evt.name === "tab") {
										const cmds = filterCommands(inputVal(), ALL_PALETTE_COMMANDS);
										if (cmds.length > 0) autoCompleteCommand(cmds[paletteIndex()].name);
										return;
									}
									if (evt.name === "return" && !evt.shift) {
										const cmds = filterCommands(inputVal(), ALL_PALETTE_COMMANDS);
										if (cmds.length > 0) {
											skipNextSubmit = true;
											executeCommand(cmds[paletteIndex()].name);
										}
										return;
									}
								}
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
			{/* Palette renders BELOW the input in flow, pushed up by the input area */}
			<Show when={showPalette()}>
				<box
					flexShrink={0}
					border={["top"]}
					borderColor="#333"
					paddingLeft={2}
					paddingRight={2}
					backgroundColor="#1a1b26"
				>
					{/* Render UP TO 6 items max so it doesn't push input off screen */}
					{filterCommands(inputVal(), ALL_PALETTE_COMMANDS).slice(0, 6).map((cmd, i) => (
						<box width="100%" backgroundColor={i === paletteIndex() ? "#22223a" : "transparent"}>
							<text fg="#00AAFF">{i === paletteIndex() ? "▸ " : "  "}{cmd.name}</text>
							<text fg={i === paletteIndex() ? "#c0caf5" : "#565f89"}> — {cmd.description}</text>
						</box>
					))}
				</box>
			</Show>
		</box>
	);
}