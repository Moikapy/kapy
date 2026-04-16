/**
 * ChatSession — the glue between kapy-agent, kapy-ai, and kapy's harness.
 *
 * Uses @moikapy/kapy-agent's Agent class for the LLM ↔ tool loop.
 * Kapy provides: session persistence, Ollama auto-detect,
 * context compaction, slash commands, memory store.
 *
 * These integrate via Agent hooks:
 * - transformContext ← ContextTracker
 * - convertToLlm ← default (user/assistant/toolResult pass-through)
 *
 * Permission gating is removed — tools execute freely by default.
 * Extensions can add beforeToolCall hooks for custom gating.
 */

import type { AgentEvent, AgentMessage } from "@moikapy/kapy-agent";
import { Agent, GrimoireStore, extractQuery } from "@moikapy/kapy-agent";
import type { Model } from "@moikapy/kapy-ai";
import { getModel, registerModel, streamSimple } from "@moikapy/kapy-ai";
import { streamOllama } from "./stream-ollama.js";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { ToolRegistry } from "../tool/registry.js";
import type { KapyToolRegistration } from "../tool/types.js";
import { kapyToolsToAgentTools } from "./tool-bridge.js";
import { type ContextMessage, ContextTracker } from "./context-tracker.js";

import { OllamaAdapter } from "./provider/ollama.js";
import { SessionManager } from "./session/manager.js";
import { processSlashCommand, type SlashCommandContext } from "./slash-commands.js";
import { createGrimoireTools } from "./grimoire-tools.js";
import { loadSoulMd, ensureSoulMd, buildSystemPrompt } from "./soul.js";
import { GRIMOIRE_DIR, SOUL_FILE } from "../config/defaults.js";

/** Message shape for TUI rendering */
export interface ChatMessage {
	id: string;
	role: "user" | "assistant" | "tool" | "system";
	content: string;
	timestamp: number;
	isStreaming?: boolean;
	reasoning?: string;
	toolName?: string;
}

export interface ChatSessionOptions {
	/** Auto-detect Ollama on startup? Default: true */
	autoDetectOllama?: boolean;
	/** Default model (e.g., "ollama:qwen3:32b") */
	defaultModel?: string;
	/** System prompt (overridden by SOUL.md if autoLoadSoul is true) */
	systemPrompt?: string;
	/** Thinking/reasoning level for models that support it. Defaults to "off". */
	thinkingLevel?: "off" | "minimal" | "low" | "medium" | "high" | "xhigh";
	/** Continue most recent session instead of creating new? */
	continueRecent?: boolean;
	/** Path to specific session file to resume */
	resumeSession?: string;
	/** Custom session directory override */
	sessionDir?: string;
	/** Load SOUL.md as system prompt? Default: true */
	autoLoadSoul?: boolean;
	/** Initialize grimoire stores? Default: true */
	autoInitGrimoire?: boolean;
}

/** Model info for the internal registry */
interface RegisteredModel {
	id: string;
	label: string;
	provider: string;
	contextLength?: number;
	supportsVision?: boolean;
	supportsReasoning?: boolean;
}

export class ChatSession {
	readonly agent: Agent;
	readonly tools: ToolRegistry;
	readonly contextTracker: ContextTracker;

	/** Session manager — handles JSONL persistence and tree structure */
	sessions: SessionManager;

	/** Grimoire stores — the agent's persistent knowledge base */
	grimoireGlobal: GrimoireStore | null = null;
	grimoireProject: GrimoireStore | null = null;

	/** SOUL.md content */
	private soulMd: string | undefined;

	/** Internal model registry (populated by Ollama auto-detect + kapy-ai builtins) */
	private models: RegisteredModel[] = [];

	private listeners = new Set<(event: AgentEvent) => void>();
	private _messages: ChatMessage[] = [];
	private _isProcessing = false;
	private initialized = false;
	private sessionId: string;
	private defaultModel: string | undefined;

