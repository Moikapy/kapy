import { createCliRenderer } from "@opentui/core";
import { render, useTerminalDimensions, useKeyboard } from "@opentui/solid";
import { createSignal, createEffect, Show, useContext } from "solid-js";
import { RouteContext, RouteProvider } from "./router.js";
import { KEY_BINDINGS } from "./types.js";
import { StatusFooter } from "./components/status-footer.js";
import { Sidebar } from "./components/sidebar.js";
import { MessageItem } from "./components/message-item.js";
import { HomeScreen } from "./components/home-screen.js";
import { createChat } from "./use-chat.js";

// Module-level renderer ref so useKeyboard can call destroy on exit
let _renderer: any = null;

function App() {
	const route = useContext(RouteContext)!;
	const dims = useTerminalDimensions();
	const chat = createChat();

	// Global key handler — Ctrl+C/D exits even when textarea is focused
	useKeyboard((evt: any) => {
		if (evt.ctrl && (evt.name === "c" || evt.name === "d")) {
			try { _renderer?.destroy(); } catch { }
			setTimeout(() => process.exit(0), 50);
		}
	});

	// Auto-scroll to bottom on new messages
	let scrollRef: any;
	createEffect(() => { if (chat.msgs().length > 0) setTimeout(() => scrollRef?.scrollTo?.(99999), 50); });

	// Slash command handler (TUI-local: sidebar, clear — model switches go to ChatSession)
	const handleSlash = (t: string): boolean => {
		const c = t.trim().toLowerCase();
		if (c === "/sidebar" || c === "/sb") { chat.setSidebar(v => !v); return true; }
		if (c === "/clear") { chat.setMsgs([]); return true; }
		if (c === "/models") { chat.fetchModels(); return true; }
		if (c === "/help") {
			chat.setMsgs(prev => [...prev, {
				id: `h-${Date.now()}`, role: "system" as const,
				content: "Commands:\n  /help     Show this help\n  /model X   Switch to model X\n  /models    List available models\n  /tools     List registered tools\n  /sidebar   Toggle sidebar\n  /clear     Clear chat\n  exit       Quit kapy",
			}]);
			return true;
		}
		if (c === "/tools") {
			chat.setMsgs(prev => [...prev, {
				id: `t-${Date.now()}`, role: "system" as const,
				content: "Available tools: read_file, write_file, bash, glob, grep",
			}]);
			return true;
		}
		const modelMatch = t.trim().match(/^\/model\s+(.+)$/i);
		if (modelMatch) { chat.setModel(modelMatch[1].trim()); return true; }
		return false;
	};

	// Key handler for textareas
	const onKey = (evt: any) => {
		if (evt.ctrl && evt.name === "\\") chat.setSidebar(v => !v);
		if (evt.name === "escape") { if (chat.streaming()) chat.abort(); else if (route.data().type === "session") route.navigate({ type: "home" }); }
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
						<HomeScreen keyBindings={KEY_BINDINGS}
							onSubmit={() => { const t = inputVal().trim(); if (!t || chat.streaming()) return; setInputVal(""); if (homeRef) homeRef.clear(); chat.send(t, route.navigate); }}
							onKeyDown={onKey}
							onContentChange={() => { if (homeRef) setInputVal(homeRef.plainText); }}
							inputRef={(r2: any) => { homeRef = r2; setTimeout(() => r2?.focus(), 10); }}
						/>
					</Show>
					<Show when={route.data().type === "session"}>
						<box flexDirection="column" height="100%" paddingLeft={2} paddingRight={2}>
							<scrollbox ref={(r: any) => { scrollRef = r; }} flexGrow={1} minHeight={0}>
								<box height={1} />
								<Show when={chat.msgs().length === 0}><text fg="#565f89">No messages yet.</text></Show>
								{chat.msgs().map(m => <MessageItem msg={m} />)}
								<box height={2} />
							</scrollbox>
							<Show when={chat.err().length > 0}><text fg="#f7768e">Error: {chat.err()}</text></Show>
							<Show when={chat.streaming()}><text fg="#565f89">thinking...</text></Show>
							<box flexShrink={0}>
								<box border={["left"]} borderColor="#00AAFF" width="100%">
									<box paddingLeft={2} paddingRight={2} paddingTop={1} backgroundColor="#22223a">
										<textarea focused placeholder="Message..." placeholderColor="#565f89" textColor="#c0caf5"
											focusedTextColor="#c0caf5" focusedBackgroundColor="#22223a" cursorColor="#c0caf5"
											minHeight={1} maxHeight={4} keyBindings={KEY_BINDINGS}
											onContentChange={() => { if (sessRef) setInputVal(sessRef.plainText); }}
											onKeyDown={onKey}
											onSubmit={() => {
												setTimeout(() => setTimeout(() => {
													const t = inputVal().trim(); if (!t) return;
													if (t === "exit" || t === ":q") { try { _renderer?.destroy(); } catch { } setTimeout(() => process.exit(0), 50); return; }
													if (t.startsWith("/") && handleSlash(t)) { setInputVal(""); if (sessRef) sessRef.clear(); return; }
													setInputVal(""); if (sessRef) sessRef.clear(); chat.send(t, route.navigate);
												}, 0), 0);
											}}
											ref={(r2: any) => { sessRef = r2; setTimeout(() => r2?.focus(), 10); }}
										/>
									</box>
								</box>
							</box>
						</box>
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
	const cleanup = () => { try { renderer.destroy(); } catch { } };
	process.on("SIGHUP", () => { cleanup(); setTimeout(() => process.exit(0), 50); });
	process.on("SIGINT", () => { cleanup(); setTimeout(() => process.exit(0), 50); });
	process.on("SIGTERM", () => { cleanup(); setTimeout(() => process.exit(0), 50); });
	await render(() => <RouteProvider><App /></RouteProvider>, renderer);
}