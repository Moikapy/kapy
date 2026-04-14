/**
 * Kapy TUI App — 1:1 with OpenCode's TUI architecture.
 *
 * CRITICAL: Renderer cleanup is mandatory. createCliRenderer puts the terminal
 * into alternate screen buffer + raw mode. If we crash without calling
 * renderer.destroy(), the terminal is left in a broken state (borked tmux).
 */

import { render, useKeyboard, useTerminalDimensions } from "@opentui/solid";
import { createCliRenderer, type CliRenderer, type CliRendererConfig } from "@opentui/core";
import { Show, Switch, Match } from "solid-js";
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

	let renderer: CliRenderer | undefined;

	try {
		renderer = await createCliRenderer(rendererConfig());

		const chatSession = new ChatSession({
			systemPrompt: `You are Kapy, an agent-first CLI assistant. You help users with coding, debugging, and system tasks. You have access to tools for reading files, running commands, and more. Be concise and direct.`,
		});

		await chatSession.init();

		// Signal handlers — MUST clean up terminal before exit
		const onSigInt = () => { cleanup(); process.exit(0); };
		const onSigTerm = () => { cleanup(); process.exit(0); };
		const onUncaught = (err: Error) => { cleanup(); console.error("Kapy TUI error:", err.message); process.exit(1); };
		process.on("SIGINT", onSigInt);
		process.on("SIGTERM", onSigTerm);
		process.on("uncaughtException", onUncaught);

		await render(() => (
			<ThemeProvider>
				<RouteProvider>
					<DialogProvider>
						<KapyApp chatSession={chatSession} />
					</DialogProvider>
				</RouteProvider>
			</ThemeProvider>
		), renderer);

		cleanup();

		function cleanup() {
			if (renderer) {
				try { renderer.destroy(); } catch { /* already destroyed */ }
				renderer = undefined;
			}
			process.removeListener("SIGINT", onSigInt);
			process.removeListener("SIGTERM", onSigTerm);
			process.removeListener("uncaughtException", onUncaught);
		}
	} catch (err) {
		if (renderer) {
			try { renderer.destroy(); } catch { /* give up */ }
		}
		throw err;
	}
}

interface KapyAppProps {
	chatSession: ChatSession;
}

function KapyApp(props: KapyAppProps) {
	const route = useRoute();
	const dimensions = useTerminalDimensions();
	const { theme } = useTheme();
	const dialog = useDialog();

	useKeyboard((evt) => {
		if (evt.ctrl && evt.name === "c") {
			return; // Let SIGINT handler do cleanup
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