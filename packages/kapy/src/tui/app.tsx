/**
 * Kapy TUI App — OpenCode's exit pattern.
 *
 * Exit handling:
 * - ExitProvider registers SIGHUP (tmux pane close) → exit()
 * - Ctrl+C / Ctrl+D handled in Prompt component via onKeyDown
 * - exit() = renderer.destroy() + resolve launch promise
 * - NO process.exit() — let the event loop drain naturally
 */

import { render, useTerminalDimensions, useKeyboard } from "@opentui/solid";
import { createCliRenderer, type CliRendererConfig } from "@opentui/core";
import { Show, Switch, Match } from "solid-js";
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
		autoFocus: true,
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
			defaultModel: "ollama:glm-5.1:cloud",
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

		resolve();
	});
}

interface KapyAppProps {
	chatSession: ChatSession;
}

function KapyApp(props: KapyAppProps) {
	const route = useRoute();
	const dimensions = useTerminalDimensions();
	const { theme } = useTheme();
	const dialog = useDialog();
	const exit = useExit();

	// Global keyboard handlers
	// Ctrl+C: exit the app (must be global, not in textarea, because
	// TextareaRenderable may consume the key before onKeyDown fires)
	useKeyboard((evt) => {
		if (evt.ctrl && (evt.name === "c" || evt.name === "d")) {
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