	constructor(options?: ChatSessionOptions) {
		this.tools = new ToolRegistry();
		this.defaultModel = options?.defaultModel;
		this.contextTracker = new ContextTracker();

		this.agent = new Agent({
			initialState: {
				systemPrompt: options?.systemPrompt ?? "",
				model: undefined as unknown as Model<string>,
				tools: [],
				thinkingLevel: options?.thinkingLevel ?? "off",
			},
			steeringMode: "one-at-a-time",
			followUpMode: "one-at-a-time",
			streamFn: (model, context, opts) => {
				// Use native Ollama SDK for Ollama models (proper think param, thinking streaming)
				if (model.provider === "ollama") return streamOllama(model, context, opts as any);
				return streamSimple(model, context, opts);
			},
			// Convert kapy messages to LLM-compatible format
			// Filter out UI-only messages (system status, internal notifications)
			// and ensure only user/assistant/toolResult reach the LLM
			convertToLlm: (messages) => {
				return messages.filter(
					(m) => m.role === "user" || m.role === "assistant" || m.role === "toolResult",
				);
			},
			// Compact context when approaching context limits + inject grimoire knowledge
			transformContext: async (messages, _signal) => {
				const model = this.agent.state.model;
				if (!model) return messages;

				let result = messages;

				// ── Context compaction ─────────────────────────────────
				const contextLength = model.contextWindow || 128_000;
				const contextMsgs = messages.map((m) => ({
					role: typeof m.role === "string" ? m.role : "user",
					content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
				}));

				if (this.contextTracker.shouldCompact(contextMsgs, contextLength)) {
					const compacted = this.contextTracker.compact(contextMsgs);
					result = compacted.map((cm) => ({
						...messages.find((m) => {
							const mContent = typeof m.content === "string" ? m.content : "";
							return mContent === cm.content;
						}) || { role: cm.role, content: cm.content, timestamp: Date.now() },
					})) as typeof messages;
				}

				// ── Grimoire context injection ─────────────────────────
				// Search grimoire for relevant knowledge and inject as system context
				if (this.grimoireGlobal || this.grimoireProject) {
					const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
					if (lastUserMsg) {
						const query = typeof lastUserMsg.content === "string"
							? extractQuery(lastUserMsg.content)
							: "";
						if (query) {
							try {
								// Search both scopes, merge results
								const globalResults = this.grimoireGlobal
									? await this.grimoireGlobal.search(query, 3)
									: [];
								const projectResults = this.grimoireProject
									? await this.grimoireProject.search(query, 2)
									: [];
								const allResults = [...globalResults, ...projectResults]
									.sort((a, b) => b.score - a.score)
									.slice(0, 5);

								if (allResults.length > 0) {
									const store = allResults[0].score >= (globalResults[0]?.score ?? 0)
										? this.grimoireGlobal!
										: this.grimoireProject!;
									const grimoireContext = store.summarizeForContext(allResults, 500);
									const ctxMessage = {
										role: "system" as const,
										content: grimoireContext,
										timestamp: Date.now(),
									};
									result = [ctxMessage, ...result] as typeof messages;
								}
							} catch {
								// Search failed, skip injection
							}
						}
					}
				}

				return result;
			},
		});

		// Initialize session — in-memory until init() persists
		this.sessionId = `chat-${Date.now()}`;
		this.sessions = SessionManager.inMemory(process.cwd());

		// Subscribe to agent events → update messages
		this.agent.subscribe((event) => this.handleAgentEvent(event));
	}

