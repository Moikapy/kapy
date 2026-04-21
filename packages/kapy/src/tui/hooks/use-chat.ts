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

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { batch, createMemo, createSignal } from "solid-js";
import { ChatSession } from "../../ai/chat-session.js";
import type { SessionInfo } from "../../ai/session/types.js";
import {
	bashTool,
	globTool,
	grepTool,
	readFileTool,
	webFetchTool,
	webSearchTool,
	writeFileTool,
} from "../../tool/index.js";
import { DEFAULT_MODEL, DEFAULT_THINKING_LEVEL, type Msg, systemPrompt, type ToolStatus } from "../types.js";

const TOOL_PENDING_STYLES: Record<string, string> = {
	read_file: "Reading file...",
	write_file: "Writing file...",
	edit_file: "Preparing edit...",
	bash: "Running command...",
	grep: "Searching content...",
	glob: "Finding files...",
	find: "Finding files...",
	web_fetch: "Fetching from web...",
	web_search: "Searching web...",
};

function getToolPendingStyle(name: string): string {
	return TOOL_PENDING_STYLES[name] ?? "Working...";
}

/** Read user preferences from ~/.kapy/config.json */
function loadUserPrefs(): { model?: string; thinkingLevel?: string } {
	try {
		const configPath = join(homedir(), ".kapy", "config.json");
		if (!existsSync(configPath)) return {};
		const raw = readFileSync(configPath, "utf-8");
		const config = JSON.parse(raw);
		return {
			model: typeof config.model === "string" ? config.model : undefined,
			thinkingLevel: typeof config.thinkingLevel === "string" ? config.thinkingLevel : undefined,
		};
	} catch {
		return {};
	}
}

/** Save user preferences to ~/.kapy/config.json */
function savePreferences(modelVal: string, thinkingLevelVal: string) {
	try {
		const configPath = join(homedir(), ".kapy", "config.json");
		let config: Record<string, unknown> = {};
		if (existsSync(configPath)) {
			const raw = readFileSync(configPath, "utf-8");
			config = JSON.parse(raw);
		}
		config.model = modelVal;
		config.thinkingLevel = thinkingLevelVal;
		writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
	} catch {
		// Silently fail — prefs are best-effort
	}
}

const prefs = loadUserPrefs();

