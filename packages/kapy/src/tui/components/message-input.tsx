import { useThemeColors } from "@moikapy/kapy-components";
import type { KeyBinding } from "@opentui/core";
import type { JSX } from "solid-js";
import { createSignal, Show } from "solid-js";
import { usePromptHistory } from "../hooks/use-prompt-history.js";
import { ALL_PALETTE_COMMANDS, SLASH_COMMANDS } from "../hooks/use-slash-commands.js";
import { filterCommands } from "./command-palette.js";
import { SpinnerFrame } from "./spinner.js";

export interface MessageInputProps {
	keyBindings: KeyBinding[];
	placeholder?: string;
	onKeyDown: (evt: any) => void;
	onSubmit: (text: string) => void;
	onSlashCommand: (text: string) => boolean;
	onExit: () => void;
	inputRef: (el: any) => void;
	maxWidth?: number;
	model?: string;
	thinkingLevel?: string;
	streaming?: boolean;
}

export function MessageInput(props: MessageInputProps): JSX.Element {
	const c = useThemeColors();
	const [paletteIndex, setPaletteIndex] = createSignal(0);
	const [inputText, setInputText] = createSignal("");
	const promptHistory = usePromptHistory();
	let textRef: any;

	function syncFromBuffer() {
		if (textRef) setInputText(textRef.plainText ?? "");
	}

	function syncAfterKeyPress() {
		queueMicrotask(() => syncFromBuffer());
	}

	function showPalette(): boolean {
		const val = inputText();
		if (val.startsWith("/") && filterCommands(val, ALL_PALETTE_COMMANDS).length > 0) return true;
		return false;
	}

	function clearInput() {
		if (textRef) textRef.clear();
		syncFromBuffer();
	}

	function autoCompleteCommand(cmd: string) {
		const suffix = cmd.endsWith(":") || cmd.endsWith(" ") ? "" : " ";
		const text = cmd + suffix;
		if (textRef) {
			textRef.clear();
			textRef.insertText(text);
		}
		syncFromBuffer();
	}

	function executeCommand(cmd: string) {
		clearInput();
		const cmdDef = SLASH_COMMANDS.find((c) => c.name === cmd);
		if (cmdDef?.takesArg) {
			if (textRef) textRef.insertText(`${cmd} `);
			syncFromBuffer();
			return;
		}
		props.onSlashCommand(cmd);
	}

	function handleSubmit() {
		const raw = textRef?.plainText ?? "";
		const t = raw.trim();
		if (!t) return;

		if (textRef) textRef.clear();
		setInputText("");

		if (t === "exit" || t === ":q") {
			props.onExit();
			return;
		}
		if (t.startsWith("/")) {
			if (props.onSlashCommand(t)) return;
		}
		promptHistory.push(t);
		props.onSubmit(t);
	}

	return (
		<box flexDirection="column" width="100%" maxWidth={props.maxWidth}>
			<box flexShrink={0}>
				<box border={["left"]} borderColor={c().primary} width="100%">
					<box paddingLeft={2} paddingRight={2} paddingTop={1} paddingBottom={1} backgroundColor={c().bgInput}>
						<textarea
							focused
							placeholder={props.placeholder ?? "Message..."}
							placeholderColor={c().muted}
							textColor={c().text}
							focusedTextColor={c().text}
							focusedBackgroundColor={c().bgInput}
							cursorColor={c().text}
							minHeight={1}
							maxHeight={4}
							keyBindings={props.keyBindings}
							onKeyDown={(evt: any) => {
								syncFromBuffer();
								syncAfterKeyPress();

								if (showPalette()) {
									if (evt.name === "up") {
										evt.preventDefault();
										const cmds = filterCommands(inputText(), ALL_PALETTE_COMMANDS);
										setPaletteIndex((i) => (i - 1 + cmds.length) % cmds.length);
										return;
									}
									if (evt.name === "down") {
										evt.preventDefault();
										const cmds = filterCommands(inputText(), ALL_PALETTE_COMMANDS);
										setPaletteIndex((i) => (i + 1) % cmds.length);
										return;
									}
									if (evt.name === "tab") {
										evt.preventDefault();
										const cmds = filterCommands(inputText(), ALL_PALETTE_COMMANDS);
										if (cmds.length > 0) autoCompleteCommand(cmds[paletteIndex()].name);
										return;
									}
									if (evt.name === "return" && !evt.shift) {
										evt.preventDefault();
										const cmds = filterCommands(inputText(), ALL_PALETTE_COMMANDS);
										if (cmds.length > 0) executeCommand(cmds[paletteIndex()].name);
										return;
									}
								}

								if (evt.name === "return" && !evt.shift) {
									evt.preventDefault();
									handleSubmit();
									return;
								}

								if (!showPalette()) {
									if (evt.name === "up" && !inputText()) {
										evt.preventDefault();
										const prev = promptHistory.up("");
										if (prev !== null && textRef) {
											textRef.clear();
											textRef.insertText(prev);
											syncFromBuffer();
										}
										return;
									}
									if (evt.name === "down" && !inputText()) {
										evt.preventDefault();
										const next = promptHistory.down("");
										if (next !== null && textRef) {
											textRef.clear();
											textRef.insertText(next);
											syncFromBuffer();
										}
										return;
									}
								}

								props.onKeyDown(evt);
							}}
							ref={(r: any) => {
								textRef = r;
								r.onContentChange = () => syncFromBuffer();
								r.onSubmit = () => handleSubmit();
								props.inputRef(r);
								setTimeout(() => r?.focus(), 10);
							}}
						/>
						<box flexShrink={0} paddingTop={1} flexDirection="row" justifyContent="space-between">
							<box flexDirection="row" gap={1}>
								<text fg={c().primary}>▣</text>
								<text fg={c().text}>Kapy</text>
								<Show when={props.model}>
									<text fg={c().textMuted}> · </text>
									<text fg={c().text}>{props.model?.split(":").slice(1).join(":")}</text>
								</Show>
								<Show when={props.thinkingLevel && props.thinkingLevel !== "off"}>
									<text fg={c().textMuted}> · </text>
									<text fg={c().textMuted}>{props.thinkingLevel}</text>
								</Show>
							</box>
							<Show when={props.streaming}>
								<SpinnerFrame fg={c().primary} />
							</Show>
						</box>
					</box>
				</box>
			</box>
			<Show when={showPalette()}>
				<box
					flexShrink={0}
					border={["top"]}
					borderColor={c().borderDim}
					paddingLeft={2}
					paddingRight={2}
					backgroundColor={c().bgPanel}
				>
					{filterCommands(inputText(), ALL_PALETTE_COMMANDS)
						.slice(0, 6)
						.map((cmd, i) => (
							<box
								width="100%"
								backgroundColor={i === paletteIndex() ? c().bgElement : undefined}
								paddingLeft={1}
								paddingRight={1}
							>
								<text fg={i === paletteIndex() ? c().primary : c().muted}>
									{i === paletteIndex() ? "● " : "  "}
									{cmd.name}
								</text>
								<text fg={i === paletteIndex() ? c().text : c().muted}> — {cmd.description}</text>
							</box>
						))}
				</box>
			</Show>
		</box>
	);
}
