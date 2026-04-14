/**
 * Absolute minimum TUI — just KAPY logo + prompt + exit.
 * No routing, no ChatSession, no Ollama.
 * Purpose: verify keyboard input, exit, and rendering all work.
 */

import { createCliRenderer, type CliRendererConfig, type KeyBinding } from "@opentui/core";
import { render } from "@opentui/solid";
import { createSignal, onMount, Show } from "solid-js";

const PROMPT_KEY_BINDINGS: KeyBinding[] = [
	{ name: "return", action: "submit" },
	{ name: "return", shift: true, action: "newline" },
];

function App() {
	const [input, setInput] = createSignal("");
	const [sent, setSent] = createSignal("");
	const [exiting, setExiting] = createSignal(false);
	let textareaRef: any;

	const doExit = () => {
		setExiting(true);
		setTimeout(() => {
			process.stderr.write("\nBye!\n");
			process.exit(0);
		}, 100);
	};

	return (
		<box flexDirection="column" padding={1} backgroundColor="#1a1b26">
			<text fg="#00AAFF" bold>KAPY</text>
			<text fg="#7aa2f7">agent-first cli</text>
			<box height={1} />
			<Show when={sent() !== ""}>
				<text fg="#9ece6a">You said: {sent()}</text>
			</Show>
			<Show when={exiting()}>
				<text fg="#f7768e">Exiting...</text>
			</Show>
			<box height={1} />
			<box border={["left"]} borderColor="#00AAFF">
				<box paddingLeft={2} paddingRight={2} paddingTop={1} backgroundColor="#24283b">
					<textarea
						focused
						placeholder="Type something and press Enter..."
						placeholderColor="#565f89"
						textColor="#c0caf5"
						focusedTextColor="#c0caf5"
						focusedBackgroundColor="#24283b"
						cursorColor="#c0caf5"
						minHeight={1}
						maxHeight={3}
						keyBindings={PROMPT_KEY_BINDINGS}
						onContentChange={() => {
							if (textareaRef) setInput(textareaRef.plainText);
						}}
						onSubmit={() => {
							const text = input().trim();
							if (!text) return;
							if (text === "exit" || text === "quit" || text === ":q") {
								doExit();
								return;
							}
							setSent(text);
							setInput("");
							if (textareaRef) textareaRef.clear();
						}}
						onKeyDown={(e: any) => {
							if (e.ctrl && (e.name === "c" || e.name === "d")) {
								doExit();
								e.preventDefault();
								return;
							}
						}}
						ref={(r: any) => {
							textareaRef = r;
							setTimeout(() => r?.focus(), 10);
						}}
					/>
				</box>
			</box>
			<box height={1} />
			<text fg="#565f89">enter send · shift+enter newline · ctrl+c exit</text>
		</box>
	);
}

export async function launchChatTUI(): Promise<void> {
	if (!process.stdout.isTTY) {
		console.error("TUI requires an interactive terminal (TTY).");
		return;
	}

	const config: CliRendererConfig = {
		externalOutputMode: "passthrough" as const,
		targetFps: 60,
		gatherStats: false,
		exitOnCtrlC: false,
		useKittyKeyboard: {},
		autoFocus: true,
		openConsoleOnError: false,
	};

	const renderer = await createCliRenderer(config);

	// SIGINT/SIGHUP/SIGTERM → clean exit
	const cleanup = () => {
		try { renderer.destroy(); } catch {}
	};
	process.on("SIGHUP", () => { cleanup(); process.exit(0); });
	process.on("SIGINT", () => { cleanup(); process.exit(0); });
	process.on("SIGTERM", () => { cleanup(); process.exit(0); });

	await render(() => <App />, renderer);
}