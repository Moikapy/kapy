/**
 * Kapy TUI App — OpenCode's exit pattern.
 *
 * Exit handling:
 * - ExitProvider (from context/exit.jsx) provides exit() as Solid context
 * - SIGHUP (tmux pane close) + SIGINT (Ctrl+C) call exit()
 * - exit() calls renderer.destroy() + resolves the launch promise
 * - NO process.exit() — let the event loop drain naturally
 *
 * Prompt uses a real TextareaRenderable for keyboard input.
 */

import { render, useTerminalDimensions, useKeyboard } from "@opentui/solid";
import { createCliRenderer, type CliRendererConfig } from "@opentui/core";
import { createSignal, Show, Switch, Match, onMount, onCleanup } from "solid-js";
import { RouteProvider, useRoute } from "./context/route.jsx";
import { ThemeProvider, useTheme } from "./context/theme.jsx";
import { DialogProvider, useDialog } from "./context/dialog.jsx";
import { ExitProvider, useExit } from "./context/exit.jsx";
import { Home } from "./routes/home.jsx";
import { Session } from "./routes/session/index.jsx";
import { Footer } from "./component/footer.jsx";
import { HelpDialog } from "./component/help-dialog.jsx";
import { ModelDialog } from "./component/model-dialog.jsx";
import { ChatSession } from "../ai/chat-session.js";

function rendererConfig(): CliRendererConfig {
	return {
		externalOutputMode: "passthrough",
		targetFps: 60,
		gatherStats: false,
		exitOnCtrlC: false,
		useKittyKeyboard: {},
		autoFocus: false,
		openConsoleOnError: false,
	};
}

/**
 * Launch the Kapy TUI.
 * Returns a promise that resolves when the TUI exits cleanly.
 */
export async function launchChatTUI(): Promise<void> {
	if (!process.stdout.isTTY) {
		console.error("TUI requires an interactive terminal (TTY).");
		return;
	}

	// TUI lifecycle wrapped in a promise.
	// exit() resolves it, letting the process drain naturally.
	await new Promise<void>(async (resolve) => {
		let renderer;

		try {
			renderer = await createCliRenderer(rendererConfig());
		} catch (err) {
			console.error("Failed to create renderer:", err instanceof Error ? err.message : err);
			resolve();
			return;
		}

		const chatSession = new ChatSession({
			systemPrompt: `You are Kapy, an agent-first CLI assistant. Help with coding, debugging, and system tasks. Be concise.`,
		});

		await chatSession.init();

		const onBeforeExit = async () => {
			chatSession.abort();
		};

		const onExit = async () => {
			resolve();
		};

		await render(() => (
			<ThemeProvider>
				<RouteProvider>
					<DialogProvider>
						<ExitProvider onBeforeExit={onBeforeExit} onExit={onExit}>
							<KapyApp chatSession={chatSession} />
						</ExitProvider>
					</DialogProvider>
				</RouteProvider>
			</ThemeProvider>
		), renderer);

		// If render() returns (component unmounted), resolve
		resolve();
	});
}

// ─── App Component ──────────────────────────────────────

interface KapyAppProps {
	chatSession: ChatSession;
}

function KapyApp(props: KapyAppProps) {
	const route = useRoute();
	const dimensions = useTerminalDimensions();
	const { theme } = useTheme();
	const dialog = useDialog();
	const exit = useExit();

	// SIGHUP (tmux pane close) + SIGINT (Ctrl+C) → clean exit
	onMount(() => {
		const onSighup = () => exit("SIGHUP");
		const onSigint = () => exit("Ctrl+C");
		process.on("SIGHUP", onSighup);
		process.on("SIGINT", onSigint);
		onCleanup(() => {
			process.removeListener("SIGHUP", onSighup);
			process.removeListener("SIGINT", onSigint);
		});
	});

	// Global keyboard
	useKeyboard((evt) => {
		if (evt.ctrl && evt.name === "c") {
			exit("Ctrl+C");
			return;
		}
		if (evt.name === "escape") {
			if (dialog.open()) {
				dialog.closeDialog();
			} else if (route.data().type === "session") {
				route.navigate({ type: "home" });
			}
		}
	});

	return (
		<box
			width={dimensions().width}
			height={dimensions().height}
			backgroundColor={theme().background}
			flexDirection="column"
		>
			<box flexGrow={1}>
				<Switch>
					<Match when={route.data().type === "home"}>
						<Home />
					</Match>
					<Match when={route.data().type === "session"}>
						<Session chatSession={props.chatSession} />
					</Match>
				</Switch>
			</box>

			<Footer
				toolCount={props.chatSession.tools.all().length}
				providerStatus={props.chatSession.providers.all().length > 0 ? "connected" : "disconnected"}
				contextUsage={props.chatSession.getContextUsage().fraction}
			/>

			<Show when={dialog.open() === "help"}>
				<HelpDialog />
			</Show>
			<Show when={dialog.open() === "model"}>
				<ModelDialog />
			</Show>
		</box>
	);
}