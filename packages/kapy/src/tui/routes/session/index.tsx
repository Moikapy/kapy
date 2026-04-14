/**
 * Session route — Chat interface with messages + sidebar + prompt.
 * 1:1 with OpenCode's Session component.
 */

import {
	createEffect,
	createMemo,
	createSignal,
	For,
	Match,
	Show,
	Switch,
} from "solid-js";
import { useTheme } from "../../context/theme.jsx";
import { useRoute } from "../../context/route.js";
import { Prompt, type PromptRef } from "../../component/prompt.jsx";
import { Sidebar } from "./sidebar.jsx";
import type { RouteData } from "../../context/route.js";

/** Mock message type — will be replaced by SessionManager entries */
interface Message {
	id: string;
	role: "user" | "assistant" | "tool" | "system";
	content: string;
	timestamp: number;
}

export function Session() {
	const route = useRoute();
	const { theme } = useTheme();
	const [sidebarOpen, setSidebarOpen] = createSignal(false);
	const [messages, setMessages] = createSignal<Message[]>([]);
	let promptRef: PromptRef | undefined;

	// When navigating to session with initial prompt, add it as user message
	createEffect(() => {
		const data = route.data();
		if (data.type !== "session") return;
		const initial = (data as Extract<RouteData, { type: "session" }>).initialPrompt;
		if (initial?.input) {
			setMessages((prev) => [
				...prev,
				{
					id: `msg-${Date.now()}`,
					role: "user",
					content: initial.input,
					timestamp: Date.now(),
				},
			]);
		}
	});

	const sidebarVisible = createMemo(() => sidebarOpen());
	const contentWidth = createMemo(() => 80);

	const bind = (r: PromptRef | undefined) => {
		promptRef = r;
	};

	const onSubmit = () => {
		const input = promptRef?.current.input;
		if (!input?.trim()) return;
		setMessages((prev) => [
			...prev,
			{
				id: `msg-${Date.now()}`,
				role: "user",
				content: input,
				timestamp: Date.now(),
			},
		]);
		promptRef?.set({ input: "", parts: [] });

		// Simulate assistant response (replaced by KapyAgent in production)
		setTimeout(() => {
			setMessages((prev) => [
				...prev,
				{
					id: `msg-${Date.now() + 1}`,
					role: "assistant",
					content: `Processing: ${input}\n\nI'll help you with that. The kapy agent loop will be connected here.`,
					timestamp: Date.now(),
				},
			]);
		}, 500);
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
							</Switch>
						)}
					</For>
				</scrollbox>

				{/* Input prompt */}
				<box flexShrink={0}>
					<Prompt ref={bind} onSubmit={onSubmit} />
				</box>
			</box>

			{/* Sidebar */}
			<Show when={sidebarVisible()}>
				<Sidebar onClose={() => setSidebarOpen(false)} />
			</Show>
		</box>
	);
}

function UserMessage(props: { message: Message }) {
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

function AssistantMessage(props: { message: Message }) {
	const { theme } = useTheme();

	return (
		<box paddingLeft={3} marginTop={1} flexShrink={0}>
			<text fg={theme().text}>{props.message.content}</text>
		</box>
	);
}

function ToolMessage(props: { message: Message }) {
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