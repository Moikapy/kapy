import { createCliRenderer } from "@opentui/core";
import { render, useKeyboard, useTerminalDimensions } from "@opentui/solid";
import { createEffect, Show, useContext } from "solid-js";
import { Modal, type ModalView } from "./components/modal.js";
import { StatusFooter } from "./components/status-footer.js";
import { createChat } from "./hooks/use-chat.js";
import { useModal } from "./hooks/use-modal.js";
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
	const modal = useModal();

	const handleSlash = useSlashCommands({
		setMsgs: chat.setMsgs,
		setModel: chat.setModel,
		fetchModels: chat.fetchModels,
		model: chat.model,
		models: chat.models,
		openModal: (view: ModalView) => modal.open(view),
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

	const onKey = (evt: any) => {
		if (evt.name === "escape") {
			if (modal.isOpen()) {
				modal.close();
				return;
			}
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

	// When modal is open, render modal overlay on top of content
	// (both in the same flex column — modal gets flexGrow to fill space)
	const modalOpen = modal.isOpen();

	return (
		<box width={dims().width} height={dims().height} backgroundColor="#1a1b26" flexDirection="column">
			<box flexDirection="row" flexGrow={1} minHeight={0}>
				<box flexGrow={1} minWidth={0}>
					{/* Content sits behind modal when open */}
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
			<StatusFooter model={chat.model} />
			{/* Modal overlay renders on top when active */}
			{modalOpen && <Modal view={modal.view()!} onClose={() => modal.close()} />}
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
