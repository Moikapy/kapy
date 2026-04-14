/**
 * Prompt component — real keyboard input using OpenTUI's TextareaRenderable.
 *
 * Key design decisions (matching spec §9):
 * - NO plan/build mode. Kapy uses implicit thinking levels, not modes.
 * - Enter → steering message (sent after current tool calls finish)
 * - Shift+Enter → follow-up message (sent after agent finishes all work)
 * - Escape → abort + restore queued messages
 * - Ctrl+C / Ctrl+D with empty input → exit app (OpenCode pattern)
 * - `!` prefix → shell command
 * - Tab → cycle agents (future)
 *
 * Thinking levels are implicit per-request, not a mode switch.
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

export type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high";

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
		// Explicitly focus the textarea after mount.
		// The 'focused' prop alone doesn't trigger focus — we must call .focus().
		setTimeout(() => textareaRef?.focus(), 0);
	});
	onCleanup(() => { props.ref?.(undefined); });

	const doSubmit = (opts?: { followUp?: boolean }) => {
		if (props.disabled) return;
		const text = input().trim();
		if (!text) return;

		if (text === "exit" || text === "quit" || text === ":q") {
			exit();
			return;
		}

		if (text.startsWith("!") && !shellMode()) {
			const cmd = text.slice(1).trim();
			if (cmd) {
				setInput("");
				if (textareaRef) textareaRef.clear();
				props.onSubmit?.(cmd, { followUp: opts?.followUp });
			}
			return;
		}

		setInput("");
		if (textareaRef) textareaRef.clear();
		setThinkingHint("");

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
				status: shellMode() ? "!" : undefined,
			};
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
						onContentChange={() => {
							if (textareaRef) setInput(textareaRef.plainText);
						}}
						onKeyDown={(e: any) => {
							if (props.disabled) { e.preventDefault(); return; }

							// Ctrl+C or Ctrl+D with empty input → exit app (OpenCode pattern)
							if ((e.ctrl && (e.name === "c" || e.name === "d")) && input().trim() === "") {
								e.preventDefault();
								exit();
								return;
							}

							// Escape: abort current or exit shell mode
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

							// Backspace at start → exit shell mode
							if (e.name === "backspace" && shellMode() && textareaRef?.visualCursor?.offset === 0) {
								setShellMode(false);
								e.preventDefault();
								return;
							}

							// Shift+Enter → follow-up message (after agent finishes)
							if (e.name === "return" && e.shift) {
								e.preventDefault();
								doSubmit({ followUp: true });
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
					enter steer
					{"  "}
					shift+enter follow
					{"  "}
					! shell
				</text>
			</box>
		</box>
	);
}