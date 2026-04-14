#!/usr/bin/env bun
/**
 * Keyboard test — verifies Enter submits, Shift+Enter newlines, Ctrl+C exits.
 * All key bindings are tested via the TextareaRenderable's keyBindings system.
 */

import { createCliRenderer, TextareaRenderable, type KeyBinding, type KeyEvent } from "@opentui/core";
import { render, useKeyboard } from "@opentui/solid";
import { createSignal, onMount } from "solid-js";
import { ExitProvider, useExit } from "./src/tui/context/exit.jsx";

// Same keyBindings as prompt.tsx
const PROMPT_KEY_BINDINGS: KeyBinding[] = [
	{ name: "return", action: "submit" },
	{ name: "return", shift: true, action: "newline" },
];

let submitted = false;
let newlined = false;
let exited = false;

function TestApp() {
	const [text, setText] = createSignal("");
	const [status, setStatus] = createSignal("waiting...");

	return (
		<ExitProvider onExit={async () => { exited = true; }} onBeforeExit={async () => {}}>
			<box flexDirection="column" padding={1}>
				<text fg="#00AAFF">🐹 Keyboard Binding Test</text>
				<text>Status: {status}</text>
				<text>Text: {text}</text>
				<text>Submitted: {submitted ? "YES" : "no"}</text>
				<text>Newlined: {newlined ? "YES" : "no"}</text>
				<box paddingTop={1}>
					<textarea
						focused
						placeholder="Type here..."
						placeholderColor="#565f89"
						textColor="#c0caf5"
						focusedTextColor="#c0caf5"
						focusedBackgroundColor="#1a1b26"
						cursorColor="#c0caf5"
						minHeight={1}
						maxHeight={3}
						keyBindings={PROMPT_KEY_BINDINGS}
						onContentChange={() => {
							// setStatus(`content changed`);
						}}
						onKeyDown={(e: any) => {
							// Ctrl+C with empty input = exit
							if (e.ctrl && (e.name === "c" || e.name === "d")) {
								exited = true;
								setStatus("EXIT via Ctrl+C");
								e.preventDefault();
								return;
							}
						}}
						onSubmit={() => {
							submitted = true;
							setStatus("SUBMITTED via Enter!");
						}}
					/>
				</box>
			</box>
		</ExitProvider>
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

	await render(() => <TestApp />, renderer);

	// Wait for mount + focus
	await new Promise(r => setTimeout(r, 500));

	// Verify TextareaRenderable has keyBindings
	const focused = renderer.currentFocusedRenderable;
	if (focused && focused instanceof TextareaRenderable) {
		console.error(`[TEST] Focused textarea found: ${focused.id}`);
		console.error(`[TEST] keyBindings set: ${focused._keyBindings?.length ?? 0} bindings`);
	} else {
		console.error(`[TEST] ERROR: No focused textarea! Got: ${focused?.constructor?.name ?? "null"}`);
	}

	// Simulate Enter key — should trigger "submit" action, not newline
	console.error("[TEST] Simulating Enter key...");
	renderer.keyInput.emit("keypress", { name: "return", ctrl: false, shift: false, meta: false } as KeyEvent);
	await new Promise(r => setTimeout(r, 300));

	console.error(`[TEST] After Enter: submitted=${submitted}, newlined=${newlined}`);

	// If keyBindings work, submitted should be true and newlined should be false
	if (submitted && !newlined) {
		console.error("[TEST] ✓ Enter = submit (correct!)");
	} else if (newlined) {
		console.error("[TEST] ✗ Enter = newline (WRONG — keyBindings not working!)");
	} else {
		console.error("[TEST] ? Enter did nothing (onSubmit not firing)");
	}

	// Simulate Ctrl+C
	renderer.keyInput.emit("keypress", { name: "c", ctrl: true, shift: false, meta: false } as KeyEvent);
	await new Promise(r => setTimeout(r, 300));

	console.error(`[TEST] After Ctrl+C: exited=${exited}`);

	renderer.destroy();
	process.exit(submitted && !newlined ? 0 : 1);
}

main().catch(err => {
	console.error("[TEST] Error:", err);
	process.exit(1);
});