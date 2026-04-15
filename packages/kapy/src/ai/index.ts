/**
 * kapy AI module — re-exports from @moikapy/kapy-ai, @moikapy/kapy-agent + kapy-specific layers.
 *
 * Re-exports from the forked packages:
 * - @moikapy/kapy-ai: unified LLM API, providers, models, streaming
 * - @moikapy/kapy-agent: agent state machine, loop, tool execution, events
 *
 * Kapy-specific layers:
 * - Permission system (beforeToolCall integration)
 * - Session persistence (JSONL tree)
 * - Context compaction (transformContext integration)
 * - Ollama auto-detect (local provider adapter)
 * - Memory store
 * - Slash commands
 */

// ── Re-export from forked packages ─────────────────────────────────

export type {
	AfterToolCallContext,
	AfterToolCallResult,
	AgentEvent,
	AgentLoopConfig,
	AgentMessage,
	AgentState,
	AgentTool,
	BeforeToolCallContext,
	BeforeToolCallResult,
	StreamFn,
	ToolExecutionMode,
} from "@moikapy/kapy-agent";
export { Agent } from "@moikapy/kapy-agent";

export {
	type AssistantMessage,
	type AssistantMessageEvent,
	type Context,
	type EventStream,
	getAllModels,
	getAllProviders,
	getModel,
	type Message,
	type Model,
	registerApiProvider,
	registerModel,
	registerModels,
	type SimpleStreamOptions,
	streamSimple,
	type ThinkingBudgets,
	type ToolCall,
	type ToolResultMessage,
	validateToolArguments,
} from "@moikapy/kapy-ai";

// ── Kapy-specific modules ──────────────────────────────────────────

export { callTool } from "./call-tool.js";
export { kapyToolToAgentTool, kapyToolsToAgentTools } from "./tool-bridge.js";
export type { ChatMessage, ChatSessionOptions } from "./chat-session.js";
export { ChatSession } from "./chat-session.js";
export type { ContextMessage, ContextUsage } from "./context-tracker.js";
export { ContextTracker } from "./context-tracker.js";
export type { MemoryEntry, MemoryScope } from "./memory.js";
export { MemoryStore } from "./memory.js";
export { PermissionEvaluator } from "./permission/evaluator.js";
export type { PermissionAction, PermissionCheck, PermissionRule } from "./permission/types.js";
export type {
	OllamaChatMessage,
	OllamaChatOptions,
	OllamaModelInfo,
	OllamaStreamChunk,
	OllamaTokenUsage,
} from "./provider/ollama.js";
export { OllamaAdapter } from "./provider/ollama.js";
export { buildRegistrySchema } from "./schema.js";
export { SessionManager } from "./session/manager.js";
export type { AppendMessageOptions, SessionEntry } from "./session/types.js";
export type { SlashCommandContext, SlashCommandDefinition, SlashCommandProvider } from "./slash-commands.js";
export { createBuiltinSlashCommands, processSlashCommand } from "./slash-commands.js";