	/** Initialize providers, session persistence, grimoire, and SOUL.md. */
	async init(): Promise<void> {
		if (this.initialized) return;
		this.initialized = true;

		// Initialize session persistence
		if (this._resumeSessionPath) {
			this.sessions = SessionManager.open(this._resumeSessionPath, undefined);
		} else if (this._continueRecent) {
			this.sessions = SessionManager.continueRecent(process.cwd());
		} else {
			this.sessions = SessionManager.create(process.cwd());
		}
		this.sessionId = this.sessions.getSessionId();

		// Load existing messages from session
		if (this.sessions.getEntries().length > 0) {
			this._messages = this.entriesToMessages(this.sessions.getBranch());
		}

		// ── SOUL.md ──────────────────────────────────────────────────
		// Load SOUL.md as the system prompt
		if (this._autoLoadSoul !== false) {
			ensureSoulMd(SOUL_FILE);
			this.soulMd = loadSoulMd(SOUL_FILE);
			this.agent.state.systemPrompt = this.soulMd;
		}

		// ── Grimoire ───────────────────────────────────────────────
		// Initialize global and project grimoire stores
		if (this._autoInitGrimoire !== false) {
			this.grimoireGlobal = new GrimoireStore({ scope: "global", rootDir: GRIMOIRE_DIR });
			await this.grimoireGlobal.ensure();

			// Project grimoire (if .kapy/wiki/ exists or cwd has .kapy/)
			const projectWikiDir = join(process.cwd(), ".kapy", "wiki");
			if (existsSync(join(process.cwd(), ".kapy"))) {
				this.grimoireProject = new GrimoireStore({ scope: "project", rootDir: projectWikiDir });
				await this.grimoireProject.ensure();
			}

			// Register grimoire tools
			const grimoireTools = createGrimoireTools(
				this.grimoireGlobal,
				this.grimoireProject ?? undefined,
			);
			for (const tool of grimoireTools) {
				this.tools.register(tool);
			}
			this.agent.state.tools = kapyToolsToAgentTools(this.tools.all());
		}

		// Auto-detect Ollama and register its models
		const ollama = new OllamaAdapter();
		const isAvailable = await ollama.isAvailable();
		if (isAvailable) {
			try {
				const ollamaModels = await ollama.listModels();
				for (const model of ollamaModels) {
					// Register with kapy-ai's model registry so getModel() works
					registerModel("ollama", {
						id: model.id,
						name: model.id,
						api: "openai-completions" as const,
						provider: "ollama",
						baseUrl: `${ollama.baseUrl}/v1`,
						reasoning: model.supportsReasoning,
						input: model.supportsVision ? (["text", "image"] as const) : (["text"] as const),
						cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
						contextWindow: model.contextLength,
						maxTokens: Math.min(model.contextLength, 4096),
						compat: { supportsDeveloperRole: false, supportsReasoningEffort: false, thinkingFormat: "qwen" as const },
					} as any);

					this.models.push({
						id: model.id,
						label: model.id,
						provider: "ollama",
						contextLength: model.contextLength,
						supportsVision: model.supportsVision,
						supportsReasoning: model.supportsReasoning,
					});
				}
			} catch {
				// Model listing failed, that's OK
			}
		}

		// Set model — either from defaultModel or auto-detect
		if (this.defaultModel) {
			const colonIdx = this.defaultModel.indexOf(":");
			const providerId = colonIdx !== -1 ? this.defaultModel.slice(0, colonIdx) : "ollama";
			const modelId = colonIdx !== -1 ? this.defaultModel.slice(colonIdx + 1) : this.defaultModel;
			this.setModel(providerId, modelId);
		} else {
			this.autoSelectModel();
		}
	}

	private _continueRecent = false;
	private _resumeSessionPath: string | undefined;
	private _autoLoadSoul?: boolean;
	private _autoInitGrimoire?: boolean;

	/** Set session options before init() */
	setContinueRecent(value: boolean): void {
		this._continueRecent = value;
	}

	setResumeSession(path: string): void {
		this._resumeSessionPath = path;
	}

	/** Convert session entries to TUI messages. */
	private entriesToMessages(entries: import("./session/types.js").SessionEntry[]): ChatMessage[] {
		return entries
			.filter((e) => e.type === "message" && e.role)
			.map((e) => ({
				id: e.id,
				role: e.role as ChatMessage["role"],
				content: e.content ?? "",
				timestamp: new Date(e.timestamp).getTime(),
			}));
	}

	/** Get current message list for TUI */
	get messages(): ChatMessage[] {
		return this._messages;
	}

	/** Whether the agent is currently processing */
	get isProcessing(): boolean {
		return this._isProcessing;
	}

	/** Get current context usage */
	getContextUsage(): import("./context-tracker.js").ContextUsage {
		const msgs: ContextMessage[] = (this.agent.state.messages ?? []).map((m: AgentMessage) => ({
			role: typeof m.role === "string" ? m.role : "user",
			content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
		}));
		const maxTokens = 128_000;
		return this.contextTracker.getUsage(msgs, maxTokens);
	}

	/** Subscribe to chat events (message updates, processing state) */
	onEvent(fn: (event: AgentEvent) => void): () => void {
		this.listeners.add(fn);
		return () => this.listeners.delete(fn);
	}