export function createChat() {
	const session = new ChatSession({
		defaultModel: prefs.model ?? DEFAULT_MODEL,
		systemPrompt,
		thinkingLevel: (prefs.thinkingLevel as any) ?? DEFAULT_THINKING_LEVEL,
		continueRecent: true, // Auto-resume last session
	});

	// Register built-in tools
	session.tools.register(readFileTool);
	session.tools.register(writeFileTool);
	session.tools.register(bashTool);
	session.tools.register(globTool);
	session.tools.register(grepTool);
	session.tools.register(webSearchTool);
	session.tools.register(webFetchTool);

	// Reactive state
	const [msgs, setMsgs] = createSignal<Msg[]>([]);
	const [streaming, setStreaming] = createSignal(false);
	const [err, setErr] = createSignal("");
	const [model, setModel] = createSignal(prefs.model ?? DEFAULT_MODEL);
	const [models, setModels] = createSignal<string[]>([]);
	const [thinkingLevel, setThinkingLevelSignal] = createSignal<"off" | "minimal" | "low" | "medium" | "high" | "xhigh">(
		(prefs.thinkingLevel as any) ?? DEFAULT_THINKING_LEVEL,
	);

	// Track streaming message ID for live updates
	let streamingId: string | null = null;
	let agentStartTime: number | null = null;

	// Wire ChatSession events → Solid signals
	session.onEvent((event) => {
		switch (event.type) {
			case "agent_start":
				setStreaming(true);
				setErr("");
				agentStartTime = Date.now();
				break;

			case "agent_end": {
				setStreaming(false);
				const dur = agentStartTime ? Date.now() - agentStartTime : 0;
				const currentModel = model();
				setMsgs((prev) =>
					prev.map((m) => (m.streaming ? { ...m, streaming: false, durationMs: dur, model: currentModel } : m)),
				);
				agentStartTime = null;
				streamingId = null;
				// Sync any compaction messages from the session
				{
					const sessionMsgs = session.messages;
					const existingIds = new Set(msgs().map((m) => m.id));
					const newCompaction = sessionMsgs.filter(
						(m: any) => m.role === "compaction" && !existingIds.has(m.id),
					) as any[];
					if (newCompaction.length > 0) {
						setMsgs((prev) => [
							...prev,
							...newCompaction.map((m: any) => ({
								id: m.id,
								role: "compaction" as const,
								content: m.content,
							})),
						]);
					}
				}
				break;
			}

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
						setMsgs((prev) =>
							prev.map((m) =>
								m.streaming
									? {
											...m,
											reasoning: (m.reasoning ?? "") + (amsgEvent as { type: "thinking_delta"; delta: string }).delta,
										}
									: m,
							),
						);
					}
				}
				break;

			case "message_end":
				if (event.message.role === "assistant") {
					const endContent = extractText(event.message);
					setMsgs((prev) => prev.map((m) => (m.streaming ? { ...m, content: endContent, streaming: false } : m)));
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
							content: resultContent,
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
				{
					const toolName = event.toolName;
					const _style = getToolPendingStyle(toolName);
					const pendingMsg = `⟹ ${toolName}(${JSON.stringify(event.args ?? {}).slice(0, 77)})`;
					setMsgs((prev) => [
						...prev,
						{
							id: `te-${event.toolCallId}`,
							role: "tool_call" as const,
							content: pendingMsg,
							toolName,
							toolStatus: "running" as ToolStatus,
						},
					]);
				}
				break;

			case "tool_execution_end":
				setMsgs((prev) =>
					prev.map((m) =>
						m.id === `te-${event.toolCallId}`
							? { ...m, toolStatus: (event.isError ? "error" : "completed") as ToolStatus }
							: m,
					),
				);
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

		try {
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
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : String(err);
			console.error("[kapy] send error:", message);
			batch(() => {
				setErr(message);
				setStreaming(false);
			});
		}
	}

	function abort() {
		session.abort();
		setStreaming(false);
	}

	/** Change model and persist to config */
	function changeModel(newModel: string) {
		setModel(newModel);
		session.init().then(() => {
			const colonIdx = newModel.indexOf(":");
			if (colonIdx !== -1) {
				session.setModel(newModel.slice(0, colonIdx), newModel.slice(colonIdx + 1));
			}
		});
		savePreferences(model(), thinkingLevel());
	}

	/** Change thinking level at runtime */
	function setThinkingLevel(level: string) {
		const valid: string[] = ["off", "minimal", "low", "medium", "high", "xhigh"];
		if (!valid.includes(level)) return;
		session.agent.state.thinkingLevel = level as any;
		setThinkingLevelSignal(level as any);
		savePreferences(model(), thinkingLevel());
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

	/** Load a previous session by file path and navigate to it */
	async function loadSession(
		path: string,
		navigate?: (r: { type: "home" } | { type: "session"; sid: string }) => void,
	) {
		await session.init();
		const sm = await ChatSession.loadSession(path);
		session.sessions = sm;

		// Rebuild messages from session entries
		const entries = sm.getBranch();
		const loadedMsgs: Msg[] = [];
		for (const e of entries) {
			// Render compaction entries
			if (e.type === "compaction" && e.summary) {
				const tokensStr = e.tokensBefore ? ` (${e.tokensBefore.toLocaleString()} tokens before)` : "";
				loadedMsgs.push({
					id: e.id,
					role: "compaction" as Msg["role"],
					content: `Context compacted${tokensStr}. Earlier messages summarized.`,
				});
				continue;
			}

			// Skip non-message entries
			if (e.type !== "message" || !e.role) continue;

			// Map session roles to TUI roles
			const rawRole = e.role as string;
			let role = rawRole as Msg["role"];
			if (rawRole === "tool") role = "tool_result";
			const content = e.content ?? "";

			// Skip empty assistant messages
			if (rawRole === "assistant" && !content) continue;

			if (rawRole === "tool") {
				loadedMsgs.push({
					id: e.id,
					role: "tool_result" as Msg["role"],
					content: content.length > 200 ? `${content.slice(0, 197)}...` : content,
				});
				continue;
			}

			loadedMsgs.push({
				id: e.id,
				role,
				content,
			});
		}
		setMsgs(loadedMsgs);

		// Navigate to session view if callback provided
		if (navigate) {
			navigate({ type: "session", sid: sm.getSessionId() });
		}
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
		const _state = session.agent.state;
		return {
			hasQueued: session.agent.hasQueuedMessages(),
			count: 0, // kapy-agent doesn't expose queue length
		};
	}

	const contextUsage = createMemo(() => {
		msgs();
		try {
			return session.getContextUsage();
		} catch {
			return { usedTokens: 0, maxTokens: 128000, fraction: 0, shouldCompact: false };
		}
	});

	return {
		session,
		msgs,
		setMsgs,
		streaming,
		setStreaming,
		err,
		setErr,
		model,
		setModel: changeModel,
		setThinkingLevel,
		thinkingLevel,
		models,
		setModels,
		send,
		abort,
		fetchModels,
		loadSession,
		listSessions,
		listAllSessions,
		contextUsage,
		get queuedCount() {
			return getQueueInfo().count;
		},
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
function extractToolCalls(message: {
	content: unknown;
}): Array<{ id: string; name: string; arguments?: Record<string, unknown> }> {
	if (!Array.isArray(message.content)) return [];
	return message.content
		.filter(
			(c): c is { type: "toolCall"; id: string; name: string; arguments?: Record<string, unknown> } =>
				c.type === "toolCall",
		)
		.map((c) => ({ id: c.id, name: c.name, arguments: c.arguments }));
}
