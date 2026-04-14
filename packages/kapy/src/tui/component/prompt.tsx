/**
 * Prompt component — real keyboard input using OpenTUI's TextareaRenderable.
 *
 * Architecture based on research of OpenCode and Pi TUI:
 * - Enter = submit (via keyBindings, not default newline)
 * - Shift+Enter = newline (multi-line input)
 * - Ctrl+C / Ctrl+D with empty input = exit app
 * - Escape = abort / exit shell mode
 * - `!` prefix = shell command
 * - Tab = cycle agents (future)
 *
 * Key fix: TextareaRenderable defaults to Enter=newline.
 * We MUST pass keyBindings to remap Enter to "submit" action.
 * The onSubmit callback fires when "submit" action triggers.
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
import type { KeyBinding } from "@opentui/core";

export type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high";

export interface PromptRef {
	focused: boolean;
	current: { input: string };
	set: (val: { input: string }) => void;
	submit: () => void;
	focus: () => void;
	blur: () => void;
}

/**
 * Key bindings for the prompt textarea.
 * Enter = submit (not newline), Shift+Enter = newline.
 * This matches OpenCode and Pi's prompt behavior.
 */
const PROMPT_KEY_BINDINGS: KeyBinding[] = [
	{ name: "return", action: "submit" },
	{ name: "return", shift: true, action: "newline" },
];

interface PromptProps {
	ref?: (r: PromptRef | undefined) => void;
	visible?: boolean;
	disabled?: boolean;
	/** Placeholder suggestions to rotate through */
	placeholders?: { normal?: string[]; shell?: string[] };
	onSubmit?: (input: string, opts?: { followUp?: boolean }) => void;
	sessionID?: string;
	/** Current agent name (displayed in prompt bar) */
	agentName?: string;
	/** Current model display name */
	modelName?: string;
	right?: JSX.Element;
}

