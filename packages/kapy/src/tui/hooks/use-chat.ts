/**
 * Chat bridge — connects ChatSession (ai/) to the TUI Solid signals.
 *
 * ChatSession owns the agent loop, provider, tools, and permissions.
 * This module owns the reactive state and event→signal wiring.
 * The TUI components subscribe to signals, never touch ChatSession directly.
 */

import { batch, createSignal } from "solid-js";
import { type ChatMessage, ChatSession } from "../../ai/chat-session.js";
import { bashTool, globTool, grepTool, readFileTool, writeFileTool } from "../../tool/index.js";
import { DEFAULT_MODEL, type Msg, systemPrompt } from "../types.js";

export function createChat() {
	const session = new ChatSession({
		defaultModel: DEFAULT_MODEL,
		systemPrompt,
	});

	// Register built-in tools
	session.tools.register(readFileTool);
	session.tools.register(writeFileTool);
	session.tools.register(bashTool);
	session.tools.register(globTool);
	session.tools.register(grepTool);

	// Reactive state
	const [msgs, setMsgs] = createSignal<Msg[]>([]);
	const [streaming, setStreaming] = createSignal(false);
	const [err, setErr] = createSignal("");
	const [model, setModel] = createSignal(DEFAULT_MODEL);
	const [models, setModels] = createSignal<string[]>([]);

	// Track streaming message ID for live updates
	let streamingId: string | null = null;

	// Wire ChatSession events → Solid signals
	session.onEvent((event) => {
		switch (event.type) {
			case "agent_start":
				setStreaming(true);
				setErr("");
				break;

			case "agent_end":
				setStreaming(false);
				// Mark last assistant message as done streaming
				setMsgs((prev) => prev.map((m) => (m.streaming ? { ...m, streaming: false } : m)));
				streamingId = null;
				break;

			case "message_start":
				if (event.message.role === "assistant") {
					streamingId = `msg-${Date.now()}`;
					batch(() => {
						setMsgs((prev) => [
							...prev,
							{
								id: streamingId!,
								role: "assistant",
								content: event.message.content,
								streaming: true,
							},
						]);
					});
				}
				break;

			case "message_update":
				// Update the streaming assistant message content
				setMsgs((prev) =>
					prev.map((m) => (m.streaming && m.role === "assistant" ? { ...m, content: event.message.content } : m)),
				);
				break;

			case "message_end":
				if (event.message.role === "assistant") {
					setMsgs((prev) =>
						prev.map((m) => (m.streaming ? { ...m, content: event.message.content, streaming: false } : m)),
					);
					streamingId = null;

					// Show tool calls as display messages
					if (event.message.toolCalls && event.message.toolCalls.length > 0) {
						for (const tc of event.message.toolCalls as Array<{ name: string; args: string }>) {
							const toolMsg = `⟹ ${tc.name}(${tc.args.length > 80 ? tc.args.slice(0, 77) + "..." : tc.args})`;
							setMsgs((prev) => [
								...prev,
								{
									id: `tc-${Date.now()}-${Math.random()}`,
									role: "tool_call" as const,
									content: toolMsg,
									toolName: tc.name,
								},
							]);
						}
					}
				}
				break;

			case "reasoning_update":
				setMsgs((prev) => prev.map((m) => (m.streaming ? { ...m, reasoning: (m.reasoning ?? "") + event.text } : m)));
				break;

			case "turn_end":
				// Add tool results as display messages
				if (event.toolResults && event.toolResults.length > 0) {
					batch(() => {
						for (const tr of event.toolResults) {
							setMsgs((prev) => [
								...prev,
								{
									id: `tool-${Date.now()}-${Math.random()}`,
									role: tr.role === "tool" ? ("tool_result" as const) : (tr.role as Msg["role"]),
									content: tr.content.length > 200 ? tr.content.slice(0, 197) + "..." : tr.content,
								},
							]);
						}
					});
				}
				break;

			case "error":
				setErr(event.error);
				setStreaming(false);
				break;
		}
	});

	// Expose send/abort that delegate to ChatSession
	async function send(text: string, navigate: (r: { type: "home" } | { type: "session"; sid: string }) => void) {
		if (!text.trim() || streaming()) return;

		// Add user message immediately (optimistic)
		batch(() => {
			setMsgs((prev) => [...prev, { id: `u-${Date.now()}`, role: "user", content: text.trim() }]);
			setErr("");
		});

		// Navigate to session view
		navigate({ type: "session", sid: `s-${Date.now()}` });

		// Init provider on first send (lazy — avoids import issues)
		await session.init();

		// Parse model string: "ollama:glm-5.1:cloud" → provider "ollama", model "glm-5.1:cloud"
		const currentModel = model();
		const colonIdx = currentModel.indexOf(":");
		if (colonIdx !== -1) {
			const providerId = currentModel.slice(0, colonIdx);
			const modelId = currentModel.slice(colonIdx + 1);
			session.setModel(providerId, modelId);
		}

		await session.send(text.trim());
	}

	function abort() {
		session.abort();
		setStreaming(false);
	}

	// Model list from provider registry
	async function fetchModels() {
		try {
			const modelInfos = session.providers.getAllModels();
			setModels(modelInfos.map((m) => m.id).sort());
			setSidebar(true);
		} catch {
			// Fallback: direct fetch from Ollama
			try {
				const r = await fetch("http://localhost:11434/v1/models");
				const d = await r.json();
				setModels((d.data || []).map((m: any) => m.id).sort());
			} catch {
				setErr("Failed to fetch models");
			}
		}
	}

	// Sidebar is TUI-local state, not ChatSession concern
	const [sidebar, setSidebar] = createSignal(false);

	return {
		session,
		msgs,
		setMsgs,
		streaming,
		setStreaming,
		err,
		setErr,
		model,
		setModel,
		models,
		setModels,
		sidebar,
		setSidebar,
		send,
		abort,
		fetchModels,
	};
}
