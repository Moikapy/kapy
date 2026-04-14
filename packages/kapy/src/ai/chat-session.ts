/**
 * ChatSession — the glue between AgentLoop, registries, and TUI.
 *
 * Owns:
 * - KapyAgent (state, events, steering/followUp)
 * - AgentLoop (LLM ↔ tool cycle)
 * - ProviderRegistry + adapters
 * - ToolRegistry
 * - PermissionEvaluator
 * - SessionManager (tree-structured message history)
 *
 * Exposes:
 * - Reactive message list (for TUI rendering)
 * - send(input) — submit user input → agent loop
 * - slash command processing
 * - Event subscription for real-time UI updates
 */

import { KapyAgent } from "../ai/agent/agent.js";
import { AgentLoop } from "../ai/agent-loop.js";
import { ProviderRegistry } from "../ai/provider/registry.js";
import { ToolRegistry } from "../tool/registry.js";
import { PermissionEvaluator } from "../ai/permission/evaluator.js";
import { SessionManager } from "../ai/session/manager.js";
import { OllamaAdapter } from "../ai/provider/ollama.js";
import { processSlashCommand, type SlashCommandContext } from "../ai/slash-commands.js";
import type { AgentEvent, AgentMessage } from "../ai/agent/types.js";
import type { ProviderAdapter } from "../ai/provider/types.js";

/** Message shape for TUI rendering */
export interface ChatMessage {
	id: string;
	role: "user" | "assistant" | "tool" | "system";
	content: string;
	timestamp: number;
	isStreaming?: boolean;
	toolName?: string;
}

export interface ChatSessionOptions {
	/** Auto-detect Ollama on startup? Default: true */
	autoDetectOllama?: boolean;
	/** Permission rules */
	permissionRules?: import("../ai/permission/types.js").PermissionRule[];
	/** Default model (e.g., "ollama:qwen3:32b") */
	defaultModel?: string;
	/** System prompt */
	systemPrompt?: string;
}

export class ChatSession {
	readonly agent: KapyAgent;
	readonly loop: AgentLoop;
	readonly providers: ProviderRegistry;
	readonly tools: ToolRegistry;
	readonly permissions: PermissionEvaluator;
	readonly sessions: SessionManager;
	private listeners = new Set<(event: AgentEvent) => void>();
	private _messages: ChatMessage[] = [];
	private _isProcessing = false;
	private initialized = false;
	private sessionId: string;

	constructor(options?: ChatSessionOptions) {
		this.agent = new KapyAgent();
		this.providers = new ProviderRegistry();
		this.tools = new ToolRegistry();
		this.permissions = new PermissionEvaluator(options?.permissionRules ?? []);
		this.sessions = new SessionManager();
		this.sessionId = `chat-${Date.now()}`;

		this.loop = new AgentLoop(
			this.agent,
			this.tools,
			this.providers,
			this.permissions,
		);

		// Subscribe to agent events → update messages
		this.agent.subscribe((event) => this.handleAgentEvent(event));

		// Set system prompt if provided
		if (options?.systemPrompt) {
			this.agent.setSystemPrompt(options.systemPrompt);
		}
	}

	/** Initialize providers (auto-detect Ollama, etc.) */
	async init(): Promise<void> {
		if (this.initialized) return;
		this.initialized = true;

		// Auto-detect Ollama
		const ollama = new OllamaAdapter();
		const isAvailable = await ollama.isAvailable();
		if (isAvailable) {
			this.loop.setProviderAdapter("ollama", ollama);
			this.providers.register({
				id: "ollama",
				name: "Ollama",
				type: "ollama",
				baseUrl: ollama.baseUrl,
			});

			// Fetch available models
			try {
				const models = await ollama.listModels();
				for (const model of models) {
					this.providers.addModel("ollama", model);
				}
			} catch {
				// Model listing failed, that's OK
			}
		}
	}

	/** Get current message list for TUI */
	get messages(): ChatMessage[] {
		return this._messages;
	}

	/** Whether the agent is currently processing */
	get isProcessing(): boolean {
		return this._isProcessing;
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
			providers: this.providers,
			tools: this.tools,
			sessions: this.sessions,
			output: (text) => this.addSystemMessage(text),
		};

		if (await processSlashCommand(trimmed, slashCtx)) {
			return; // Slash command handled
		}

		// Add user message immediately (optimistic UI)
		this.addUserMessage(trimmed);

		// Set model if not already set
		if (!this.agent.state.model) {
			this.autoSelectModel();
		}

		if (!this.agent.state.model) {
			this.addSystemMessage("No model available. Connect a provider (e.g., start Ollama) and try again.");
			return;
		}

		// Run agent loop
		this._isProcessing = true;
		this.notifyListeners({ type: "agent_start" });

		try {
			await this.loop.prompt(trimmed);
		} catch (err) {
			this.addSystemMessage(`Error: ${err instanceof Error ? err.message : String(err)}`);
		} finally {
			this._isProcessing = false;
			this.notifyListeners({ type: "agent_end", messages: this.agent.state.messages });
		}
	}

	/** Abort current processing */
	abort(): void {
		this.agent.abort();
	}

	/** Register a tool */
	registerTool(definition: import("../tool/types.js").KapyToolRegistration): void {
		this.tools.register(definition);
	}

	/** Register a provider adapter */
	registerProvider(providerId: string, adapter: ProviderAdapter): void {
		this.loop.setProviderAdapter(providerId, adapter);
	}

	/** Set the active model */
	setModel(providerId: string, modelId: string): void {
		this.agent.setModel({ id: modelId, provider: providerId });
	}

	/** Handle agent events → update internal message list */
	private handleAgentEvent(event: AgentEvent): void {
		switch (event.type) {
			case "message_start": {
				// Start of assistant message (might be streaming)
				if (event.message.role === "assistant") {
					this._messages.push({
						id: `msg-${Date.now()}`,
						role: "assistant",
						content: event.message.content,
						timestamp: Date.now(),
						isStreaming: true,
					});
				}
				break;
			}
			case "message_update": {
				// Streaming token — update last assistant message
				if (event.message.role === "assistant") {
					const lastAssistant = this.findLastAssistantMessage();
					if (lastAssistant) {
						lastAssistant.content = event.message.content;
						lastAssistant.isStreaming = true;
					}
				}
				break;
			}
			case "message_end": {
				// Finished streaming
				if (event.message.role === "assistant") {
					const lastAssistant = this.findLastAssistantMessage();
					if (lastAssistant) {
						lastAssistant.content = event.message.content;
						lastAssistant.isStreaming = false;
					}
				}
				break;
			}
			case "turn_end": {
				// Add tool results to message list
				if (event.toolResults) {
					for (const tr of event.toolResults) {
						this._messages.push({
							id: `msg-${Date.now()}-${Math.random()}`,
							role: tr.role as "tool",
							content: tr.content,
							timestamp: Date.now(),
						});
					}
				}
				break;
			}
		}

		// Forward to any listeners
		this.notifyListeners(event);
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
		const models = this.providers.getAllModels();
		if (models.length === 0) return;

		// Prefer a reasoning-capable model, then whatever's first
		const reasoning = models.find((m) => m.supportsReasoning);
		const pick = reasoning ?? models[0];
		if (pick) {
			this.agent.setModel({ id: pick.id, provider: pick.provider });
		}
	}

	/** Notify all event listeners */
	private notifyListeners(event: AgentEvent): void {
		for (const fn of this.listeners) {
			fn(event);
		}
	}
}