import type { KeyBinding } from "@opentui/core";
import type { JSX } from "solid-js";
import { Show } from "solid-js";
import { MessageInput, type MessageInputProps } from "../components/message-input.js";
import { MessageItem } from "../components/message-item.js";
import type { Msg } from "../types.js";

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
}

export function ChatScreen(props: ChatScreenProps): JSX.Element {
	return (
		<box flexDirection="column" height="100%" paddingLeft={2} paddingRight={2}>
			{/* Messages area — takes remaining space, scrolls */}
			<scrollbox ref={props.scrollRef} flexGrow={1} minHeight={3}>
				<box height={1} />
				<Show when={props.msgs().length === 0}>
					<text fg="#565f89">No messages yet.</text>
				</Show>
				{props.msgs().map((m) => (
					<MessageItem msg={m} />
				))}
				<box height={2} />
			</scrollbox>
			{/* Bottom area — error, status, input + palette. Never shrinks. */}
			<box flexShrink={0} flexDirection="column">
				<Show when={props.err().length > 0}>
					<text fg="#f7768e">Error: {props.err()}</text>
				</Show>
				<Show when={props.streaming()}>
					<text fg="#565f89">thinking{props.queuedCount() > 0 ? ` · ${props.queuedCount()} queued` : ""}...</text>
				</Show>
				<MessageInput
					keyBindings={props.keyBindings}
					onSubmit={props.onSubmit}
					onSlashCommand={props.onSlashCommand}
					onExit={props.onExit}
					onKeyDown={props.onKeyDown}
					inputRef={props.inputRef}
				/>
			</box>
		</box>
	);
}