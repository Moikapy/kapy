/**
 * Kapy TUI App — 1:1 with OpenCode's TUI architecture.
 *
 * Two routes: Home (logo + prompt) and Session (chat interface).
 * Uses Solid + @opentui/solid for rendering.
 * ChatSession wires the agent loop to the TUI.
 */

import { render, useKeyboard, useTerminalDimensions } from "@opentui/solid";
import { createCliRenderer, type CliRendererConfig } from "@opentui/core";
import { createSignal, Show, Switch, Match, onCleanup } from "solid-js";
import { RouteProvider, useRoute } from "./context/route.jsx";
import { ThemeProvider, useTheme } from "./context/theme.jsx";
import { DialogProvider, useDialog } from "./context/dialog.jsx";
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
 * Returns a promise that resolves when the TUI exits.
 */
export async function launchChatTUI(): Promise<void> {
	if (!process.stdout.isTTY) {
		console.error("TUI requires an interactive terminal (TTY).");
		return;
	}

	const renderer = await createCliRenderer(rendererConfig());

	// Create shared ChatSession
	const chatSession = new ChatSession({
		systemPrompt: `You are Kapy, an agent-first CLI assistant. You help users with coding, debugging, and system tasks. You have access to tools for reading files, running commands, and more. Be concise and direct.`,
	});

	// Initialize providers (auto-detect Ollama)
	await chatSession.init();

	await render(() => <KapyApp chatSession={chatSession} />, renderer);
}

interface KapyAppProps {
	chatSession: ChatSession;
}

function KapyApp(props: KapyAppProps) {
	const route = useRoute();
	const dimensions = useTerminalDimensions();
	const { theme } = useTheme();
	const dialog = useDialog();

	// Global keyboard handling
	useKeyboard((evt) => {
		if (evt.ctrl && evt.name === "c") {
			return;
		}

		if (evt.name === "escape") {
			if (dialog.open()) {
				dialog.closeDialog();
			} else if (route.data().type === "session") {
				route.navigate({ type: "home" });
			}
			return;
		}
	});

	return (
		<box
			width={dimensions().width}
			height={dimensions().height}
			backgroundColor={theme().background}
			flexDirection="column"
		>
			{/* Main content area */}
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

			{/* Footer status bar */}
			<Footer
				toolCount={props.chatSession.tools.all().length}
				providerStatus={props.chatSession.providers.all().length > 0 ? "connected" : "disconnected"}
				contextUsage={props.chatSession.getContextUsage().fraction}
			/>

			{/* Dialog overlays */}
			<Show when={dialog.open() === "help"}>
				<HelpDialog />
			</Show>
			<Show when={dialog.open() === "model"}>
				<ModelDialog />
			</Show>
		</box>
	);
}