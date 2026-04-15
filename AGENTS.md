# AGENTS.md — Kapy Project Guide for AI Agents

## Project

**Kapy** — the agent-first CLI framework. Build AI tools from the terminal. Commands, hooks, middleware, TUI — everything snaps together.

## Architecture

Monorepo with four packages:

```
packages/
├── kapy/                  # Runtime + CLI bin + TUI shell
├── kapy-ai/               # Unified LLM API (forked from @mariozechner/pi-ai)
├── kapy-agent/             # Agent runtime (forked from @mariozechner/pi-agent-core)
└── kapy-components/        # UI components on @opentui/core
```

Dependency flow: `kapy → kapy-agent → kapy-ai`. Kapy re-exports both + kapy-components.

### Package Overview

- **kapy**: CLI entry point, command registry, hooks, middleware, extension loader, config, TUI shell, scaffolding (`kapy init`)
- **kapy-ai**: Unified LLM API with 10+ provider adapters (Anthropic, OpenAI, Google, Mistral, Bedrock, etc.) + streaming + model registry. MIT license, forked from pi-mono with attribution.
- **kapy-agent**: Production agent runtime — state machine, parallel tool execution, steering/followUp queues, beforeToolCall/afterToolCall hooks, convertToLlm bridge. MIT license, forked from pi-mono with attribution.
- **kapy-components**: Reusable UI components (Box, Text, Input, Select, ScrollBox, Code, Diff, Spinner)

### How Kapy Integrates

Kapy doesn't run its own agent loop. It wires its harness layers into `@moikapy/kapy-agent`'s hooks:

- **Ollama** → `registerModel()` at runtime + `baseUrl` with `/v1` suffix
- **Tool bridge** → `kapyToolToAgentTool()` converts Zod schemas to TypeBox
- **Context compaction** → `transformContext` hook (via ContextTracker)
- **Session persistence** → JSONL tree (SessionManager)
- **Permission gating** → Available via `PermissionEvaluator` + `api.addBeforeToolCall()` in extensions, but NOT enforced by default. Tools run freely like pi.

## Tech Stack

- **Language**: TypeScript
- **Runtime**: Bun (primary), Node.js compatible
- **Build**: Bun native bundler (kapy), tsc (kapy-ai, kapy-agent)
- **Test**: Bun test runner (`bun test`)
- **Lint**: Biome
- **Color**: picocolors
- **TUI**: @opentui/core (via kapy-components)
- **Package manager**: Bun

## Key Design Decisions

1. **`:` separator for subcommands** — flat registry, no nested routing tree. `deploy:aws` not `deploy aws`.
2. **Extensions as npm packages** — `kapy-extension` keyword, `register()` + `meta` exports.
3. **Config hierarchy**: `kapy defaults → kapy.config.ts → ~/.kapy/config.json → env vars → CLI flags`
4. **Forked agent core** — pi-mono's ai and agent packages forked as kapy-ai/kapy-agent. Kapy adds the harness (sessions, Ollama, context).
5. **Agent hooks over reimplementing** — extensions can add `beforeToolCall` hooks for permission gating, compaction via `transformContext`, tools via `AgentTool[]`.
6. **No permission gating by default** — tools execute freely like pi. Extensions can add permission gating via `api.addBeforeToolCall()`.
6. **AI agent support** — all commands support `--json` and `--no-input`. Exit codes are structured.
7. **TUI via OpenTUI** — `kapy tui` launches interactive shell. Extensions register screens via `api.addScreen()`.

## Command System

- Commands use `ctx` object: `ctx.args`, `ctx.config`, `ctx.log/warn/error`, `ctx.spinner`, `ctx.prompt`, `ctx.abort()`, `ctx.spawn()`, `ctx.teardown()`, `ctx.exitCode`, `ctx.isInteractive`
- `--json` and `--no-input` injected automatically
- Nested commands use `:` separator (e.g., `deploy:aws`)

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Invalid arguments / unknown command |
| 3 | Extension error |
| 4 | Config error |
| 5 | Network error |
| 10 | Aborted by hook/middleware |