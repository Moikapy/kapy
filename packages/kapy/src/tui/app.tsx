/**
 * Bare minimum TUI test — just renders text and exits.
 */

import { createCliRenderer, type CliRendererConfig } from "@opentui/core";
import { render } from "@opentui/solid";
import { createSignal } from "solid-js";

function BareApp() {
	const [count, setCount] = createSignal(0);

	// Auto-increment to verify reactivity
	const interval = setInterval(() => setCount(c => c + 1), 1000);
	// Auto-exit after 3 seconds
	setTimeout(() => {
		clearInterval(interval);
		process.exit(0);
	}, 3000);

	return (
		<box flexDirection="column" padding={1}>
			<text fg="#00AAFF" bold>KAPY</text>
			<text fg="#565f89">agent-first cli</text>
			<text>Counter: {count()}</text>
			<text fg="#565f89">Auto-exit in 3s...</text>
		</box>
	);
}

export async function launchChatTUI(): Promise<void> {
	if (!process.stdout.isTTY) {
		console.error("TUI requires an interactive terminal (TTY).");
		return;
	}

	const rendererConfig: CliRendererConfig = {
		externalOutputMode: "passthrough" as const,
		targetFps: 60,
		gatherStats: false,
		exitOnCtrlC: false,
		useKittyKeyboard: {},
		autoFocus: true,
		openConsoleOnError: false,
	};

	const renderer = await createCliRenderer(rendererConfig);
	await render(() => <BareApp />, renderer);
}