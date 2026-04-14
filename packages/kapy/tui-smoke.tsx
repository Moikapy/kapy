#!/usr/bin/env bun
/** Quick smoke test — launches TUI for 3 seconds then exits */

import { createCliRenderer } from "@opentui/core";
import { render } from "@opentui/solid";
import { createSignal, onMount } from "solid-js";

function TestApp() {
	const [count, setCount] = createSignal(0);
	onMount(() => {
		const i = setInterval(() => setCount((c) => c + 1), 500);
		setTimeout(() => {
			clearInterval(i);
			process.exit(0);
		}, 3000);
	});
	return (
		<box flexDirection="column" padding={1}>
			<text fg="#00AAFF">🐹 Kapy TUI Smoke Test</text>
			<text>Counter: {count()}</text>
			<text fg="#565f89">Auto-exiting in 3s...</text>
		</box>
	);
}

async function main() {
	const renderer = await createCliRenderer({ exitOnCtrlC: false });
	await render(() => <TestApp />, renderer);
}

main();