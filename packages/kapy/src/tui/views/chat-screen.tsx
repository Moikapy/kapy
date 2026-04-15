import type { KeyBinding } from "@opentui/core";
import type { JSX } from "solid-js";
import { Show } from "solid-js";
import { MessageItem } from "../components/message-item.js";
import type { Msg } from "../types.js";

interface ChatScreenProps {
	msgs: () => Msg[];
	err: () => string;
	streaming: () => boolean;
	keyBindings: KeyBinding[];
	onKeyDown: (evt: any) => void;
	onSubmit: () => void;
	scrollRef: (el: any) => void;
	inputRef: (el: any) => void;
	onContentChange: () => void;
}

export function ChatScreen(props: ChatScreenProps): JSX.Element {
	return (
		<box flexDirection="column" height="100%" paddingLeft={2} paddingRight={2}>
			<scrollbox ref={props.scrollRef} flexGrow={1} minHeight={0}>
				<box height={1} />
				<Show when={props.msgs().length === 0}>
					<text fg="#565f89">No messages yet.</text>
				</Show>
				{props.msgs().map((m) => (
					<MessageItem msg={m} />
				))}
				<box height={2} />
			</scrollbox>
			<Show when={props.err().length > 0}>
				<text fg="#f7768e">Error: {props.err()}</text>
			</Show>
			<Show when={props.streaming()}>
				<text fg="#565f89">thinking...</text>
			</Show>
			<box flexShrink={0}>
				<box border={["left"]} borderColor="#00AAFF" width="100%">
					<box paddingLeft={2} paddingRight={2} paddingTop={1} paddingBottom={1} backgroundColor="#22223a">
						<textarea
							focused
							placeholder="Message..."
							placeholderColor="#565f89"
							textColor="#c0caf5"
							focusedTextColor="#c0caf5"
							focusedBackgroundColor="#22223a"
							cursorColor="#c0caf5"
							minHeight={1}
							maxHeight={4}
							keyBindings={props.keyBindings}
							onContentChange={props.onContentChange}
							onKeyDown={props.onKeyDown}
							onSubmit={props.onSubmit}
							ref={props.inputRef}
						/>
					</box>
				</box>
			</box>
		</box>
	);
}
