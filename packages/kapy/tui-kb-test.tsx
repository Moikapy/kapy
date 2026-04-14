#!/usr/bin/env bun
/**
 * Minimal smoke test — Verify useKeyboard fires at all.
 * Press any key to see it logged, Ctrl+C to exit.
 */

import { createCliRenderer } from "@opentui/core";
import { render, useKeyboard, useRenderer } from "@opentui/solid";
import { createSignal, onMount, Show } from "solid-js";
import { ExitProvider, useExit } from "./src/tui/context/exit.jsx";

let keyLog: string[] = [];

function TestApp() {
	const [lastKey, setLastKey] = createSignal("none yet");
	const [count, setCount] = createSignal(0);
	const exit = useExit();
	const renderer = useRenderer();

	// Global keyboard handler — this is what we're testing
	useKeyboard((evt) => {
		const desc = evt.ctrl ? `Ctrl+${evt.name}` : evt.shift ? `Shift+${evt.name}` : evt.name;
		keyLog.push(desc);
		setLastKey(desc);
		setCount((c) => c + 1);

		// Exit on Ctrl+C
		if (evt.ctrl && evt.name === "c") {
			exit("Ctrl+C");
		}
		// Exit on q
		if (evt.name === "q" && !evt.ctrl && !evt.shift) {
			exit("q");
		}
	});

	onMount(() => {
		// Auto-exit after 8 seconds
		setTimeout(() => exit("auto"), 8000);
	});

	return (
		<box flexDirection="column" padding={1}>
			<text fg="#00AAFF" bold>🐹 Kapy Keyboard Test</text>
			<text>Last key: {lastKey()}</text>
			<text>Count: {count()}</text>
			<text fg="#565f89">Press any key. Ctrl+C or q to exit.</text>
			<text fg="#565f89">Auto-exits in 8s.</text>
		</box>
	);
}

async function main() {
	const renderer = await createCliRenderer({
		externalOutputMode: "passthrough",
		targetFps: 60,
		exitOnCtrlC: false,
		useKittyKeyboard: {},
		autoFocus: true,
		openConsoleOnError: false,
	});

	await render(() => (
		<ExitProvider onExit={async () => { renderer.destroy(); }} onBeforeExit={async () => {}}>
			<TestApp />
		</ExitProvider>
	), renderer);
}

main().catch(err => { console.error("Error:", err); process.exit(1); });