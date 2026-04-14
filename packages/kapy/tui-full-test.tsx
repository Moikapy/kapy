/** Test: RouteProvider + ExitProvider + SidebarProvider + ChatContext */
import { createCliRenderer, type KeyBinding } from "@opentui/core";
import { render, useRenderer,  } from "@opentui/solid";
import { createSignal, createContext, useContext, type ParentComponent, Show, For, createMemo } from "solid-js";

// Route
type RouteData = { type: "home" } | { type: "session"; sessionID: string };
const RouteContext = createContext<{ data: () => RouteData; navigate: (r: RouteData) => void }>();
const RouteProvider: ParentComponent = (props) => {
	const [data, setData] = createSignal<RouteData>({ type: "home" });
	return <RouteContext.Provider value={{ data, navigate: (r: RouteData) => setData(r) }}>{props.children}</RouteContext.Provider>;
};

// Exit
const ExitContext = createContext<{ exit: () => Promise<void> }>();
function useExit() { return useContext(ExitContext)!; }
const ExitProvider: ParentComponent<{ onExit: () => Promise<void> }> = (props) => {
	const renderer = useRenderer();
	let exitTask: Promise<void> | undefined;
	const doExit = async () => {
		if (exitTask) return;
		exitTask = (async () => { try { renderer.destroy(); } catch {} await props.onExit?.(); })();
	};
	process.on("SIGHUP", () => doExit());
	process.on("SIGINT", () => doExit());
	return <ExitContext.Provider value={{ exit: doExit }}>{props.children}</ExitContext.Provider>;
};

// Sidebar
const SidebarContext = createContext<{ open: () => boolean; toggle: () => void }>();
function useSidebar() { return useContext(SidebarContext)!; }
const SidebarProvider: ParentComponent = (props) => {
	const [open, setOpen] = createSignal(false);
	return <SidebarContext.Provider value={{ open: () => open(), toggle: () => setOpen(v => !v) }}>{props.children}</SidebarContext.Provider>;
};

// Chat
interface Msg { id: string; role: "user" | "assistant"; content: string; streaming?: boolean }
const ChatContext = createContext<{ messages: () => Msg[]; model: () => string; isStreaming: () => boolean }>();
function useChat() { return useContext(ChatContext)!; }

// Theme
const TC = { accent: "#00AAFF", bg: "#1a1b26", panel: "#1a1a2e", elem: "#22223a", text: "#c0caf5", muted: "#565f89", border: "#444466", err: "#f7768e", ok: "#9ece6a" };
const ThemeCtx = createContext<{ t: () => typeof TC }>();
const ThemeProv: ParentComponent = (props) => (<ThemeCtx.Provider value={{ t: () => TC }}>{props.children}</ThemeCtx.Provider>);

const KB: KeyBinding[] = [{ name: "return", action: "submit" }, { name: "return", shift: true, action: "newline" }];

function App() {
	const route = useContext(RouteContext)!;
	const { t } = useContext(ThemeCtx)!;
	const sidebar = useSidebar();
	const chat = useChat();
	const exit = useExit();

	((evt) => {
		if (evt.ctrl && (evt.name === "c" || evt.name === "d")) { exit().exit(); return; }
		if (evt.ctrl && evt.name === "\\") { sidebar.toggle(); }
	});

	return (
		<box flexGrow={1} backgroundColor={t().bg} flexDirection="column">
			<box flexDirection="row" flexGrow={1} minHeight={0}>
				<box flexGrow={1} minWidth={0}>
					<Show when={route.data().type === "home"}>
						<HomeScreen />
					</Show>
					<Show when={route.data().type === "session"}>
						<SessionScreen />
					</Show>
				</box>
				<Show when={sidebar.open()}>
					<Sidebar />
				</Show>
			</box>
			<Footer />
		</box>
	);
}

