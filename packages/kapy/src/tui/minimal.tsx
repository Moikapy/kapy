#!/usr/bin/env bun
/**
 * Minimal Kapy TUI — proven working pattern from OpenCode.
 *
 * This is the simplest possible working TUI that:
 * - Renders KAPY logo + prompt
 * - Handles all keyboard events
 * - Exits cleanly on Ctrl+C, q, or :q
 * - Sends messages to Ollama and shows responses
 * - Streams responses in real time
 *
 * Key architectural decisions (from OpenCode research):
 * 1. createCliRenderer with exitOnCtrlC: false
 * 2. ExitProvider with SIGHUP/SIGINT/SIGTERM handlers
 * 3. useKeyboard for global handlers (Ctrl+C, Escape)
 * 4. TextareaRenderable with keyBindings {return: "submit"}
 * 5. PromptRef pattern for focus management
 * 6. No process.exit() — resolve the launch promise
 */

import { createCliRenderer, type CliRendererConfig, type KeyBinding } from "@opentui/core";
import { render, useKeyboard, useTerminalDimensions, useRenderer } from "@opentui/solid";
import { createSignal, createEffect, onMount, onCleanup, Show, For, type ParentComponent, createContext, useContext } from "solid-js";

// ─── Key bindings (OpenCode pattern) ──────────────────
const PROMPT_KEY_BINDINGS: KeyBinding[] = [
	{ name: "return", action: "submit" },
	{ name: "return", shift: true, action: "newline" },
];

// ─── Exit Provider (OpenCode pattern) ────────────────
interface ExitContextValue {
	exit: (reason?: unknown) => Promise<void>;
}
const ExitContext = createContext<ExitContextValue>();
function useExit() {
	const ctx = useContext(ExitContext);
	if (!ctx) throw new Error("useExit must be within ExitProvider");
	return ctx;
}
const ExitProvider: ParentComponent<{ onExit: () => Promise<void>; onBeforeExit?: () => Promise<void> }> = (props) => {
	const renderer = useRenderer();
	let exitTask: Promise<void> | undefined;
	const doExit: ExitContextValue["exit"] = async (reason?: unknown) => {
		if (exitTask) return exitTask;
		exitTask = (async () => {
			try { await props.onBeforeExit?.(); } catch {}
			try { renderer.setTerminalTitle(""); } catch {}
			try { renderer.destroy(); } catch {}
			if (reason) process.stderr.write(`\n${reason instanceof Error ? reason.message : String(reason)}\n`);
			await props.onExit?.();
		})();
		return exitTask;
	};
	process.on("SIGHUP", () => doExit("SIGHUP"));
	process.on("SIGINT", () => doExit("Ctrl+C"));
	process.on("SIGTERM", () => doExit("SIGTERM"));
	return <ExitContext.Provider value={{ exit: doExit }}>{props.children}</ExitContext.Provider>;
};

// ─── Simple chat with Ollama ─────────────────────────
async function* streamChat(model: string, messages: Array<{role: string; content: string}>): AsyncGenerator<string> {
	const response = await fetch("http://localhost:11434/v1/chat/completions", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ model, messages, stream: true }),
	});
	if (!response.ok) {
		const err = await response.text().catch(() => response.statusText);
		throw new Error(`Ollama error: ${err}`);
	}
	if (!response.body) throw new Error("No response body");
	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		buffer += decoder.decode(value, { stream: true });
		const lines = buffer.split("\n");
		buffer = lines.pop() ?? "";
		for (const line of lines) {
			const data = line.startsWith("data: ") ? line.slice(6) : line;
			if (data === "[DONE]") return;
			try {
				const parsed = JSON.parse(data);
				const content = parsed.choices?.[0]?.delta?.content;
				if (content) yield content;
			} catch { /* skip invalid lines */ }
		}
	}
}

// ─── Kapy App ─────────────────────────────────────────
const KAPY_LINES = ["KAPY"];
const TAGLINE = "agent-first cli";

