/**
 * Session route — Chat interface with messages + sidebar + prompt.
 * 1:1 with OpenCode's Session component.
 *
 * Now wired to ChatSession (AgentLoop + ProviderRegistry + ToolRegistry).
 */

import {
	createEffect,
	createMemo,
	createSignal,
	For,
	Match,
	onCleanup,
	Show,
	Switch,
} from "solid-js";
import { useTheme } from "../../context/theme.jsx";
import { useRoute } from "../../context/route.js";
import { Prompt, type PromptRef } from "../../component/prompt.jsx";
import { Sidebar } from "./sidebar.jsx";
import type { RouteData } from "../../context/route.js";
import type { ChatSession, ChatMessage } from "../../../ai/chat-session.js";
import type { AgentEvent } from "../../../ai/agent/types.js";

interface SessionProps {
	/** ChatSession instance (shared across the app) */
	chatSession?: ChatSession;
}

export function Session(props: SessionProps) {
	const route = useRoute();
	const { theme } = useTheme();
	const [sidebarOpen, setSidebarOpen] = createSignal(false);
	const [messages, setMessages] = createSignal<ChatMessage[]>([]);
	const [isProcessing, setIsProcessing] = createSignal(false);
	let promptRef: PromptRef | undefined;
	let chat: ChatSession | undefined = props.chatSession;

	// Subscribe to chat session events
	if (chat) {
		const unsub = chat.onEvent((_event) => {
			// Trigger reactive update by copying message list
			setMessages([...chat!.messages]);
			setIsProcessing(chat!.isProcessing);
		});
		onCleanup(() => unsub());
	}

	// When navigating to session with initial prompt, submit it
	createEffect(() => {
		const data = route.data();
		if (data.type !== "session") return;
		const initial = (data as Extract<RouteData, { type: "session" }>).initialPrompt;
		if (initial?.input && chat) {
			// Only submit once — clear the initialPrompt after use
			(async () => {
				await chat!.send(initial.input);
				setMessages([...chat!.messages]);
			})();
		}
	});

	// Periodically sync messages while processing
	if (chat) {
		const interval = setInterval(() => {
			if (chat) {
				setMessages([...chat.messages]);
				setIsProcessing(chat.isProcessing);
			}
		}, 100);
		onCleanup(() => clearInterval(interval));
	}

	const sidebarVisible = createMemo(() => sidebarOpen());

	const bind = (r: PromptRef | undefined) => {
		promptRef = r;
	};

	const onSubmit = async () => {
		const input = promptRef?.current.input;
		if (!input?.trim()) return;
		promptRef?.set({ input: "", parts: [] });

		if (chat) {
			await chat.send(input);
			setMessages([...chat.messages]);
			setIsProcessing(chat.isProcessing);
		}
	};

	return (
		<box flexDirection="row" height="100%">
			<box flexGrow={1} paddingBottom={1} paddingLeft={2} paddingRight={2} gap={1}>
				{/* Message list */}
				<scrollbox flexGrow={1}>
					<box height={1} />
					<For each={messages()}>
						{(message) => (
							<Switch>
								<Match when={message.role === "user"}>
									<UserMessage message={message} />
								</Match>
								<Match when={message.role === "assistant"}>
									<AssistantMessage message={message} />
								</Match>
								<Match when={message.role === "tool"}>
									<ToolMessage message={message} />
								</Match>
								<Match when={message.role === "system"}>
									<SystemMessage message={message} />
								</Match>
							</Switch>
						)}
					</For>

					{/* Processing indicator */}
					<Show when={isProcessing()}>
						<box paddingLeft={3} marginTop={1} flexShrink={0}>
							<text fg={theme().accent}>●</text>
							<text fg={theme().textMuted}> thinking...</text>
						</box>
					</Show>
				</scrollbox>

				{/* Input prompt */}
				<box flexShrink={0}>
					<Prompt
						ref={bind}
						onSubmit={onSubmit}
						disabled={isProcessing()}
					/>
				</box>
			</box>

			{/* Sidebar */}
			<Show when={sidebarVisible()}>
				<Sidebar onClose={() => setSidebarOpen(false)} />
			</Show>
		</box>
	);
}

function UserMessage(props: { message: ChatMessage }) {
	const { theme } = useTheme();

	return (
		<box
			border={["left"]}
			borderColor={theme().accent}
			marginTop={1}
			flexShrink={0}
		>
			<box
				paddingTop={1}
				paddingBottom={1}
				paddingLeft={2}
				backgroundColor={theme().backgroundPanel}
			>
				<text fg={theme().text}>{props.message.content}</text>
			</box>
		</box>
	);
}

function AssistantMessage(props: { message: ChatMessage }) {
	const { theme } = useTheme();

	return (
		<box paddingLeft={3} marginTop={1} flexShrink={0}>
			<text fg={theme().text}>
				{props.message.content}
				<Show when={props.message.isStreaming}>
					<span style={{ fg: theme().accent }}> ●</span>
				</Show>
			</text>
		</box>
	);
}

function ToolMessage(props: { message: ChatMessage }) {
	const { theme } = useTheme();

	return (
		<box paddingLeft={3} marginTop={1} flexShrink={0} flexDirection="column">
			<text fg={theme().textMuted}>
				<b>▸ tool</b>
			</text>
			<text fg={theme().textMuted}>{props.message.content}</text>
		</box>
	);
}

function SystemMessage(props: { message: ChatMessage }) {
	const { theme } = useTheme();

	return (
		<box paddingLeft={2} paddingRight={2} paddingTop={1} paddingBottom={1} marginTop={1} flexShrink={0}>
			<text fg={theme().textMuted}>{props.message.content}</text>
		</box>
	);
}