function HomeScreen() {
	const { t } = useContext(ThemeCtx)!;
	const chat = useChat();
	let ref: any;
	const [input, setInput] = createSignal("");

	return (
		<box flexDirection="column" alignItems="center" flexGrow={1} paddingLeft={2} paddingRight={2}>
			<box flexGrow={1} minHeight={0} />
			<text fg={t().accent} bold>KAPY</text>
			<text fg={t().muted}>agent-first cli</text>
			<box height={1} />
			<box width="100%" maxWidth={72}>
				<box border={["left"]} borderColor={t().accent}>
					<box paddingLeft={2} paddingRight={2} paddingTop={1} backgroundColor={t().elem}>
						<textarea
							focused
							placeholder='Ask anything...'
							placeholderColor={t().muted}
							textColor={t().text}
							focusedTextColor={t().text}
							focusedBackgroundColor={t().elem}
							cursorColor={t().text}
							minHeight={1}
							maxHeight={3}
							keyBindings={KB}
							onContentChange={() => { if (ref) setInput(ref.plainText); }}
							onSubmit={() => {
								const text = input().trim();
								if (!text) return;
								setInput(""); if (ref) ref.clear();
								const route = useContext(RouteContext)!;
								if (route.data().type === "home") route.navigate({ type: "session", sessionID: `s-${Date.now()}` });
							}}
							ref={(r: any) => { ref = r; setTimeout(() => r?.focus(), 10); }}
						/>
						<text fg={t().accent}>⟩ <text fg={t().text}>kapy · {chat.model()}</text></text>
					</box>
				</box>
			</box>
			<box height={2} />
			<text fg={t().muted}>enter send · shift+enter newline · ctrl+\ sidebar</text>
			<box flexGrow={1} minHeight={0} />
		</box>
	);
}

function SessionScreen() {
	const { t } = useContext(ThemeCtx)!;
	const chat = useChat();
	return (
		<box flexDirection="column" height="100%" paddingLeft={2} paddingRight={2}>
			<scrollbox flexGrow={1} minHeight={0}>
				<box height={1} />
				<For each={chat.messages()}>
					{(msg) => (
						<Show when={msg.role === "user"}>
							<box border={["left"]} borderColor={t().accent} marginTop={1} flexShrink={0}>
								<box paddingTop={1} paddingBottom={1} paddingLeft={2} backgroundColor={t().panel}>
									<text fg={t().text}>{msg.content}</text>
								</box>
							</box>
						</Show>
					)}
				</For>
				<For each={chat.messages()}>
					{(msg) => (
						<Show when={msg.role === "assistant"}>
							<box paddingLeft={3} marginTop={1} flexShrink={0}>
								<text fg={t().text}>
									{msg.content}
									<Show when={msg.streaming}><text fg={t().accent}> ●</text></Show>
								</text>
							</box>
						</Show>
					)}
				</For>
				<box height={2} />
			</scrollbox>
		</box>
	);
}

function Sidebar() {
	const { t } = useContext(ThemeCtx)!;
	const chat = useChat();
	return (
		<box backgroundColor={t().panel} width={36} height="100%" paddingTop={1} paddingLeft={2} paddingRight={2} flexShrink={0}>
			<scrollbox flexGrow={1}>
				<text fg={t().text}><b>Session</b></text>
				<text fg={t().muted}>Model: {chat.model()}</text>
			</scrollbox>
		</box>
	);
}

function Footer() {
	const { t } = useContext(ThemeCtx)!;
	const chat = useChat();
	return (
		<box flexDirection="row" justifyContent="space-between" paddingLeft={2} paddingRight={2} flexShrink={0}>
			<text fg={t().muted}>~/kapy</text>
			<text fg={t().muted}>⊙ ollama · <text fg={t().text}>{chat.model()}</text></text>
		</box>
	);
}

async function main() {
	await new Promise<void>(async (resolve) => {
		const renderer = await createCliRenderer({
			externalOutputMode: "passthrough",
			targetFps: 60,
			exitOnCtrlC: false,
			useKittyKeyboard: {},
			autoFocus: true,
			openConsoleOnError: false,
		});

		const [msgs, setMsgs] = createSignal<Msg[]>([]);
		const [model] = createSignal("glm-5.1:cloud");
		const [streaming] = createSignal(false);
		const chatVal = { messages: msgs, model, isStreaming: streaming };

		await render(() => (
			<ExitProvider onExit={async () => resolve()}>
				<ThemeProv>
					<RouteProvider>
						<SidebarProvider>
							<ChatContext.Provider value={chatVal}>
								<App />
							</ChatContext.Provider>
						</SidebarProvider>
					</RouteProvider>
				</ThemeProv>
			</ExitProvider>
		), renderer);
		setTimeout(() => resolve(), 4000);
	});
}
main().catch(e => { console.error(e); process.exit(1); });