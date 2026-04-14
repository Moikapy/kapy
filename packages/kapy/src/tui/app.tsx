/**
 * Kapy TUI App — 1:1 with OpenCode's TUI architecture.
 *
 * Two routes: Home (logo + prompt) and Session (chat interface).
 * Uses Solid + @opentui/solid for rendering.
 * Kapy branding: 🐹 hamster blue accent on dark background.
 *
 * Layers (matching OpenCode):
 * - RouteProvider: home ↔ session navigation
 * - ThemeProvider: dark/light color palette
 * - DialogProvider: modal overlays (model, help, agent selector)
 * - Footer: cwd, permissions, tool count
 */

import { render, useKeyboard, useTerminalDimensions } from "@opentui/solid";
import { createCliRenderer, type CliRendererConfig } from "@opentui/core";
import { Switch, Match, Show } from "solid-js";
import { RouteProvider, useRoute } from "./context/route.jsx";
import { ThemeProvider, useTheme } from "./context/theme.jsx";
import { DialogProvider, useDialog } from "./context/dialog.jsx";
import { Home } from "./routes/home.jsx";
import { Session } from "./routes/session/index.jsx";
import { Footer } from "./component/footer.jsx";
import { HelpDialog } from "./component/help-dialog.jsx";
import { ModelDialog } from "./component/model-dialog.jsx";

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

	await render(() => <KapyApp />, renderer);
}

function KapyApp() {
	const route = useRoute();
	const dimensions = useTerminalDimensions();
	const { theme } = useTheme();
	const dialog = useDialog();

	// Global keyboard handling
	useKeyboard((evt) => {
		// Ctrl+C exits
		if (evt.ctrl && evt.name === "c") {
			return;
		}

		// Escape: close dialog or go home
		if (evt.name === "escape") {
			if (dialog.open()) {
				dialog.closeDialog();
			} else if (route.data().type === "session") {
				route.navigate({ type: "home" });
			}
			return;
		}

		// Slash commands (forwarded from prompt)
		if (evt.name === "/") {
			// Will be handled by prompt component in the future
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
						<Session />
					</Match>
				</Switch>
			</box>

			{/* Footer status bar */}
			<Footer />

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