	/** Send user input to the agent */
	async send(input: string): Promise<void> {
		const trimmed = input.trim();
		if (!trimmed) return;

		// Check for slash commands
		const slashCtx: SlashCommandContext = {
			agent: this.agent,
			providers: this,
			tools: this.tools,
			sessions: this.sessions,
			output: (text) => this.addSystemMessage(text),
		};

		if (await processSlashCommand(trimmed, slashCtx)) {
			return;
		}

		// Add user message immediately (optimistic UI)
		this.addUserMessage(trimmed);

		// Persist user message to session
		if (this.sessions.isPersisted()) {
			this.sessions.appendMessage({ role: "user", content: trimmed });
		}

		// Ensure model is set
		const currentModel = this.agent.state.model;
		if (!currentModel || (currentModel as unknown as { id?: string })?.id === "unknown") {
			this.autoSelectModel();
		}

		const model = this.agent.state.model;
		if (!model || (model as unknown as { id?: string })?.id === "unknown") {
			this.addSystemMessage("No model available. Connect a provider (e.g., start Ollama) and try again.");
			return;
		}

		// Run agent
		this._isProcessing = true;
		this.notifyListeners({ type: "agent_start" } as AgentEvent);

		try {
			await this.agent.prompt(trimmed);
		} catch (err) {
			this.addSystemMessage(`Error: ${err instanceof Error ? err.message : String(err)}`);
		} finally {
			this._isProcessing = false;
			this.notifyListeners({ type: "agent_end", messages: [] } as AgentEvent);

			// ── Session-end grimoire sync ────────────────────────
			// Log session activity to the grimoire
			if (this.grimoireGlobal) {
				try {
					await this.grimoireGlobal.appendLog({
						timestamp: new Date().toISOString(),
						type: "session",
						summary: trimmed.slice(0, 120),
						pagesRead: [], // Will be populated from tool call tracking eventually
					});
				} catch {
					// Log append failed — non-critical
				}
			}
		}
	}

	/** Abort current processing */
	abort(): void {
		this.agent.abort();
	}

	/** Register a tool and sync to agent state */
	registerTool(definition: KapyToolRegistration): void {
		this.tools.register(definition);
		// Sync tools to agent state so the LLM can call them
		this.agent.state.tools = kapyToolsToAgentTools(this.tools.all());
	}

	/** Register a model into the internal registry */
	registerModel(model: RegisteredModel): void {
		this.models.push(model);
	}

	/** Get all registered models */
	getAllModels(): RegisteredModel[] {
		return [...this.models];
	}

	/** Get model info by id */
	getModel(id: string): RegisteredModel | undefined {
		return this.models.find((m) => m.id === id);
	}

	/** Set the active model */
	setModel(providerId: string, modelId: string): void {
		// Try kapy-ai's model registry first (handles all known providers)
		const knownModel = getModel(providerId as import("@moikapy/kapy-ai").KnownProvider, modelId as never);
		if (knownModel) {
			(this.agent.state as { model: Model<string> }).model = knownModel;
		} else {
			// Model not in static registry — check runtime-registered models
			const registered = this.models.find((m) => m.provider === providerId && m.id === modelId);
			if (registered) {
				(this.agent.state as { model: Model<string> }).model = this.createLocalModel(providerId, modelId, registered);
			} else {
				// Unknown model — create a basic reference
				(this.agent.state as { model: Model<string> }).model = this.createLocalModel(providerId, modelId);
			}
		}

		// Persist model change to session
		if (this.sessions.isPersisted()) {
			this.sessions.appendModelChange(providerId, modelId);
		}
	}

	/** List available sessions for the current cwd */
	static async listSessions(cwd?: string): Promise<import("./session/types.js").SessionInfo[]> {
		return SessionManager.list(cwd ?? process.cwd());
	}

	/** List all sessions across all projects */
	static async listAllSessions(): Promise<import("./session/types.js").SessionInfo[]> {
		return SessionManager.listAll();
	}

	/** Load a specific session by file path */
	static async loadSession(path: string): Promise<SessionManager> {
		return SessionManager.open(path);
	}

	// ── Internal ────────────────────────────────────────────────────

	/** Create a Model reference for a local provider (e.g., Ollama) */
	private createLocalModel(providerId: string, modelId: string, info?: RegisteredModel): Model<string> {
		return {
			id: modelId,
			name: modelId,
			api: "openai-completions",
			provider: providerId,
			baseUrl: providerId === "ollama" ? `${process.env.OLLAMA_HOST ?? "http://localhost:11434"}/v1` : "",
			reasoning: info?.supportsReasoning ?? false,
			input: info?.supportsVision ? (["text", "image"] as const) : (["text"] as const),
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			contextWindow: info?.contextLength ?? 128_000,
			maxTokens: 4096,
			// Ollama doesn't support the "developer" role — force "system" role for system prompts
			// See: https://github.com/ollama/ollama — OpenAI compat doesn't support developer role
			...(providerId === "ollama" ? { compat: { supportsDeveloperRole: false, supportsReasoningEffort: false, thinkingFormat: "qwen" as const } } : {}),
		} as Model<string>;
	}

