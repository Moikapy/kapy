# AGENTS.md — Kapy Project Guide for AI Agents

## Project

**Kapy** — the extensible CLI framework. Commands, hooks, middleware, extensions — everything snaps together.

## Architecture

Monorepo with one package:

```
packages/
└── kapy/                  # Runtime + CLI bin
```

- **kapy**: CLI entry point, command registry, hooks, middleware, extension loader, config, scaffolding (`kapy init`)

## Tech Stack

- **Language**: TypeScript
- **Runtime**: Bun (primary), Node.js compatible
- **Build**: Bun native bundler
- **Test**: Bun test runner (`bun test`)
- **Lint**: Biome
- **Color**: picocolors
- **Package manager**: Bun

## Key Design Decisions

1. **`:` separator for subcommands** — flat registry, no nested routing tree. `deploy:aws` not `deploy aws`.
2. **Extensions as npm packages** — `kapy-extension` keyword, `register()` + `meta` exports.
3. **Config hierarchy**: `kapy defaults → kapy.config.ts → ~/.kapy/config.json → env vars → CLI flags`
4. **Extensions run in-process** — no sandboxing for MVP. Future: Bun sandboxing + permissions.
5. **AI agent support** — all commands support `--json` and `--no-input`. Exit codes are structured. `agentHints` metadata on commands.

## Command System

- Commands use `ctx` object: `ctx.args`, `ctx.config`, `ctx.log/warn/error`, `ctx.spinner`, `ctx.prompt`, `ctx.abort()`, `ctx.spawn()`, `ctx.teardown()`, `ctx.exitCode`, `ctx.isInteractive`
- `--json` and `--no-input` injected automatically
- Nested commands use `:` separator (e.g., `deploy:aws`)

### Process-Aware ctx API (v0.2.0+)

- **`ctx.spawn(cmd, opts?)`** — Subprocess helper with TTY passthrough, abort integration, and output control
  - `tty: true` — pass through stdin/stdout/stderr for interactive processes
  - `stream: true` — real-time output instead of buffering
  - `env` / `cwd` — custom environment and working directory
  - `abortOnError` — auto-kill process on `ctx.abort()`, registers teardown
  - `suppressOutput` — control stdout/stderr in `--json` mode
  - Returns `{ exitCode, stdout, stderr, aborted }`
- **`ctx.isInteractive`** — computed getter: `!noInput && !json && !!process.stdout.isTTY`
- **`ctx.exitCode`** — writable exit code. User-set takes priority over abort code.
- **`ctx.teardown(fn)`** — register cleanup callbacks (LIFO, async-safe, error-resilient)
- **`ctx.runTeardowns()`** — called by CLI runner after command execution (success or error)

## Extension API

```ts
KapyExtensionAPI:
  addCommand(definition, handler)
  addHook(event, handler)
  addMiddleware(middleware)
  declareConfig(schema)
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

## Scope

In scope: command registry, hooks, middleware, extension loader, config system, CLI bin, AI agent flags, exit codes, scaffolding, example extension.

Out of scope: AI agent loop, TUI, custom themes, RPC/SDK modes, sandboxed extensions, permissions enforcement.