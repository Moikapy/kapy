import { createCliRenderer } from "@opentui/core";
import { render, useKeyboard, useTerminalDimensions } from "@opentui/solid";
import { createEffect, createSignal, Show, useContext } from "solid-js";
import { Sidebar } from "./components/sidebar.js";
import { StatusFooter } from "./components/status-footer.js";
import { createChat } from "./hooks/use-chat.js";
import { useSlashCommands } from "./hooks/use-slash-commands.js";
import { RouteContext, RouteProvider } from "./router.js";
import { KEY_BINDINGS } from "./types.js";
import { ChatScreen } from "./views/chat-screen.js";
import { HomeScreen } from "./views/home-screen.js";

// Module-level renderer ref so useKeyboard can call destroy on exit
let _renderer: any = null;

function App() {
	const route = useContext(RouteContext)!;
	const dims = useTerminalDimensions();
	const chat = createChat();
	const handleSlash = useSlashCommands(chat);

	// Global key handler — Ctrl+C/D exits even when textarea is focused
	useKeyboard((evt: any) => {
		if (evt.ctrl && (evt.name === "c" || evt.name === "d")) {
			try {
				_renderer?.destroy();
			} catch {}
			setTimeout(() => process.exit(0), 50);
		}
	});

	// Auto-scroll to bottom on new messages
	let scrollRef: any;
	createEffect(() => {
		if (chat.msgs().length > 0) setTimeout(() => scrollRef?.scrollTo?.(99999), 50);
	});

	// Key handler for textareas
	const onKey = (evt: any) => {
		if (evt.ctrl && evt.name === "\\") chat.setSidebar((v) => !v);
		if (evt.name === "escape") {
			if (chat.streaming()) chat.abort();
			else if (route.data().type === "session") route.navigate({ type: "home" });
		}
	};

	// Input refs
	let homeRef: any;
	let sessRef: any;
	const [inputVal, setInputVal] = createSignal("");

	return (
		<box width={dims().width} height={dims().height} backgroundColor="#1a1b26" flexDirection="column">
			<box flexDirection="row" flexGrow={1} minHeight={0}>
				<box flexGrow={1} minWidth={0}>
					<Show when={route.data().type === "home"}>
						<HomeScreen
							keyBindings={KEY_BINDINGS}
							onSubmit={() => {
								const t = inputVal().trim();
								if (!t || chat.streaming()) return;
								setInputVal("");
								if (homeRef) homeRef.clear();
								chat.send(t, route.navigate);
							}}
							onKeyDown={onKey}
							onContentChange={() => {
								if (homeRef) setInputVal(homeRef.plainText);
							}}
							inputRef={(r2: any) => {
								homeRef = r2;
								setTimeout(() => r2?.focus(), 10);
							}}
						/>
					</Show>
					<Show when={route.data().type === "session"}>
						<ChatScreen
							msgs={chat.msgs}
							err={chat.err}
							streaming={chat.streaming}
							keyBindings={KEY_BINDINGS}
							onKeyDown={onKey}
							onSubmit={() => {
								setTimeout(
									() =>
										setTimeout(() => {
											const t = inputVal().trim();
											if (!t) return;
											if (t === "exit" || t === ":q") {
												try {
													_renderer?.destroy();
												} catch {}
												setTimeout(() => process.exit(0), 50);
												return;
											}
											if (t.startsWith("/") && handleSlash(t)) {
												setInputVal("");
												if (sessRef) sessRef.clear();
												return;
											}
											setInputVal("");
											if (sessRef) sessRef.clear();
											chat.send(t, route.navigate);
										}, 0),
									0,
								);
							}}
							scrollRef={(r: any) => {
								scrollRef = r;
							}}
							inputRef={(r: any) => {
								sessRef = r;
								setTimeout(() => r?.focus(), 10);
							}}
							onContentChange={() => {
								if (sessRef) setInputVal(sessRef.plainText);
							}}
						/>
					</Show>
				</box>
				<Show when={chat.sidebar()}>
					<Sidebar model={chat.model} msgCount={chat.msgs} models={chat.models} />
				</Show>
			</box>
			<StatusFooter model={chat.model} />
		</box>
	);
}

export async function launchChatTUI(): Promise<void> {
	if (!process.stdout.isTTY) {
		console.error("TUI requires an interactive terminal (TTY).");
		return;
	}
	const renderer = await createCliRenderer({
		externalOutputMode: "passthrough" as const,
		targetFps: 120,
		gatherStats: false,
		exitOnCtrlC: false,
		useKittyKeyboard: {},
		autoFocus: true,
		openConsoleOnError: false,
	});
	_renderer = renderer;
	const cleanup = () => {
		try {
			renderer.destroy();
		} catch {}
	};
	process.on("SIGHUP", () => {
		cleanup();
		setTimeout(() => process.exit(0), 50);
	});
	process.on("SIGINT", () => {
		cleanup();
		setTimeout(() => process.exit(0), 50);
	});
	process.on("SIGTERM", () => {
		cleanup();
		setTimeout(() => process.exit(0), 50);
	});
	await render(
		() => (
			<RouteProvider>
				<App />
			</RouteProvider>
		),
		renderer,
	);
}