	/** Handle agent events → update internal message list + persist */
	private handleAgentEvent(event: AgentEvent): void {
		try {
		this.handleAgentEventInner(event);
		} catch (err) {
			console.error("[kapy] handleAgentEvent error:", err);
		}
	}

	/** Inner handler — may throw, caught by outer wrapper */
	private handleAgentEventInner(event: AgentEvent): void {
		if (event.type === "message_end" && (event as any).message?.role === "assistant") {
		}
		switch (event.type) {
			case "message_start": {
				if (event.message.role === "assistant") {
					const content = this.extractContent(event.message);
					this._messages.push({
						id: `msg-${Date.now()}`,
						role: "assistant",
						content,
						timestamp: Date.now(),
						isStreaming: true,
					});
					// Don't persist at message_start — content is incomplete/empty
				}
				break;
			}
			case "message_update": {
				if (event.message.role === "assistant") {
					const lastAssistant = this.findLastAssistantMessage();
					if (lastAssistant) {
						lastAssistant.content = this.extractContent(event.message);
						lastAssistant.isStreaming = true;
					}
				}
				break;
			}
			case "message_end": {
				if (event.message.role === "assistant") {
					const lastAssistant = this.findLastAssistantMessage();
					if (lastAssistant) {
						lastAssistant.content = this.extractContent(event.message);
						lastAssistant.isStreaming = false;
					}
					// Persist the completed assistant message
					if (this.sessions.isPersisted()) {
						const finalContent = this.extractContent(event.message);
						if (finalContent) {
							this.sessions.appendMessage({ role: "assistant", content: finalContent });
						}
					}
				} else if (event.message.role === "toolResult") {
					const content = this.extractContent(event.message);
					this._messages.push({
						id: `msg-${Date.now()}-tool`,
						role: "tool",
						content: content.length > 200 ? `${content.slice(0, 197)}...` : content,
						timestamp: Date.now(),
					});
					if (this.sessions.isPersisted()) {
						this.sessions.appendMessage({ role: "tool", content });
					}
				}
				break;
			}
			case "tool_execution_start":
			case "tool_execution_update":
			case "tool_execution_end":
				// Tool execution events — future: show progress
				break;
		}

		// Forward to any listeners
		this.notifyListeners(event);
	}

	/** Extract text content from an AgentMessage (handles content arrays) */
	private extractContent(message: AgentMessage): string {
		if (typeof message.content === "string") return message.content;
		if (Array.isArray(message.content)) {
			return message.content
				.filter((c): c is { type: "text"; text: string } => c.type === "text")
				.map((c) => c.text)
				.join("");
		}
		return "";
	}

	/** Add a user message to the display list */
	private addUserMessage(content: string): void {
		this._messages.push({
			id: `msg-${Date.now()}`,
			role: "user",
			content,
			timestamp: Date.now(),
		});
	}

	/** Add a system message (for slash command output, errors) */
	private addSystemMessage(content: string): void {
		this._messages.push({
			id: `msg-sys-${Date.now()}`,
			role: "system",
			content,
			timestamp: Date.now(),
		});
		if (this.sessions.isPersisted()) {
			this.sessions.appendMessage({ role: "system", content });
		}
	}

	/** Find the last assistant message in the display list */
	private findLastAssistantMessage(): ChatMessage | undefined {
		for (let i = this._messages.length - 1; i >= 0; i--) {
			if (this._messages[i].role === "assistant") {
				return this._messages[i];
			}
		}
		return undefined;
	}

	/** Auto-select a model from available providers */
	private autoSelectModel(): void {
		if (this.defaultModel) {
			const colonIdx = this.defaultModel.indexOf(":");
			const providerId = colonIdx !== -1 ? this.defaultModel.slice(0, colonIdx) : "ollama";
			const modelId = colonIdx !== -1 ? this.defaultModel.slice(colonIdx + 1) : this.defaultModel;
			this.setModel(providerId, modelId);
			return;
		}

		if (this.models.length === 0) return;

		const reasoning = this.models.find((m) => m.supportsReasoning);
		const pick = reasoning ?? this.models[0];
		if (pick) {
			this.setModel(pick.provider, pick.id);
		}
	}

	/** Notify all event listeners */
	private notifyListeners(event: AgentEvent): void {
		for (const fn of this.listeners) {
			fn(event);
		}
	}
}
