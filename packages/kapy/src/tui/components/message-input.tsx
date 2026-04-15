/**
 * MessageInput — shared textarea with command palette for kapy TUI.
 *
 * NOTE: OpenTUI's Solid textarea does NOT fire onContentChange reliably.
 * We use a "tick" counter signal that increments on every keydown to force
 * re-evaluation of computed values like showPalette().
 */

import type { KeyBinding } from "@opentui/core";
import type { JSX } from "solid-js";
import { createSignal, Show } from "solid-js";
import { ALL_PALETTE_COMMANDS, SLASH_COMMANDS } from "../hooks/use-slash-commands.js";
import { filterCommands } from "./command-palette.js";

const DEBUG_LOG = "/tmp/kapy-debug.log";
function dbg(...args: any[]) {
	try {
		const ts = new Date().toISOString().slice(11, 23);
		const line = args.map(a => typeof a === "string" ? a : JSON.stringify(a)).join(" ");
		require("fs").appendFileSync(DEBUG_LOG, `${ts} ${line}\n`);
	} catch {}
}

export interface MessageInputProps {
	keyBindings: KeyBinding[];
	placeholder?: string;
	onKeyDown: (evt: any) => void;
	onSubmit: (text: string) => void;
	onSlashCommand: (text: string) => boolean;
	onExit: () => void;
	inputRef: (el: any) => void;
	maxWidth?: number;
}

export function MessageInput(props: MessageInputProps): JSX.Element {
	const [paletteIndex, setPaletteIndex] = createSignal(0);
	// Tick counter — incremented on every keydown to trigger reactive updates
	const [tick, setTick] = createSignal(0);
	let skipNextSubmit = false;
	let textRef: any;

	/** Read current input value directly from textarea ref */
	function getInputText(): string {
		tick(); // access tick to make this reactive
		return textRef?.plainText ?? "";
	}

	/** Check if palette should show (reactive via tick) */
	function showPalette(): boolean {
		const val = getInputText();
		const result = val.startsWith("/") && filterCommands(val, ALL_PALETTE_COMMANDS).length > 0;
		return result;
	}

	/** Clear input and reset textarea */
	function clearInput() {
		if (textRef) textRef.clear();
		setTick(t => t + 1); // trigger re-render
	}

	/** Fill input with a command from palette — Tab autocomplete only */
	function autoCompleteCommand(cmd: string) {
		const suffix = cmd.endsWith(":") || cmd.endsWith(" ") ? "" : " ";
		const text = cmd + suffix;
		if (textRef) {
			textRef.clear();
			textRef.insertText(text);
		}
		setTick(t => t + 1); // trigger re-render
	}

	/** Immediately execute a command from the palette — Enter selection */
	function executeCommand(cmd: string) {
		clearInput();
		const cmdDef = SLASH_COMMANDS.find((c) => c.name === cmd);
		if (cmdDef?.takesArg) {
			if (textRef) textRef.insertText(`${cmd} `);
			setTick(t => t + 1);
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

		const t = getInputText().trim();
		dbg("handleSubmit", JSON.stringify(t));
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
							onKeyDown={(evt: any) => {
								// Increment tick on every key to keep reactive state fresh
								setTick(t => t + 1);

								// Command palette navigation intercepts keys
								if (showPalette()) {
									if (evt.name === "up") {
										const cmds = filterCommands(getInputText(), ALL_PALETTE_COMMANDS);
										setPaletteIndex((i) => (i - 1 + cmds.length) % cmds.length);
										return;
									}
									if (evt.name === "down") {
										const cmds = filterCommands(getInputText(), ALL_PALETTE_COMMANDS);
										setPaletteIndex((i) => (i + 1) % cmds.length);
										return;
									}
									if (evt.name === "tab") {
										const cmds = filterCommands(getInputText(), ALL_PALETTE_COMMANDS);
										if (cmds.length > 0) autoCompleteCommand(cmds[paletteIndex()].name);
										return;
									}
									if (evt.name === "return" && !evt.shift) {
										const cmds = filterCommands(getInputText(), ALL_PALETTE_COMMANDS);
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
			{/* Palette renders BELOW the input in flow, reactive via tick */}
			<Show when={showPalette()}>
				<box
					flexShrink={0}
					border={["top"]}
					borderColor="#333"
					paddingLeft={2}
					paddingRight={2}
					backgroundColor="#1a1b26"
				>
					{filterCommands(getInputText(), ALL_PALETTE_COMMANDS).slice(0, 6).map((cmd, i) => (
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