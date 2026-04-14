#!/usr/bin/env bun
/**
 * Minimal keyboard focus test — does the textarea receive keystrokes?
 * Simulates key events directly through the renderer.
 */

import { createCliRenderer, type CliRenderer, TextareaRenderable, type KeyEvent } from "@opentui/core";
import { render } from "@opentui/solid";
import { createSignal, onMount, onCleanup } from "solid-js";

let keyLog: string[] = [];
let contentLog: string[] = [];

function TestApp() {
	const [chars, setChars] = createSignal(0);
	const [text, setText] = createSignal("");
	const [focused, setFocused] = createSignal(false);
	let textareaEl: any;
	let textareaFocused = false;

	onMount(() => {
		// Try to focus the textarea after mount
		setTimeout(() => {
			if (textareaEl) {
				console.error("[TEST] textarea found, focusing...");
				textareaEl.focus();
				setFocused(textareaEl.focused);
			} else {
				console.error("[TEST] textarea ref is null!");
			}
		}, 100);
	});

	return (
		<box flexDirection="column" padding={1}>
			<text fg="#00AAFF">⌨ Keyboard Focus Test</text>
			<text>Chars: {chars}</text>
			<text>Text: {text()}</text>
			<text>Focused: {focused() ? "YES" : "NO"}</text>
			<box paddingTop={1}>
				<textarea
					ref={(r: any) => { textareaEl = r; console.error("[TEST] ref assigned, focused:", r?.focused); }}
					focused
					placeholder="Type here..."
					placeholderColor="#565f89"
					textColor="#c0caf5"
					focusedTextColor="#c0caf5"
					focusedBackgroundColor="#1a1b26"
					cursorColor="#c0caf5"
					minHeight={1}
					maxHeight={3}
					onContentChange={() => {
						if (textareaEl) {
							const v = textareaEl.plainText;
							contentLog.push(v);
							setText(v);
							setChars(v.length);
						}
					}}
					onKeyDown={(e: any) => {
						keyLog.push(`key:${e.name}`);
						console.error(`[TEST] onKeyDown: name=${e.name} ctrl=${e.ctrl}`);
					}}
				/>
			</box>
		</box>
	);
}

async function main() {
	console.error("[TEST] Creating renderer...");
	const renderer: CliRenderer = await createCliRenderer({
		externalOutputMode: "passthrough",
		targetFps: 60,
		exitOnCtrlC: false,
		useKittyKeyboard: {},
		autoFocus: true,
		openConsoleOnError: false,
	});

	console.error("[TEST] Rendering app...");
	await render(() => <TestApp />, renderer);

	// Wait for render to settle and focus
	await new Promise(r => setTimeout(r, 800));

	// Check renderer state
	console.error(`[TEST] Renderer focused renderable: ${renderer.currentFocusedRenderable?.id ?? "null"}`);
	console.error(`[TEST] Textarea focused: ${textareaEl?.focused ?? false}`);

	// Simulate key events directly
	console.error("[TEST] Simulating keystrokes...");

	// Type "hi" directly via keyInput
	renderer.keyInput.emit("keypress", { name: "h", ctrl: false, shift: false, meta: false, eventType: "press" } as KeyEvent);
	await new Promise(r => setTimeout(r, 200));

	renderer.keyInput.emit("keypress", { name: "i", ctrl: false, shift: false, meta: false, eventType: "press" } as KeyEvent);
	await new Promise(r => setTimeout(r, 200));

	console.error(`[TEST] KeyLog: ${JSON.stringify(keyLog)}`);
	console.error(`[TEST] ContentLog: ${JSON.stringify(contentLog)}`);

	// Try Ctrl+C to exit
	renderer.keyInput.emit("keypress", { name: "c", ctrl: true, shift: false, meta: false, eventType: "press" } as KeyEvent);
	await new Promise(r => setTimeout(r, 200));

	renderer.destroy();
	process.exit(0);
}

main().catch(err => {
	console.error("[TEST] Error:", err);
	process.exit(1);
});