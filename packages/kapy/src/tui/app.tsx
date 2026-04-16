import { createCliRenderer, RGBA, type Renderable } from "@opentui/core";
import { render, useKeyboard, useTerminalDimensions, useSelectionHandler, useRenderer } from "@opentui/solid";
import { createEffect, createSignal, Show, useContext } from "solid-js";
import { ModalContent, type ModalView } from "./components/modal.js";
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
	const renderer = useRenderer();

	// Modal state — simple signal, no provider needed
	const [modalView, setModalView] = createSignal<ModalView | null>(null);

	// Enable copy-on-selection
	useSelectionHandler((selection) => {
		const text = selection.getSelectedText();
		if (text) renderer.copyToClipboardOSC52(text);
	});

	/** Open a modal view. */
	function openModal(view: ModalView) {
		setModalView(view);
	}

	const handleSlash = useSlashCommands({
		setMsgs: chat.setMsgs,
		setModel: chat.setModel,
		setThinkingLevel: chat.setThinkingLevel,
		fetchModels: chat.fetchModels,
		model: chat.model,
		models: chat.models,
		openModal,
		loadSession: (path: string) => chat.loadSession(path, route.navigate),
		listSessions: chat.listSessions,
		listAllSessions: chat.listAllSessions,
	});

	useKeyboard((evt: any) => {
		// Escape closes modal if open
		if (evt.name === "escape" && modalView() !== null) {
			setModalView(null);
			evt.preventDefault();
			evt.stopPropagation();
			return;
		}

		if (evt.ctrl && (evt.name === "c" || evt.name === "d")) {
			try { _renderer?.destroy(); } catch {}
			setTimeout(() => process.exit(0), 50);
		}
	});

	let scrollRef: any;
	createEffect(() => {
		if (chat.msgs().length > 0) setTimeout(() => scrollRef?.scrollTo?.(99999), 50);
	});

	const onKey = (evt: any) => {
		if (evt.name === "escape") {
			if (chat.streaming()) {
				chat.abort();
				return;
			}
			if (route.data().type === "session") route.navigate({ type: "home" });
			return;
		}
	};

	const onSubmit = (text: string) => chat.send(text, route.navigate);
	const onSlashCommand = (text: string) => handleSlash(text);
	const onExit = () => {
		try { _renderer?.destroy(); } catch {}
		setTimeout(() => process.exit(0), 50);
	};
	let _homeRef: any;
	let _sessRef: any;

	/** Track text selection for click-to-dismiss */
	let dismissOnMouseUp = false;

	return (
		<box width={dims().width} height={dims().height} backgroundColor="#1a1b26" flexDirection="column">
			<box flexDirection="row" flexGrow={1} minHeight={0}>
				<box flexGrow={1} minWidth={0}>
					<Show when={route.data().type === "home"}>
						<HomeScreen
							keyBindings={KEY_BINDINGS}
							onSubmit={onSubmit}
							onSlashCommand={onSlashCommand}
							onExit={onExit}
							onKeyDown={onKey}
							inputRef={(r: any) => { _homeRef = r; }}
						/>
					</Show>
					<Show when={route.data().type === "session"}>
						<ChatScreen
							msgs={chat.msgs}
							err={chat.err}
							streaming={chat.streaming}
							queuedCount={() => chat.queuedCount}
							keyBindings={KEY_BINDINGS}
							onSubmit={onSubmit}
							onSlashCommand={onSlashCommand}
							onExit={onExit}
							onKeyDown={onKey}
							scrollRef={(r: any) => { scrollRef = r; }}
							inputRef={(r: any) => { _sessRef = r; }}
						/>
					</Show>
				</box>
			</box>
			<StatusFooter model={chat.model} thinkingLevel={chat.thinkingLevel} />

			{/* Dialog overlay — renders on top of everything when modal is active */}
			<Show when={modalView() !== null}>
				<box
					width={dims().width}
					height={dims().height}
					alignItems="center"
					justifyContent="center"
					position="absolute"
					left={0}
					top={0}
					backgroundColor={RGBA.fromInts(0, 0, 0, 150)}
					onMouseDown={() => {
						dismissOnMouseUp = !!renderer.getSelection();
					}}
					onMouseUp={() => {
						if (dismissOnMouseUp) {
							dismissOnMouseUp = false;
							return;
						}
						setModalView(null);
					}}
				>
					<box
						width={modalView()?.type === "sessions" ? 80 : modalView()?.type === "models" ? 60 : 50}
						maxWidth={dims().width - 4}
						border={["top", "right", "bottom", "left"]}
						borderColor="#00AAFF"
						backgroundColor="#1a1b26"
						paddingTop={1}
						paddingBottom={1}
						paddingLeft={2}
						paddingRight={2}
						onMouseUp={(e: any) => {
							dismissOnMouseUp = false;
							e.stopPropagation();
						}}
					>
						<ModalContent view={modalView()!} onClose={() => setModalView(null)} />
					</box>
				</box>
			</Show>
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
		try { renderer.destroy(); } catch {}
	};
	process.on("SIGHUP", () => { cleanup(); setTimeout(() => process.exit(0), 50); });
	process.on("SIGINT", () => { cleanup(); setTimeout(() => process.exit(0), 50); });
	process.on("SIGTERM", () => { cleanup(); setTimeout(() => process.exit(0), 50); });

	await render(
		() => (
			<RouteProvider>
				<App />
			</RouteProvider>
		),
		renderer,
	);
}