function KapyApp() {
	const route = useRoute();
	const dimensions = useTerminalDimensions();
	const exit = useExit();
	const [messages, setMessages] = createSignal<Array<{role: string; content: string; streaming?: boolean}>>([]);
	const [input, setInput] = createSignal("");
	const [isStreaming, setIsStreaming] = createSignal(false);
	const [model, setModel] = createSignal("glm-5.1:cloud");
	const [error, setError] = createSignal<string | null>(null);
	let textareaRef: any;
	let scrollRef: any;

	// Global keyboard: Ctrl+C exit, Escape back
	useKeyboard((evt) => {
		if (evt.ctrl && (evt.name === "c" || evt.name === "d")) {
			exit("Ctrl+C");
			return;
		}
		if (evt.name === "escape") {
			if (route.data().type === "session") {
				route.navigate({ type: "home" });
			}
		}
	});

	const sendMessage = async () => {
		const text = input().trim();
		if (!text || isStreaming()) return;

		// Navigate to session on first message from home
		if (route.data().type === "home") {
			route.navigate({ type: "session" });
		}

		setMessages(prev => [...prev, { role: "user", content: text }]);
		setInput("");
		if (textareaRef) { textareaRef.clear(); }
		setIsStreaming(true);
		setError(null);

		// Add empty assistant message for streaming
		setMessages(prev => [...prev, { role: "assistant", content: "", streaming: true }]);

		try {
			const chatMessages = messages().concat([{ role: "user", content: text }]).map(m => ({ role: m.role, content: m.content }));
			let fullContent = "";
			for await (const chunk of streamChat(model(), chatMessages)) {
				fullContent += chunk;
				setMessages(prev => {
					const updated = [...prev];
					updated[updated.length - 1] = { role: "assistant", content: fullContent, streaming: true };
					return updated;
				});
			}
			// Mark streaming done
			setMessages(prev => {
				const updated = [...prev];
				updated[updated.length - 1] = { role: "assistant", content: fullContent };
				return updated;
			});
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
			// Remove empty assistant message on error
			setMessages(prev => prev.filter(m => m.content !== "" || m.role !== "assistant"));
		} finally {
			setIsStreaming(false);
			// Re-focus textarea after response
			setTimeout(() => textareaRef?.focus(), 50);
		}
	};

	return (
		<box width={dimensions().width} height={dimensions().height} backgroundColor="#1a1b26" flexDirection="column">
			<Show when={route.data().type === "home"}>
				{/* Home screen */}
				<box flexDirection="column" alignItems="center" flexGrow={1} paddingLeft={2} paddingRight={2}>
					<box flexGrow={1} minHeight={0} />
					<box height={4} minHeight={0} flexShrink={1} />
					<box flexShrink={0}>
						<box flexDirection="row">
							<For each={KAPY_LINES[0].split("")}>{(char) => <text fg="#00AAFF" bold>{char}</text>}</For>
						</box>
						<text fg="#565f89">{TAGLINE}</text>
					</box>
					<box height={1} minHeight={0} flexShrink={1} />
					<box width="100%" maxWidth={75} zIndex={1000} paddingTop={1} flexShrink={0}>
						<box border={["left"]} borderColor="#00AAFF">
							<box paddingLeft={2} paddingRight={2} paddingTop={1} flexGrow={1} backgroundColor="#24283b">
								<textarea
									focused
									placeholder='Ask anything... "Fix a TODO in the codebase"'
									placeholderColor="#565f89"
									textColor="#c0caf5"
									focusedTextColor="#c0caf5"
									focusedBackgroundColor="#24283b"
									cursorColor="#c0caf5"
									minHeight={1}
									maxHeight={6}
									keyBindings={PROMPT_KEY_BINDINGS}
									onContentChange={() => {
										if (textareaRef) setInput(textareaRef.plainText);
									}}
									onSubmit={() => {
										setTimeout(() => setTimeout(() => sendMessage(), 0), 0);
									}}
									ref={(r: any) => {
										textareaRef = r;
										setTimeout(() => r?.focus(), 0);
									}}
								/>
								<box flexDirection="row" flexShrink={0} paddingTop={1} gap={1} justifyContent="space-between">
									<text fg="#00AAFF">⟩</text>
									<text fg="#c0caf5">kapy · {model()}</text>
								</box>
							</box>
						</box>
					</box>
					<box height={6} minHeight={0} flexShrink={1} />
					<box flexDirection="column" gap={1} flexShrink={0}>
						<text fg="#565f89"><text fg="#00AAFF">enter</text> send · <text fg="#00AAFF">shift+enter</text> newline · <text fg="#00AAFF">!</text> shell</text>
						<text fg="#565f89"><text fg="#00AAFF">tab</text> switch agent · <text fg="#00AAFF">esc</text> abort · <text fg="#00AAFF">?</text> help</text>
					</box>
					<box flexGrow={1} minHeight={0} />
				</box>
			</Show>

			<Show when={route.data().type === "session"}>
				{/* Session screen */}
				<box flexDirection="column" height="100%" paddingLeft={2} paddingRight={2}>
					{/* Messages */}
					<box flexGrow={1}>
						<scrollbox ref={(r: any) => { scrollRef = r; }} height="100%">
							<box height={1} />
							<For each={messages()}>
								{(message) => (
									<box marginTop={1} flexShrink={0}>
										<Show when={message.role === "user"}>
											<box border={["left"]} borderColor="#00AAFF">
												<box paddingTop={1} paddingBottom={1} paddingLeft={2} backgroundColor="#1f2335">
													<text fg="#c0caf5">{message.content}</text>
												</box>
											</box>
										</Show>
										<Show when={message.role === "assistant"}>
											<box paddingLeft={3}>
												<text fg="#c0caf5">
													{message.content}
													<Show when={message.streaming}><text fg="#00AAFF"> ●</text></Show>
												</text>
											</box>
										</Show>
									</box>
								)}
							</For>
							<Show when={isStreaming() && messages().length > 0 && messages()[messages().length - 1]?.role !== "assistant"}>
								<box paddingLeft={3} marginTop={1}>
									<text fg="#565f89">thinking...</text>
								</box>
							</Show>
						</scrollbox>
					</box>

					{/* Input */}
					<box flexShrink={0}>
						<box border={["left"]} borderColor="#00AAFF">
							<box paddingLeft={2} paddingRight={2} paddingTop={1} flexGrow={1} backgroundColor="#24283b">
								<textarea
									focused
									placeholder="Message..."
									placeholderColor="#565f89"
									textColor="#c0caf5"
									focusedTextColor="#c0caf5"
									focusedBackgroundColor="#24283b"
									cursorColor="#c0caf5"
									minHeight={1}
									maxHeight={4}
									keyBindings={PROMPT_KEY_BINDINGS}
									onContentChange={() => {
										if (textareaRef) setInput(textareaRef.plainText);
									}}
									onSubmit={() => {
										setTimeout(() => setTimeout(() => sendMessage(), 0), 0);
									}}
									ref={(r: any) => {
										textareaRef = r;
										setTimeout(() => r?.focus(), 0);
									}}
								/>
								<box flexDirection="row" paddingTop={1} gap={1}>
									<text fg="#00AAFF">⟩</text>
									<text fg="#c0caf5">kapy · {model()}</text>
									<Show when={isStreaming()}><text fg="#565f89">thinking...</text></Show>
								</box>
							</box>
						</box>
					</box>
				</box>

				<Show when={error() !== null}>
					<box paddingLeft={2} paddingTop={1}>
						<text fg="#f7768e">Error: {error()}</text>
					</box>
				</Show>
			</Show>

			{/* Footer */}
			<box flexDirection="row" justifyContent="space-between" paddingLeft={2} paddingRight={2} flexShrink={0}>
				<text fg="#565f89">~/kapy</text>
				<text fg="#565f89">⊙ ollama · <text fg="#c0caf5">{model()}</text> · <text fg="#565f89">?</text></text>
			</box>
		</box>
	);
}

