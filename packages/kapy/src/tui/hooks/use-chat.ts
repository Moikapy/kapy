/**
 * Chat bridge — connects ChatSession (ai/) to the TUI Solid signals.
 *
 * ChatSession owns the agent loop, provider, tools, and permissions.
 * This module owns the reactive state and event→signal wiring.
 * The TUI components subscribe to signals, never touch ChatSession directly.
 *
 * Session persistence: ChatSession uses SessionManager to persist
 * conversations to ~/.kapy/sessions/<encoded-cwd>/<timestamp>_<id>.jsonl.
 * On init, sessions auto-continue from the most recent session.
 */

import { batch, createSignal } from "solid-js";
import { ChatSession } from "../../ai/chat-session.js";
import type { AgentEvent } from "@moikapy/kapy-agent";
import type { SessionInfo } from "../../ai/session/types.js";
import { bashTool, globTool, grepTool, readFileTool, writeFileTool } from "../../tool/index.js";
import { DEFAULT_MODEL, DEFAULT_THINKING_LEVEL, type Msg, systemPrompt } from "../types.js";

export function createChat() {
	const session = new ChatSession({
		defaultModel: DEFAULT_MODEL,
		systemPrompt,
		thinkingLevel: DEFAULT_THINKING_LEVEL,
		continueRecent: true, // Auto-resume last session
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
					const startContent = extractText(event.message);
					batch(() => {
						setMsgs((prev) => [
							...prev,
							{
								id: streamingId!,
								role: "assistant",
								content: startContent,
								streaming: true,
							},
						]);
					});
				}
				break;

			case "message_update":
				// Update the streaming assistant message content
				{
					const updateContent = extractText(event.message);
					setMsgs((prev) =>
						prev.map((m) => (m.streaming && m.role === "assistant" ? { ...m, content: updateContent } : m)),
					);
					// Handle reasoning/thinking updates
					const amsgEvent = event.assistantMessageEvent;
					if (amsgEvent && amsgEvent.type === "thinking_delta" && "delta" in amsgEvent) {
						setMsgs((prev) => prev.map((m) => (m.streaming ? { ...m, reasoning: (m.reasoning ?? "") + (amsgEvent as { type: "thinking_delta"; delta: string }).delta } : m)));
					}
				}
				break;

			case "message_end":
				if (event.message.role === "assistant") {
					const endContent = extractText(event.message);
					setMsgs((prev) =>
						prev.map((m) => (m.streaming ? { ...m, content: endContent, streaming: false } : m)),
					);
					streamingId = null;

					// Show tool calls from assistant message content
					const toolCalls = extractToolCalls(event.message);
					if (toolCalls.length > 0) {
						for (const tc of toolCalls) {
							const argsStr = JSON.stringify(tc.arguments ?? {});
							const toolMsg = `⟹ ${tc.name}(${argsStr.length > 80 ? `${argsStr.slice(0, 77)}...` : argsStr})`;
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
				} else if (event.message.role === "toolResult") {
					const resultContent = extractText(event.message);
					setMsgs((prev) => [
						...prev,
						{
							id: `tool-${Date.now()}-${Math.random()}`,
							role: "tool_result" as const,
							content: resultContent.length > 200 ? `${resultContent.slice(0, 197)}...` : resultContent,
						},
					]);
				}
				break;

			case "turn_end": {
				// kapy-agent emits tool results as individual toolResult messages
				// already handled above in message_end
				break;
			}

			case "tool_execution_start":
			case "tool_execution_update":
			case "tool_execution_end":
				// Tool execution events — future: show progress indicators
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
		navigate({ type: "session", sid: session.sessions.getSessionId() });

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

	/** Change thinking level at runtime */
	function setThinkingLevel(level: string) {
		const valid: string[] = ["off", "minimal", "low", "medium", "high", "xhigh"];
		if (!valid.includes(level)) return;
		session.agent.state.thinkingLevel = level as any;
	}

	// Model list from provider registry
	async function fetchModels() {
		await session.init();
		try {
			const modelInfos = session.getAllModels();
			if (modelInfos.length > 0) {
				setModels(modelInfos.map((m) => m.id).sort());
				return;
			}
		} catch {
			// Provider registry failed, try direct fetch
		}
		// Fallback: direct fetch from Ollama
		try {
			const r = await fetch("http://localhost:11434/v1/models");
			const d = await r.json();
			setModels((d.data || []).map((m: { id: string }) => m.id).sort());
		} catch {
			setErr("Failed to fetch models — is Ollama running?");
		}
	}

	/** Load a previous session by file path */
	async function loadSession(path: string) {
		await session.init();
		const sm = await ChatSession.loadSession(path);
		session.sessions = sm;

		// Rebuild messages from session entries
		const entries = sm.getBranch();
		const loadedMsgs: Msg[] = entries
			.filter((e) => e.type === "message" && e.role)
			.map((e) => ({
				id: e.id,
				role: e.role as Msg["role"],
				content: e.content ?? "",
			}));
		setMsgs(loadedMsgs);
	}

	/** List sessions for the current project */
	async function listSessions(): Promise<SessionInfo[]> {
		return ChatSession.listSessions();
	}

	/** List all sessions across all projects */
	async function listAllSessions(): Promise<SessionInfo[]> {
		return ChatSession.listAllSessions();
	}

	function getQueueInfo() {
		const state = session.agent.state;
		return {
			hasQueued: session.agent.hasQueuedMessages(),
			count: 0, // kapy-agent doesn't expose queue length
		};
	}

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
		setThinkingLevel,
		models,
		setModels,
		send,
		abort,
		fetchModels,
		loadSession,
		listSessions,
		listAllSessions,
		get queuedCount() { return getQueueInfo().count; },
	};
}

/** Extract text content from an AgentMessage (handles both string and ContentBlock[] formats) */
function extractText(message: { content: unknown }): string {
	if (typeof message.content === "string") return message.content;
	if (Array.isArray(message.content)) {
		return message.content
			.filter((c): c is { type: "text"; text: string } => c.type === "text")
			.map((c) => c.text)
			.join("");
	}
	return "";
}

/** Extract tool calls from an AgentMessage content array */
function extractToolCalls(message: { content: unknown }): Array<{ id: string; name: string; arguments?: Record<string, unknown> }> {
	if (!Array.isArray(message.content)) return [];
	return message.content
		.filter((c): c is { type: "toolCall"; id: string; name: string; arguments?: Record<string, unknown> } => c.type === "toolCall")
		.map((c) => ({ id: c.id, name: c.name, arguments: c.arguments }));
}