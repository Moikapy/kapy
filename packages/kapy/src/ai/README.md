# AI Module

This is the **spec'd AI harness architecture** — session management, agent loop, provider abstraction, permission system, and tool registry.

## Status: Spec-only (not yet wired to TUI)

The TUI currently uses `src/tui/ollama-client.ts` for direct Ollama streaming. This module provides the proper architecture that will replace it:

- `provider/` — Provider abstraction (Ollama, OpenAI, Anthropic adapters)
- `agent/` — Named agents with configuration
- `agent-loop.ts` — Turn-by-turn agent execution loop
- `chat-session.ts` — Chat session with message history
- `permission/` — Event-driven permission evaluation (ADR-012)
- `session/` — Session persistence and management
- `memory.ts` — Conversation memory and context window management
- `context-tracker.ts` — Token counting and context window tracking
- `slash-commands.ts` — AI-specific slash commands (/model, /clear, etc.)
- `call-tool.ts` — Tool execution with permission checks
- `schema.ts` — Zod schema utilities for tool parameters

## Wiring Plan

When `ai/` is fully integrated:
1. `ollama-client.ts` → delegates to `ai/chat-session.ts` + `ai/agent-loop.ts`
2. `tui/commands.ts` slash commands → delegates to `ai/slash-commands.ts`
3. Provider selection → uses `ai/provider/registry.ts`
4. Tool execution → uses `ai/call-tool.ts` with permission checks
5. Session persistence → uses `ai/session/manager.ts`

All 308 unit tests pass.