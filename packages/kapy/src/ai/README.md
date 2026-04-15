# AI Module

The production AI harness — session management, agent loop, provider abstraction, permission system, and tool registry.

## Status: ACTIVE — wired to TUI via `use-chat.ts`

The TUI uses `ChatSession` as its single source of truth for:
- Agent loop (LLM ↔ tool execution cycle)
- Provider streaming (Ollama adapter with tool_calls + reasoning support)
- Slash commands (via `processSlashCommand`)
- Tool registry (built-in tools registered at init)
- Permission evaluation (event-driven, ADR-012)
- Context tracking (token counting, compaction)

## Architecture

```
TUI (app.tsx)
  └─ use-chat.ts (Solid signal bridge)
       └─ ChatSession (glue layer)
            ├─ KapyAgent (state, events, steering)
            ├─ AgentLoop (LLM ↔ tool cycle)
            ├─ ProviderRegistry + OllamaAdapter
            ├─ ToolRegistry
            ├─ PermissionEvaluator
            ├─ SessionManager
            └─ ContextTracker
```

## Key Files

| File | Purpose |
|------|---------|
| `chat-session.ts` | TUI-facing API: `send()`, `abort()`, event subscription |
| `agent-loop.ts` | Turn-by-turn LLM cycle with tool execution |
| `agent/agent.ts` | Agent state, events, steering/followUp queues |
| `agent/types.ts` | ThinkingLevel, AgentEvent, AgentMessage types |
| `provider/ollama.ts` | Ollama adapter (OpenAI-compatible SSE streaming) |
| `provider/registry.ts` | Multi-provider registry |
| `provider/types.ts` | ProviderAdapter, StreamChunk, ChatMessage interfaces |
| `permission/evaluator.ts` | Event-driven permission evaluation |
| `session/manager.ts` | Tree-structured message persistence |
| `memory.ts` | Conversation memory |
| `context-tracker.ts` | Token counting, context window tracking |
| `slash-commands.ts` | /help, /model, /agent, /compact, /clear, etc. |
| `call-tool.ts` | Tool execution with permission checks |
| `schema.ts` | Zod-to-JSON-Schema for tool parameters |

## Provider Support

- **Ollama** (primary) — auto-detect, model listing, streaming with tool_calls + reasoning_content
- **OpenAI** — adapter ready, needs API key config
- **Anthropic** — adapter ready, needs API key config

## Event Flow

```
ChatSession.send(input)
  → AgentLoop.prompt(input)
    → ProviderAdapter.streamChat()
      → SSE chunks → AgentEvent (message_update, reasoning_update, tool_call)
    → Tool execution → tool_result events
    → Repeat until no tool calls or max rounds
  → AgentEvent (agent_end)
```

TUI subscribes via `session.onEvent()` → `use-chat.ts` maps events to Solid signals → reactive render.

## All 308 unit tests pass.