export function Prompt(props: PromptProps) {
	const { theme } = useTheme();
	const route = useRoute();
	const exit = useExit();
	const [input, setInput] = createSignal("");
	const [shellMode, setShellMode] = createSignal(false);
	const [thinkingHint, setThinkingHint] = createSignal<string>("");
	let textareaRef: any;

	const placeholder = () => {
		if (shellMode()) {
			const shellList = props.placeholders?.shell ?? ["ls -la", "git status", "pwd"];
			const idx = Math.floor(Date.now() / 8000) % shellList.length;
			return `Shell: ${shellList[idx]}`;
		}
		const list = props.placeholders?.normal ?? [
			"Fix a TODO in the codebase",
			"What is the tech stack?",
			"Fix broken tests",
		];
		const idx = Math.floor(Date.now() / 8000) % list.length;
		return list[idx];
	};

	const accent = () => shellMode() ? theme().warning : theme().accent;

	const ref: PromptRef = {
		get focused() { return textareaRef?.focused ?? false; },
		get current() { return { input: input() }; },
		set(val: { input: string }) {
			setInput(val.input);
			if (textareaRef) textareaRef.setText(val.input);
		},
		submit() { doSubmit(); },
		focus() { textareaRef?.focus(); },
		blur() { textareaRef?.blur(); },
	};

	onMount(() => {
		props.ref?.(ref);
		// CRITICAL: The 'focused' prop doesn't actually focus the textarea.
		// We must call .focus() explicitly after mount.
		setTimeout(() => textareaRef?.focus(), 0);
	});
	onCleanup(() => { props.ref?.(undefined); });

	const doSubmit = (opts?: { followUp?: boolean }) => {
		if (props.disabled) return;
		const text = input().trim();
		if (!text) return;

		// Exit commands
		if (text === "exit" || text === "quit" || text === ":q") {
			exit();
			return;
		}

		// Shell mode: !command
		if (text.startsWith("!") && !shellMode()) {
			const cmd = text.slice(1).trim();
			if (cmd) {
				setInput("");
				if (textareaRef) textareaRef.clear();
				props.onSubmit?.(cmd, { followUp: opts?.followUp });
			}
			return;
		}

		// Clear input and reset
		setInput("");
		if (textareaRef) textareaRef.clear();
		setThinkingHint("");

		// Navigate to session on first submit from home
		if (route.data().type === "home") {
			route.navigate({
				type: "session",
				sessionID: `session-${Date.now()}`,
				initialPrompt: { input: text, parts: [] },
			});
		}

		props.onSubmit?.(text, { followUp: opts?.followUp });
	};

	createEffect(() => {
		if (textareaRef && !textareaRef.isDestroyed) {
			textareaRef.cursorColor = props.disabled ? theme().border : theme().text;
			textareaRef.traits = {
				suspend: !!props.disabled,
				status: shellMode() ? "SHELL" : undefined,
			};
		}
	});

	// Re-focus when visibility changes (dialog closes, route changes back to home)
	createEffect(() => {
		if (props.visible === false) {
			textareaRef?.blur();
		} else if (textareaRef && !textareaRef.isDestroyed && textareaRef.focused === false) {
			// Only re-focus if not already focused and not suspended
			if (!props.disabled) {
				textareaRef.focus();
			}
		}
	});

	const agentLabel = () => {
		const name = props.agentName ?? "kapy";
		const model = props.modelName ?? "";
		return model ? `${name} · ${model}` : name;
	};

	return (
		<box visible={props.visible !== false}>
			<box border={["left"]} borderColor={accent()}>
				<box
					paddingLeft={2}
					paddingRight={2}
					paddingTop={1}
					flexGrow={1}
					backgroundColor={theme().backgroundElement}
				>
					<textarea
						focused
						placeholder={placeholder()}
						placeholderColor={theme().textMuted}
						textColor={theme().text}
						focusedTextColor={theme().text}
						focusedBackgroundColor={theme().backgroundElement}
						cursorColor={theme().text}
						minHeight={1}
						maxHeight={6}
						keyBindings={PROMPT_KEY_BINDINGS}
						onContentChange={() => {
							if (textareaRef) setInput(textareaRef.plainText);
						}}
						onKeyDown={(e: any) => {
							if (props.disabled) { e.preventDefault(); return; }

							// Escape: exit shell mode or abort
							if (e.name === "escape") {
								if (shellMode()) {
									setShellMode(false);
									e.preventDefault();
									return;
								}
								return;
							}

							// ! at start → shell mode
							if (e.name === "!" && textareaRef?.visualCursor?.offset === 0) {
								setShellMode(true);
								e.preventDefault();
								return;
							}

							// Backspace at start in shell mode → exit shell mode
							if (e.name === "backspace" && shellMode() && textareaRef?.visualCursor?.offset === 0) {
								setShellMode(false);
								e.preventDefault();
								return;
							}
						}}
						onSubmit={() => {
							// Double-defer for IME (OpenCode pattern)
							setTimeout(() => setTimeout(() => doSubmit(), 0), 0);
						}}
						ref={(r: any) => { textareaRef = r; }}
					/>

					{/* Prompt bar: agent, model, hints */}
					<box flexDirection="row" flexShrink={0} paddingTop={1} gap={1} justifyContent="space-between">
						<box flexDirection="row" gap={1}>
							<text fg={accent()}>
								{shellMode() ? "!" : "⟩"}
							</text>
							<text fg={theme().text}>
								{agentLabel()}
							</text>
							<Show when={thinkingHint()}>
								<text fg={theme().textMuted}>
									💭 {thinkingHint()}
								</text>
							</Show>
						</box>
						{props.right}
					</box>
				</box>
			</box>

			{/* Bottom keybinding hints */}
			<box width="100%" flexDirection="row" justifyContent="space-between" paddingTop={1}>
				<text fg={theme().textMuted}>
					esc abort
				</text>
				<text fg={theme().textMuted}>
					enter send · shift+enter newline
				</text>
			</box>
		</box>
	);
}