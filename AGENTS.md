# AGENTS.md — Kapy Project Guide for AI Agents

## Project

**Kapy** — the pi.dev for CLI. An extensible CLI framework with first-class support for extensions, hooks, middleware, and a built-in TUI.

## Architecture

Monorepo with three packages:

```
packages/
├── kapy/                  # Runtime + CLI bin + TUI shell
├── kapy-components/       # UI components on @opentui/core
└── create-kapy/           # Scaffolding template (bun create)
```

- **kapy**: CLI entry point, command registry, hooks, middleware, extension loader, config, TUI shell
- **kapy-components**: Reusable UI components (Box, Text, Input, Select, ScrollBox, Code, Diff, Spinner)
- **create-kapy**: Project scaffolding only, not a runtime dependency

Dependency flow: `kapy → kapy-components → @opentui/core`. Kapy re-exports kapy-components.

## Tech Stack

- **Language**: TypeScript
- **Runtime**: Bun (primary), Node.js compatible
- **Build**: Bun native bundler
- **Test**: Bun test runner (`bun test`)
- **Lint**: Biome
- **Color**: picocolors
- **TUI**: @opentui/core (via kapy-components)
- **Package manager**: Bun

## Key Design Decisions

1. **`:` separator for subcommands** — flat registry, no nested routing tree. `deploy:aws` not `deploy aws`.
2. **Extensions as npm packages** — `kapy-extension` keyword, `register()` + `meta` exports.
3. **Config hierarchy**: `kapy defaults → kapy.config.ts → ~/.kapy/config.json → env vars → CLI flags`
4. **Extensions run in-process** — no sandboxing for MVP. Future: Bun sandboxing + permissions.
5. **AI agent support** — all commands support `--json` and `--no-input`. Exit codes are structured. `agentHints` metadata on commands.
6. **TUI via OpenTUI** — `kapy tui` launches interactive shell. Extensions register screens via `api.addScreen()`.

## Command System

- Commands use `ctx` object: `ctx.args`, `ctx.config`, `ctx.log/warn/error`, `ctx.spinner`, `ctx.prompt`, `ctx.abort()`
- `--json` and `--no-input` injected automatically
- Nested commands use `:` separator (e.g., `deploy:aws`)

## Extension API

```ts
KapyExtensionAPI:
  addCommand(definition, handler)
  addHook(event, handler)
  addMiddleware(middleware)
  declareConfig(schema)
  addScreen(screenDefinition)
  emit(event, data?)
  on(event, handler)
```

Extension structure: npm package with `kapy-extension` keyword, exports `register()` and `meta`.

## Config System

- Project config: `kapy.config.ts` (TypeScript, may contain logic)
- Global config: `~/.kapy/config.json` (machine-managed, no TS runtime)
- Env prefix: defaults to `KAPY_`, configurable via `defineConfig({ envPrefix })`

## File Conventions

- `.kapy/` — local extension config + installed extensions (gitignored)
- `~/.kapy/` — global config + extensions
- `.pi/` — pi agent sessions (gitignored)
- `.pi/hf-sessions/` — pi-share-hf workspace (gitignored)

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

## MVP Scope

In scope: command registry, hooks, middleware, extension loader, config system, CLI bin, TUI shell, AI agent flags, exit codes, scaffolding, example extension.

Out of scope: `kapy search`, custom themes, RPC/SDK modes, sandboxed extensions, permissions enforcement.