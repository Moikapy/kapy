# ARCHITECTURE.md — Kapy

## System Overview

Kapy is an extensible CLI framework — a meta-CLI that does nothing until you install extensions, and a library you can embed to build your own extensible CLI. One runtime powers both modes.

```
┌──────────────────────────────────────────────┐
│                 kapy runtime                  │
│                                              │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  │
│  │  Config   │  │ Command  │  │ Extension │  │
│  │  System   │  │ Registry │  │  Loader   │  │
│  └────┬─────┘  └────┬─────┘  └─────┬─────┘  │
│       │              │              │        │
│       └──────────────┼──────────────┘        │
│                      │                       │
│              ┌───────┴───────┐               │
│              │  Middleware   │               │
│              │   Pipeline    │               │
│              └───────┬───────┘               │
│                      │                       │
│              ┌───────┴───────┐               │
│              │  Hook System  │               │
│              └───────┬───────┘               │
│                      │                       │
│              ┌───────┴───────┐               │
│              │  Command      │               │
│              │  Handler      │               │
│              └───────────────┘               │
│                                              │
│  ┌──────────────────────────────────────┐    │
│  │          kapy tui (OpenTUI)          │    │
│  │  ┌─────────┬────────────┬──────────┐ │    │
│  │  │ Sidebar │ Main Area  │ Status   │ │    │
│  │  └─────────┴────────────┴──────────┘ │    │
│  └──────────────────────────────────────┘    │
└──────────────────────────────────────────────┘
         │                    │
    ┌────┴─────┐      ┌──────┴──────┐
    │   kapy-   │      │@opentui/core│
    │components│      └─────────────┘
    └──────────┘
```

## Execution Flow

```
CLI invocation
    │
    ▼
Parse args/flags (custom parser, `:` subcommand convention)
    │
    ▼
Load config hierarchy
 (defaults → kapy.config.ts → ~/.kapy/config.json → env → flags)
    │
    ▼
Load extensions (from config, resolve deps)
    │
    ▼
Build middleware stack (registration order)
    │
    ▼
Execute middleware (outermost → innermost, each calls next())
    │
    ├─ before:command hooks (extension load order)
    ├─ before:<name> hooks
    ├─ Command handler
    ├─ after:<name> hooks
    └─ after:command hooks
    │
    ▼
Middleware unwinds (post-next() in reverse order)
    │
    ▼
Output result (styled text or JSON if --json)
```

If middleware short-circuits (no `next()`), nothing runs. If a `before` hook calls `ctx.abort()`, command and remaining `before` hooks are skipped, `after` hooks run with `ctx.aborted = true`.

## Extension Architecture

```
┌─────────────────────────────────────┐
│         Extension Package            │
│                                     │
│  package.json (keyword: kapy-ext)   │
│  src/index.ts                       │
│    ├─ register(api) → void|dispose  │
│    └─ meta: { name, version, deps } │
│                                     │
│  Uses KapyExtensionAPI:            │
│    addCommand()                     │
│    addHook()                        │
│    addMiddleware()                  │
│    declareConfig()                  │
│    addScreen()                      │
│    emit() / on()                    │
└─────────────────────────────────────┘
```

Extension loading:
1. Read `kapy.config.ts` extensions list
2. Resolve dependency order from `meta.dependencies`
3. Load each extension's `register()` async
4. If `register()` throws → skip extension, warn, continue
5. If duplicate command → warn, last-loaded wins
6. Dispose functions called on extension unload

Install sources: `npm:@scope/pkg@version`, `git:github.com/user/repo@tag`, `./local-path`

## Config Architecture

```
┌─────────────────────────────────────────────────┐
│                   Merge Order                    │
│                                                 │
│  kapy defaults                                  │
│       ▼                                         │
│  kapy.config.ts  (project, TypeScript, logic)   │
│       ▼                                         │
│  ~/.kapy/config.json  (global, machine-managed) │
│       ▼                                         │
│  env vars (KAPY_ prefix, configurable)          │
│       ▼                                         │
│  CLI flags                                      │
└─────────────────────────────────────────────────┘
```

Extension config is namespaced automatically:
```ts
// Extension declares:
api.declareConfig({ region: { type: "string", default: "us-east-1" } })

// Accessed as:
ctx.config["deploy-aws"].region  // auto-namespaced
```

## TUI Architecture

`kapy tui` launches the OpenTUI shell. Extensions register screens via `api.addScreen()`.

```
kapy tui ──► OpenTUI renderer init
              │
              ├─ Sidebar: screens from extensions + built-ins
              │   (Home, Extensions, Config, Terminal)
              │
              ├─ Main area: active screen's render() output
              │
              └─ Status bar: context + key hints
```

TUI is unavailable when `--json` or `--no-input` is set — ensures AI agent compatibility.

## Package Dependency Graph

```
create-kapy (scaffolding only, no runtime)
kapy ──depends on──► kapy-components ──depends on──► @opentui/core
  │
  └─re-exports kapy-components (so extensions can import from either)
```

## AI Agent Interface

```
┌──────────────────────────────────────────┐
│           Agent Interaction              │
│                                          │
│  kapy commands --json                    │
│  kapy inspect --json                     │
│  kapy help <cmd> --json                  │
│  kapy <cmd> --json --no-input           │
│                                          │
│  Output: structured JSON                 │
│  Exit codes: 0-5, 10 (structured)        │
│  agentHints: per-command metadata        │
└──────────────────────────────────────────┘
```

## Security Model (MVP)

- Extensions run in-process (no sandbox)
- `kapy install` shows trust prompt (name, source, what it registers)
- `--trust` flag skips prompt for CI
- Future: `meta.permissions` declaration + Bun sandboxing