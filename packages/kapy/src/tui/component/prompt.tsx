/**
 * Prompt component — the main input box for agent queries.
 * 1:1 with OpenCode's Prompt — multiline textarea with slash commands.
 */

import {
	createSignal,
	createEffect,
	onCleanup,
	onMount,
	type JSX,
	type Setter,
	Show,
} from "solid-js";
import { useTheme } from "../context/theme.jsx";
import { useRoute } from "../context/route.jsx";

export interface PromptRef {
	current: { input: string; parts: unknown[] };
	set: (val: { input: string; parts: unknown[] }) => void;
	submit: () => void;
}

interface PromptProps {
	ref?: (r: PromptRef | undefined) => void;
	visible?: boolean;
	disabled?: boolean;
	placeholder?: Record<string, string[]>;
	onSubmit?: () => void;
	sessionID?: string;
	right?: JSX.Element;
}

export function Prompt(props: PromptProps) {
	const { theme } = useTheme();
	const route = useRoute();
	const [input, setInput] = createSignal("");
	const [focused, setFocused] = createSignal(true);
	let textareaRef: HTMLTextAreaElement | undefined;

	const ref: PromptRef = {
		get current() {
			return { input: input(), parts: [] };
		},
		set(val: { input: string; parts: unknown[] }) {
			setInput(val.input);
		},
		submit() {
			onSubmitInternal();
		},
	};

	onMount(() => {
		props.ref?.(ref);
	});

	onCleanup(() => {
		props.ref?.(undefined);
	});

	const onSubmitInternal = () => {
		const text = input().trim();
		if (!text) return;
		// Navigate to session on submit
		route.navigate({
			type: "session",
			sessionID: `session-${Date.now()}`,
			initialPrompt: { input: text, parts: [] },
		});
		setInput("");
		props.onSubmit?.();
	};

	// Placeholder rotation
	const placeholders = () => {
		const list = props.placeholder?.normal ?? [
			"Fix a TODO in the codebase",
			"What is the tech stack of this project?",
			"Fix broken tests",
		];
		const idx = Math.floor(Date.now() / 8000) % list.length;
		return list[idx];
	};

	const borderColor = () => {
		if (props.disabled) return theme().border;
		if (focused()) return theme().accent;
		return theme().border;
	};

	return (
		<box
			border
			borderStyle="single"
			borderColor={borderColor()}
			backgroundColor={theme().backgroundPanel}
			padding={1}
			flexDirection="row"
			gap={1}
		>
			<text fg={theme().accent} selectable={false}>
				▸
			</text>
			<box flexGrow={1}>
				<Show
					when={input().length > 0}
					fallback={
						<text fg={theme().textMuted} selectable={false}>
							{placeholders()}
						</text>
					}
				>
					<text fg={theme().text}>{input()}</text>
				</Show>
			</box>
			{props.right}
		</box>
	);
}