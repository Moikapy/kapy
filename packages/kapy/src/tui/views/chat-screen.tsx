import { useThemeColors } from "@moikapy/kapy-components";
import type { KeyBinding } from "@opentui/core";
import type { JSX } from "solid-js";
import { MessageInput, type MessageInputProps } from "../components/message-input.js";

interface ChatScreenProps {
	msgs: () => Msg[];
	err: () => string;
	streaming: () => boolean;
	queuedCount: () => number;
	keyBindings: KeyBinding[];
	onSubmit: MessageInputProps["onSubmit"];
	onSlashCommand: MessageInputProps["onSlashCommand"];
	onExit: MessageInputProps["onExit"];
	onKeyDown: MessageInputProps["onKeyDown"];
	scrollRef: (el: any) => void;
	inputRef: MessageInputProps["inputRef"];
	model?: string;
	thinkingLevel?: string;
}

import { createMemo, createSignal, onCleanup, Show } from "solid-js";
import { MessageItem } from "../components/message-item.js";
import type { Msg } from "../types.js";

const CONTEXT_TOOLS = new Set(["read_file", "glob", "grep", "find"]);

function isContextTool(m: Msg): boolean {
	if (m.role !== "tool_call") return false;
	return CONTEXT_TOOLS.has(m.toolName ?? parseToolName(m.content));
}

function parseToolName(content: string): string {
	const match = content.match(/⟹\s+(\w+)\(/);
	return match?.[1] ?? "";
}

function groupContextTools(msgs: Msg[]): Msg[] {
	const result: Msg[] = [];
	let buffer: Msg[] = [];

	function flush() {
		if (buffer.length < 2) {
			result.push(...buffer);
		} else {
			result.push({
				id: `ctx-grp-${buffer[0].id}`,
				role: "context_group",
				content: "",
				items: buffer,
			});
		}
		buffer = [];
	}

	for (const m of msgs) {
		if (
			isContextTool(m) ||
			(m.role === "tool_result" && buffer.length > 0 && buffer.some((b) => b.id === m.id.replace("tool-", "te-")))
		) {
			buffer.push(m);
		} else {
			flush();
			result.push(m);
		}
	}
	flush();
	return result;
}

export function ChatScreen(props: ChatScreenProps): JSX.Element {
	const c = useThemeColors();
	const [copyNotice, setCopyNotice] = createSignal("");
	let copyTimer: ReturnType<typeof setTimeout> | undefined;

	const groupedMsgs = createMemo(() => groupContextTools(props.msgs()));

	function handleCopy(text: string) {
		const preview = text.length > 40 ? `${text.slice(0, 37)}...` : text;
		setCopyNotice(`Copied: ${preview}`);
		clearTimeout(copyTimer);
		copyTimer = setTimeout(() => setCopyNotice(""), 2000);
	}

	onCleanup(() => clearTimeout(copyTimer));

	return (
		<box flexDirection="column" height="100%" paddingLeft={2} paddingRight={2}>
			<scrollbox ref={props.scrollRef} flexGrow={1} minHeight={3}>
				<box height={1} />
				<Show when={groupedMsgs().length === 0}>
					<text fg={c().muted}>No messages yet.</text>
				</Show>
				{groupedMsgs().map((m, i) => (
					<MessageItem msg={m} prev={i > 0 ? groupedMsgs()[i - 1] : undefined} onCopy={handleCopy} />
				))}
				<box height={2} />
			</scrollbox>
			<box flexShrink={0} flexDirection="column">
				<Show when={copyNotice().length > 0}>
					<text fg={c().success}>{copyNotice()}</text>
				</Show>
				<Show when={props.err().length > 0}>
					<text fg={c().error}>Error: {props.err()}</text>
				</Show>
				<Show when={props.streaming() && props.queuedCount() > 0}>
					<text fg={c().muted}>{props.queuedCount()} queued</text>
				</Show>
				<MessageInput
					keyBindings={props.keyBindings}
					onSubmit={props.onSubmit}
					onSlashCommand={props.onSlashCommand}
					onExit={props.onExit}
					onKeyDown={props.onKeyDown}
					inputRef={props.inputRef}
					model={props.model}
					thinkingLevel={props.thinkingLevel}
					streaming={props.streaming()}
				/>
			</box>
		</box>
	);
}