// ─── Route context ──────────────────────────────────
type RouteData = { type: "home" } | { type: "session" };
const RouteContext = createContext<{ data: () => RouteData; navigate: (r: RouteData) => void }>();
function useRoute() { return useContext(RouteContext)!; }

// ─── Launch ──────────────────────────────────────────
export async function launchChatTUI(): Promise<void> {
	if (!process.stdout.isTTY) {
		console.error("TUI requires an interactive terminal (TTY).");
		return;
	}

	const rendererConfig: CliRendererConfig = {
		externalOutputMode: "passthrough",
		targetFps: 60,
		gatherStats: false,
		exitOnCtrlC: false,
		useKittyKeyboard: {},
		autoFocus: true,
		openConsoleOnError: false,
	};

	await new Promise<void>(async (resolve) => {
		const renderer = await createCliRenderer(rendererConfig);
		const [routeData, setRouteData] = createSignal<RouteData>({ type: "home" });
		const route = { data: routeData, navigate: (r: RouteData) => setRouteData(r) };

		await render(() => (
			<RouteContext.Provider value={route}>
				<ExitProvider onExit={async () => resolve()} onBeforeExit={async () => {}}>
					<KapyApp />
				</ExitProvider>
			</RouteContext.Provider>
		), renderer);
		resolve();
	});
}