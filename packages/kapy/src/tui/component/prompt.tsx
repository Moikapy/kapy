/**
 * Prompt component — real keyboard input using OpenTUI's TextareaRenderable.
 * 1:1 with OpenCode's Prompt component architecture.
 *
 * Uses <textarea> intrinsic from @opentui/solid for actual keyboard input,
 * cursor, selection, paste, and multiline support.
 */

import {
	createSignal,
	createEffect,
	onCleanup,
	onMount,
	Show,
	type JSX,
} from "solid-js";
import { useTheme } from "../context/theme.jsx";
import { useRoute } from "../context/route.jsx";
import { useExit } from "../context/exit.jsx";
import { useKeyboard, useRenderer } from "@opentui/solid";

export interface PromptRef {
	focused: boolean;
	current: { input: string };
	set: (val: { input: string }) => void;
	submit: () => void;
	focus: () => void;
	blur: () => void;
}

interface PromptProps {
	ref?: (r: PromptRef | undefined) => void;
	visible?: boolean;
	disabled?: boolean;
	/** Placeholder suggestions to rotate through */
	placeholders?: { normal?: string[]; shell?: string[] };
	onSubmit?: (input: string) => void;
	sessionID?: string;
	right?: JSX.Element;
}

export function Prompt(props: PromptProps) {
	const { theme } = useTheme();
	const route = useRoute();
	const exit = useExit();
	const [input, setInput] = createSignal("");
	const [mode, setMode] = createSignal<"normal" | "shell">("normal");
	let textareaRef: any; // TextareaRenderable ref

	// Placeholder rotation
	const placeholder = () => {
		const list = props.placeholders?.normal ?? [
			"Fix a TODO in the codebase",
			"What is the tech stack?",
			"Fix broken tests",
		];
		if (mode() === "shell") {
			const shellList = props.placeholders?.shell ?? ["ls -la", "git status", "pwd"];
			const idx = Math.floor(Date.now() / 8000) % shellList.length;
			return `Run a command... "${shellList[idx]}"`;
		}
		const idx = Math.floor(Date.now() / 8000) % list.length;
		return `Ask anything... "${list[idx]}"`;
	};

	// Accent color from current mode
	const highlight = () => {
		if (mode() === "shell") return theme().primary;
		return theme().accent;
	};

	const ref: PromptRef = {
		get focused() {
			return textareaRef?.focused ?? false;
		},
		get current() {
			return { input: input() };
		},
		set(val: { input: string }) {
			setInput(val.input);
			if (textareaRef) {
				textareaRef.setText(val.input);
			}
		},
		submit() {
			doSubmit();
		},
		focus() {
			textareaRef?.focus();
		},
		blur() {
			textareaRef?.blur();
		},
	};

	onMount(() => {
		props.ref?.(ref);
	});

	onCleanup(() => {
		props.ref?.(undefined);
	});

	const doSubmit = () => {
		if (props.disabled) return;
		const text = input().trim();
		if (!text) return;

		// Check for exit commands
		if (text === "exit" || text === "quit" || text === ":q") {
			exit();
			return;
		}

		// Shell mode trigger
		if (text.startsWith("!") && mode() === "normal") {
			setMode("shell");
			return;
		}

		// Clear input
		setInput("");
		if (textareaRef) {
			textareaRef.clear();
		}

		// Navigate to session on first submit from home
		if (route.data().type === "home") {
			route.navigate({
				type: "session",
				sessionID: `session-${Date.now()}`,
				initialPrompt: { input: text, parts: [] },
			});
		}

		props.onSubmit?.(text);
	};

	createEffect(() => {
		if (textareaRef && !textareaRef.isDestroyed) {
			textareaRef.cursorColor = props.disabled ? theme().border : theme().text;
			textareaRef.traits = {
				suspend: !!props.disabled,
				status: mode() === "shell" ? "SHELL" : undefined,
			};
		}
	});

	return (
		<box visible={props.visible !== false}>
			<box
				border={["left"]}
				borderColor={highlight()}
			>
				<box
					paddingLeft={2}
					paddingRight={2}
					paddingTop={1}
					flexGrow={1}
					backgroundColor={theme().backgroundElement}
				>
					<textarea
						placeholder={placeholder()}
						placeholderColor={theme().textMuted}
						textColor={theme().text}
						focusedTextColor={theme().text}
						focusedBackgroundColor={theme().backgroundElement}
						cursorColor={theme().text}
						minHeight={1}
						maxHeight={6}
						onContentChange={() => {
							if (textareaRef) {
								setInput(textareaRef.plainText);
							}
						}}
						onKeyDown={(e: any) => {
							if (props.disabled) {
								e.preventDefault();
								return;
							}
							// Escape exits shell mode
							if (e.name === "escape" && mode() === "shell") {
								setMode("normal");
								e.preventDefault();
								return;
							}
							// Backspace at start exits shell mode
							if (e.name === "backspace" && mode() === "shell" && textareaRef?.visualCursor?.offset === 0) {
								setMode("normal");
								e.preventDefault();
								return;
							}
							// ! at start of line enters shell mode
							if (e.name === "!" && textareaRef?.visualCursor?.offset === 0) {
								setMode("shell");
								e.preventDefault();
								return;
							}
						}}
						onSubmit={() => {
							// Double-defer for IME (OpenCode pattern)
							setTimeout(() => setTimeout(() => doSubmit(), 0), 0);
						}}
						ref={(r: any) => {
							textareaRef = r;
						}}
						onMouseDown={(e: any) => e.target?.focus()}
					/>

					{/* Label bar below textarea */}
					<box flexDirection="row" flexShrink={0} paddingTop={1} gap={1} justifyContent="space-between">
						<box flexDirection="row" gap={1}>
							<text fg={highlight()}>
								{mode() === "shell" ? "Shell" : "Build"}{" "}
							</text>
							<Show when={mode() === "normal"}>
								<text fg={theme().text}>
									{props.sessionID ? "qwen3:32b" : ""}
								</text>
							</Show>
						</box>
						{props.right}
					</box>
				</box>
			</box>

			{/* Bottom hint bar */}
			<box width="100%" flexDirection="row" justifyContent="space-between" paddingTop={1}>
				<text fg={theme().textMuted}>
					esc <span style={{ fg: theme().textMuted }}>interrupt</span>
				</text>
				<text fg={theme().text}>
					tab <span style={{ fg: theme().textMuted }}>agents</span>{" "}
					ctrl+k <span style={{ fg: theme().textMuted }}>commands</span>
				</text>
			</box>
		</box>
	);
}