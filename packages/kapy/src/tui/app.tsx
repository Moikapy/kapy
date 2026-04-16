import { createCliRenderer } from "@opentui/core";
import { render, useKeyboard, useTerminalDimensions, useSelectionHandler, useRenderer } from "@opentui/solid";
import { createEffect, Show, useContext } from "solid-js";
import { DialogProvider, useDialog } from "./components/dialog-provider.js";
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
	const dialog = useDialog();
	const renderer = useRenderer();

	// Enable copy-on-selection — mouse drag to select, auto-copies via OSC 52
	useSelectionHandler((selection) => {
		const text = selection.getSelectedText();
		if (text) renderer.copyToClipboardOSC52(text);
	});

	/** Open a modal view inside the dialog system. */
	function openModal(view: ModalView) {
		dialog.replace(() => <ModalContent view={view} onClose={() => dialog.pop()} />);
	}

	const handleSlash = useSlashCommands({
		setMsgs: chat.setMsgs,
		setModel: chat.setModel,
		setThinkingLevel: chat.setThinkingLevel,
		fetchModels: chat.fetchModels,
		model: chat.model,
		models: chat.models,
		openModal,
		loadSession: chat.loadSession,
		listSessions: chat.listSessions,
		listAllSessions: chat.listAllSessions,
	});

	useKeyboard((evt: any) => {
		if (evt.ctrl && (evt.name === "c" || evt.name === "d")) {
			try {
				_renderer?.destroy();
			} catch {}
			setTimeout(() => process.exit(0), 50);
		}
	});

	let scrollRef: any;
	createEffect(() => {
		if (chat.msgs().length > 0) setTimeout(() => scrollRef?.scrollTo?.(99999), 50);
	});

	/** Global key handler for non-dialog keys.
	 *  Escape is handled by DialogProvider when a dialog is open.
	 *  When no dialog is open, Escape aborts streaming or navigates home.
	 */
	const onKey = (evt: any) => {
		if (evt.name === "escape") {
			// Dialog is open — DialogProvider handles Escape, so this won't fire
			// (DialogProvider's useKeyboard runs first due to provider ordering)
			// No dialog open:
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
		try {
			_renderer?.destroy();
		} catch {}
		setTimeout(() => process.exit(0), 50);
	};
	let _homeRef: any;
	let _sessRef: any;

	return (
		<box width={dims().width} height={dims().height} backgroundColor="#1a1b26" flexDirection="column" position="relative">
			<box flexDirection="row" flexGrow={1} minHeight={0}>
				<box flexGrow={1} minWidth={0}>
					<Show when={route.data().type === "home"}>
						<HomeScreen
							keyBindings={KEY_BINDINGS}
							onSubmit={onSubmit}
							onSlashCommand={onSlashCommand}
							onExit={onExit}
							onKeyDown={onKey}
							inputRef={(r: any) => {
								_homeRef = r;
							}}
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
							scrollRef={(r: any) => {
								scrollRef = r;
							}}
							inputRef={(r: any) => {
								_sessRef = r;
							}}
						/>
					</Show>
				</box>
			</box>
			<StatusFooter model={chat.model} thinkingLevel={chat.thinkingLevel} />
		</box>
	);
}

export async function launchChatTUI(): Promise<void> {
	if (!process.stdout.isTTY) {
		console.error("TUI requires an interactive terminal (TTY).");
		return;
	}
	// Initialize debug log
	try { require("fs").writeFileSync("/tmp/kapy-debug.log", `=== Kapy TUI started ${new Date().toISOString()} ===\n`); } catch {}
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
				<DialogProvider>
					<App />
				</DialogProvider>
			</RouteProvider>
		),
		renderer,
	);
}