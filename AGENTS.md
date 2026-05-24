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

## Codebase Wiki

This project has an auto-maintained knowledge base at `.codebase-wiki/`.

**Always consult the wiki first** before grepping source files for conceptual questions — architecture decisions, design patterns, module relationships, and evolution are already documented there.

- **`wiki_query`** — search the wiki for any concept, decision, or module
- **`wiki_ingest`** — update the wiki after making code changes (use `commits` for recent work, `smart` for richer enrichment)
- **`wiki_lint`** — run periodically to find stale pages, broken links, and contradictions
- **`wiki_entity`** — document a new module or service
- **`wiki_decision`** — record an architecture decision (ADR)
- **`wiki_concept`** — document a cross-cutting pattern

After any meaningful code change (new feature, refactor, ADR-worthy decision), run `wiki_ingest` to keep the wiki current. The wiki is the shared memory between sessions — if it's not in the wiki, the next session starts blind.

## Context-Mode & MCP

### Context-Mode MCP Server (mandatory)

Context-mode is registered as an MCP server and provides sandboxed execution, FTS5 indexing, and context-preserving data workflows. Always use these tools instead of raw bash for data-heavy operations.

**Available tools** (via `mcp_context-mode_*` prefix):

| Tool | Purpose |
|------|---------|
| `ctx_execute` | Run commands in sandbox; output enters context minimally |
| `ctx_execute_file` | Load & analyze a file in sandbox (FILE_CONTENT pre-loaded) |
| `ctx_index` | Index a file server-side into FTS5 (use `path:`, not `content:`) |
| `ctx_search` | BM25 search over indexed content (batch queries in one call) |
| `ctx_fetch_and_index` | Fetch URL → index → search (for docs/API refs) |
| `ctx_batch_execute` | Run multiple commands in one call |
| `ctx_stats` | Show context-mode usage statistics |
| `ctx_doctor` | Diagnose context-mode setup issues |
| `ctx_upgrade` | Update context-mode from GitHub |
| `ctx_purge` | Wipe all indexed KB content |
| `ctx_insight` | Open analytics dashboard |

### Routing Rules ( Mandatory)

**Default to context-mode for ALL read/query/analyze operations.** Only use raw Bash for the whitelist below.

**Bash whitelist** (safe to run directly):
- File mutations: `mkdir`, `mv`, `cp`, `rm`, `touch`, `chmod`
- Git writes: `git add`, `git commit`, `git push`, `git checkout`, `git branch`, `git merge`
- Navigation: `cd`, `pwd`, `which`
- Process control: `kill`, `pkill`
- Package management: `npm install`, `npm publish`, `pip install`, `bun install`
- Simple output: `echo`, `printf`

**Everything else → `ctx_execute` or `ctx_execute_file`.** This includes:
- Reading/analyzing files → `ctx_execute_file`
- API calls → `ctx_execute` (use `fetch()` in JS mode)
- Test runs, build output → `ctx_execute`
- Git log/diff → `ctx_execute`
- Docker/kubectl/gh queries → `ctx_execute`
- Browser snapshots → `browser_snapshot(filename)` → `ctx_index(path)` or `ctx_execute_file(path)`

### Never Do

- `cat large-file.json` → use `ctx_execute_file`
- `curl http://api/endpoint` → use `ctx_execute` with `fetch()`
- `npm test` via raw bash → use `ctx_execute`
- `browser_snapshot()` without `filename` → always use `filename` param
- `ctx_index(content: large_data)` → always use `ctx_index(path: ...)`

### Config

```yaml
# ~/.hermes/config.yaml
mcp_servers:
  context-mode:
    command: context-mode
```

### Other MCP Servers

| Server | Transport | Purpose |
|--------|-----------|---------|
| context-mode | stdio: `context-mode` | Context window management, sandbox, FTS5 |

Additional servers can be added via `hermes mcp add` or by editing `~/.hermes/config.yaml` directly under `mcp_servers`.

## Scope

In scope: command registry, hooks, middleware, extension loader, config system, CLI bin, AI agent flags, exit codes, scaffolding, example extension.

Out of scope: AI agent loop, TUI, custom themes, RPC/SDK modes, sandboxed extensions, permissions enforcement.

## Task Documentation Protocol (Mandatory)

Every task — feature, bug, refactor, research cycle — must leave traces in three places before being claimed complete.

### 1. Kanban Board (`hermes kanban`)
- Create or update a Kanban card **before** starting implementation.
- Card title = concise verb phrase ("Build X", "Fix Y in Z").
- Card body = success criteria (3–5 bullet checkboxes).
- Update status as you go: `backlog` → `ready` → `in_progress` → `done`.
- Link parent/child cards for multi-phase work.

### 2. kapy-wiki (`WIKI_PATH=~/wiki`)
- Domain knowledge, research findings, API specs, architecture decisions → wiki entity/concept pages.
- Raw sources ingested via `kapy-wiki ingest`.
- Tags used consistently: `youtube-worthy`, `video-pipeline`, `market`, `contested`, `ai-tools`, `desk-toy`, `maker-culture`, `ecommerce`, `content-strategy`.
- Run `kapy-wiki lint` after bulk ingest to catch stale links and tag drift.

### 3. Reviewer Skills (load before claiming done)
Load the appropriate reviewer skill and run its checklist:

| Phase | Skill to load |
|-------|---------------|
| Dashboard plugin build | `kapy-research-plugin-reviewer` |
| CLI command / pipeline logic | `kapy-research-pipeline-reviewer` |
| Pre-flight / bug hunt / final QA | `kapy-research-qa-tester` |

**No task is "done" until the relevant reviewer checklist passes.** This applies to kapy-research work and any analogous pipeline/plugin work in other extensions.

### Exception
- Hotfixes (production down) may skip Kanban creation if the fix is <5 min, but must be backfilled with a card + retro wiki note within 24 h.