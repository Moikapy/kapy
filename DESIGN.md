# DESIGN.md — Kapy

## Overview

Kapy's design follows one principle: **the runtime is empty until you fill it.** Like pi for coding agents, kapy for CLI tools — a minimal core that gains power through extensions. No commands, no opinions, no UI until you install or define them.

## 1. Design Philosophy

### Empty-by-default
The standalone `kapy` binary ships six meta-commands (`install`, `list`, `update`, `remove`, `config`, `dev`). Everything else comes from extensions. This forces the core to stay small and the extension API to stay complete — if a feature can be an extension, it should be.

### Two modes, one runtime
Standalone mode and embedded mode share identical code paths. `kapy()` returns the same builder whether you're running `kapy deploy:aws` or building `my-cli`. The only difference is who registers the first commands.

### `:` convention over nesting
`deploy:aws` instead of `deploy aws`. Flat registry, simple routing, no ambiguity with positional args. Extensions add `deploy:aws` without touching the `deploy` parent. Running `deploy` without a subcommand shows help for all `deploy:*` commands.

### Agent-first, human-friendly
Every command supports `--json` and `--no-input`. Exit codes are structured. `agentHints` give machines context without humans reading docs. The TUI is unavailable via `--json`/`--no-input` — agents never accidentally open an interactive shell.

### Bunt-first
Bun provides runtime, bundler, test runner, and package manager. No tsup, no turbo, no vitest, no separate tool config. Extensions load as ESM via Bun's native TypeScript support. Node.js compatibility is maintained where it doesn't compromise Bun's advantages.

## 2. Command Design

### Context object
Every handler receives `ctx` — not raw args, not a framework-specific request object, just a flat interface:

| | Purpose |
|---|---|
| `ctx.args` | Parsed args + flags |
| `ctx.config` | Merged config (all sources) |
| `ctx.command` | Command name |
| `ctx.log/warn/error` | Styled output |
| `ctx.spinner()` | Progress indicator |
| `ctx.prompt()` | Interactive input |
| `ctx.abort()` | Cancel execution |

No inheritance chains. No middleware-specific request mutation. `ctx` is the contract.

### Automatic flags
`--json` and `--no-input` are injected by the runtime. Extensions never declare them. This guarantees every command is scriptable without the extension author doing anything.

## 3. Extension Design

### Minimal contract
Two exports: `register(api)` and `meta`. That's it. `register` is async (for network/db setup). May return a dispose function. `meta` declares name, version, and dependencies.

### Namespace by convention
Extensions are encouraged to namespace commands with their package scope: `@foo/kapy-deploy` registers `deploy:foo`, not `deploy`. If two extensions register the same command, last-loaded wins (with a warning).

### Config as declaration
Extensions don't read config — they declare a schema and kapy serves namespaced values. `api.declareConfig({ region: { ... } })` becomes `ctx.config["deploy-aws"].region`. No key collisions between extensions.

## 4. Middleware vs Hooks

**Hooks** are side effects: `before:deploy`, `after:command`, `on:error`. They can abort but not transform the flow.

**Middleware** wraps the entire execution: can modify `ctx.args` before `next()`, transform output after, short-circuit, or catch errors. Like Express middleware but for CLI commands.

Execution order:
1. Middleware stack (outermost → innermost)
2. `before:command` hooks (extension load order)
3. `before:<name>` hooks
4. Command handler
5. `after:<name>` hooks
6. `after:command` hooks
7. Middleware unwinds (reverse order)

If middleware doesn't call `next()`, nothing runs. If a before hook calls `ctx.abort()`, the command is skipped and after hooks run with `ctx.aborted = true`.

## 5. Config Design

### Hierarchy
```
defaults → kapy.config.ts → ~/.kapy/config.json → env vars → CLI flags
```

Each source overrides the previous. Project config is TypeScript (may contain logic). Global config is JSON (machine-managed, no TS runtime needed).

### Env prefix
Default `KAPY_`, configurable to anything via `defineConfig({ envPrefix })`. Embedded CLIs get their own prefix.

## 6. TUI Design

### When and why
CLI commands handle 90% of workflows. The TUI (`kapy tui`) is for interactive workflows that benefit from persistent layout: dashboards, logs, multi-panel views.

### Layout
```
┌─────────┬──────────────────────────────┐
│ Sidebar │         Main Area            │
│         │                              │
│ 📊 Home │   [Active screen content]    │
│ 📦 Ext  │                              │
│ 🔧 Conf │                              │
│ ⚡ Term │                              │
│         │                              │
├─────────┴──────────────────────────────┤
│ Status Bar: extension info / key hints │
└─────────────────────────────────────────┘
```

Extensions register screens. Built-in screens: Home, Extensions, Config, Terminal. Navigation via sidebar. Keyboard-driven (`q` to quit, screen-specific keybindings).

### Components live separately
`kapy-components` is its own package depending on `@opentui/core`. `kapy` re-exports it. CLI-only extensions depend only on `kapy`. TUI extensions can add `kapy-components` for cleaner deps.

## 7. Security Design

### MVP: trust prompts
`kapy install` shows what the extension wants to register before proceeding. `--trust` skips for CI.

### Future: permissions + sandboxing
`meta.permissions` will declare what an extension needs (`fs:read`, `net`, etc.). Bun sandboxing will enforce at runtime. Both are documentation-only for MVP.

## 8. Distribution Design

### Three install sources
- **npm**: `npm:@scope/kapy-ext@^1.0.0`
- **git**: `git:github.com/user/repo@v2`
- **local**: `./path/to/ext` (dev mode)

### Dev mode
`kapy dev` watches extension source files. On change, kapy exits and re-spawns itself (not in-process HMR). Simpler and more reliable.

### Scaffolding
`kapy init my-cli` creates a project with `kapy.config.ts`, sample command, and extension structure. `--template` flag adds more examples.

## 9. Design Decisions Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Subcommand separator | `:` (colon) | Flat registry, no arg ambiguity, extension-friendly |
| Config format (project) | TypeScript | May contain logic (conditionals, imports) |
| Config format (global) | JSON | Machine-managed, no TS runtime in `~/.kapy/` |
| Middleware model | Express-style `next()` | Familiar, composable, can transform in/out |
| Extension loading | In-process, synchronous order | Simple for MVP. Sandbox future work |
| TUI framework | @opentui/core | Already selected, fits the component model |
| Dev mode | Process restart on change | Simpler than HMR, more reliable |
| Agent interface | `--json` + `--no-input` | Every command is scriptable by default |
| Package runtime | Bun | Single tool for runtime, bundler, test, package manager |