# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-04-13

### Added

**CommandContext — Process-Aware Extensions**
- `ctx.spawn(cmd, opts?)` — blessed subprocess helper using Bun.spawn
  - `tty: true` passes through stdin/stdout/stderr for interactive processes (tmux, shells)
  - `stream: true` outputs in real-time instead of buffering
  - `env` merges custom env vars with `process.env`
  - `cwd` sets working directory
  - `abortOnError` auto-kills process via abort signal + teardown registration
  - `suppressOutput` controls output behavior in `--json` mode
  - Returns `{ exitCode, stdout, stderr, aborted }`
- `ctx.isInteractive` — computed getter: `!noInput && !json && !!process.stdout.isTTY`
- `ctx.exitCode` — writable property for exit code propagation, user-set priority over abort code
- `ctx.teardown(fn)` — register cleanup callbacks (LIFO order, async-safe, error-resilient)
- `ctx.runTeardowns()` — called by CLI runner after command execution (success or error)
- CLI runner propagates `ctx.exitCode` via `process.exit()` if non-zero
- CLI runner catches `AbortError` at top level and exits with abort code

### Changed

- `CommandContext._exitCode` split into `_userExitCode` (explicit setter) and `_abortExitCode` (from abort)
- `CommandContext` no longer has a single `_exitCode` field — `exitCode` getter returns `_userExitCode ?? _abortExitCode`

## [0.1.0] - 2025-04-12

### Added

**Core Framework**
- Extensible CLI framework with command registry, hooks, middleware, and config system
- `kapy()` builder API for embedded mode
- `:` separator convention for subcommands (`deploy:aws`)
- Hierarchical config: kapy defaults → `kapy.config.ts` → `~/.kapy/config.json` → env vars → CLI flags
- `defineConfig()` for TypeScript project config
- Structured exit codes (0 success, 1 error, 2 invalid args, 3 extension error, 4 config error, 5 network, 10 abort)
- AI agent compatibility: `--json` and `--no-input` on all commands, `agentHints` metadata, `kapy commands --json` and `kapy inspect --json`

**Extension System**
- Extension loader with npm/git/local path support
- `KapyExtensionAPI` surface: `addCommand`, `addHook`, `addMiddleware`, `declareConfig`, `addScreen`, `emit`, `on`
- `on:load`, `on:extension:loaded`, `on:error`, `before:command`, `after:command`, `before:<name>`, `after:<name>` lifecycle hooks
- Topological dependency ordering for extensions
- `meta.permissions` declaration (documentation-only for MVP)
- Trust prompt on first install with `--trust` flag for CI

**Built-in Commands**
- `kapy init <name>` — scaffold new project
- `kapy install <source>` — install from npm/git/local with SHA-512 checksum
- `kapy list` — show installed extensions
- `kapy update [name]` — update extensions
- `kapy remove <name>` — uninstall extension
- `kapy upgrade` — upgrade kapy runtime
- `kapy config` — view/edit config (get/set/list)
- `kapy dev` — hot reload on file changes
- `kapy commands` — list all commands with `--json`
- `kapy inspect` — dump full state with `--json`
- `kapy tui` — interactive terminal UI
- `kapy help <command>` — detailed per-command help with agentHints

**TUI (kapy tui)**
- OpenTUI-based interactive shell with sidebar navigation
- Built-in screens: Home, Extensions, Config, Terminal (all with live data)
- Extension screen registration via `api.addScreen()`
- Home screen shows installed extension count
- Extensions screen reads from `~/.kapy/extensions.json`
- Config screen reads project and global configs

**kapy-components**
- Declarative component API: `Box({..}, Text({..}), ...)` returning `ComponentDescriptor`
- Imperative API: `createBox(renderer, {..})`, `createText(renderer, {..})`, etc.
- Components: Box, Text, Input, Select, ScrollBox, Code, Diff, Spinner, Banner, Sidebar, StatusBar
- Hooks: `useFocus`, `useInput`

**Middleware**
- Built-in: `kapy/middleware/logging`, `kapy/middleware/timing`, `kapy/middleware/error-handler`
- Subpath exports for explicit imports
- Composable middleware pipeline with `next()` pattern

**Scaffolding**
- `kapy init <name>` — built-in project scaffold (replaces create-kapy)
- Generates `kapy.config.ts`, `.kapy/`, `src/index.ts`, example command, `.gitignore`, `tsconfig.json`
- `--template` flag for extension template

**Documentation**
- README with quickstart guide
- SPEC.md with full specification

### Infrastructure
- `~/.kapy/cache/` directory support with `ensureKapyDirs()`
- `KAPY_HOME`, `EXTENSIONS_DIR`, `CACHE_DIR` exported constants
- Type declarations generated for both packages
- Build system: `bun build` + `tsc --emitDeclarationOnly` for kapy and kapy-components