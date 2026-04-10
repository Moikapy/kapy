# Kapy — Extensible CLI Framework

> The pi.dev for CLI: a meta-CLI and framework that lets developers build
> extensible command-line tools with first-class support for extensions,
> hooks, and middleware.

## 1. Overview

Kapy is a TypeScript CLI framework with two usage modes:

1. **Standalone shell** — run `kapy` directly; add extensions to turn it into
   whatever CLI you need. Like pi, it ships as a minimal runtime that does
   nothing until you install extensions.

2. **Embeddable framework** — import `kapy` as a library to build your own
   extensible CLI (e.g. `my-cli`). Your code registers core commands, then
   kapy loads extensions that users install.

The same runtime powers both modes. When run standalone, kapy's only built-in
commands are the meta-commands (`install`, `list`, `update`, `remove`, `config`,
`dev`) — its CLI surface is otherwise empty until you add extensions. When
embedded, the host CLI registers its core commands first, then kapy loads
user-installed extensions from `.kapy/` in the project directory.

## 2. Architecture

### 2.1 Components

| Component | Package | Responsibility |
|---|---|---|
| `kapy` runtime + CLI | `kapy` | CLI entry point, command registry, hooks, middleware, extension loader, config, TUI shell (`kapy tui`) |
| `kapy-components` | `kapy-components` | Reusable UI components built on `@opentui/core`: Box, Text, Input, Select, ScrollBox, Code, Diff, Spinner, etc. |
| Extension API | `kapy` | The `KapyExtensionAPI` surface that extensions use to register commands, hooks, middleware, screens |
| Config system | `kapy` | Hierarchical config: defaults → project config → global config → env vars → CLI flags |

### 2.2 Package Layout

```
kapy/                          (monorepo)
├── packages/
│   ├── kapy/                  (runtime + CLI bin + TUI shell)
│   ├── kapy-components/       (UI components on @opentui/core)
│   └── create-kapy/           (scaffolding template, runs via `bun create`)
├── SPEC.md
├── package.json
├── tsconfig.json
└── bun.lock
```

Two publishable packages, one scaffolding template:

| Package | Installs as | Depends on | Purpose |
|---|---|---|---|
| `kapy` | `bun install -g kapy` | `kapy-components`, `@opentui/core` | CLI, runtime, TUI shell, extension API |
| `kapy-components` | `bun install kapy-components` | `@opentui/core` | UI components for building TUI screens |
| `create-kapy` | `bun create kapy` | — | Project scaffolding template |

Dependency flow:
```
kapy → kapy-components → @opentui/core
```

`kapy` **re-exports** everything from `kapy-components`, so extensions can
choose either import path:

```ts
// Both work — kapy re-exports kapy-components
import { Box, Text } from "kapy";
import { Box, Text } from "kapy-components";
```

CLI-only extensions (no TUI) only need `kapy` as a peer dependency.
TUI extensions may add `kapy-components` explicitly for cleaner deps:

```json
{
  "name": "@foo/kapy-dashboard",
  "peerDependencies": {
    "kapy": "^1.0.0",
    "kapy-components": "^1.0.0"
  }
}
```

## 3. Command System

### 3.1 Defining Commands

```ts
import { kapy } from "kapy";

kapy()
  .command("deploy", {
    description: "Deploy your application",
    args: [
      { name: "env", description: "Environment", default: "staging" },
    ],
    flags: {
      verbose: { type: "boolean", alias: "v", description: "Verbose output" },
    },
  }, async (ctx) => {
    ctx.log(`Deploying to ${ctx.args.env}...`);
  })
  .run();
```

The `CommandOptions` type:

```ts
interface CommandOptions {
  description: string;
  args?: ArgDefinition[];       // positional arguments
  flags?: Record<string, FlagDefinition>;  // named flags
  hidden?: boolean;             // hide from help
  middleware?: Middleware[];     // command-specific middleware
}

interface ArgDefinition {
  name: string;
  description?: string;
  default?: unknown;
  required?: boolean;
  variadic?: boolean;
}

interface FlagDefinition {
  type: "string" | "boolean" | "number";
  alias?: string;
  description?: string;
  default?: unknown;
  required?: boolean;
}
```

Every command automatically supports `--json` and `--no-input` flags (see
Section 10). These are injected by the runtime and don't need to be declared
per-command.

### 3.2 Command Context

Every command handler receives a `ctx` object:

| Property | Type | Package | Description |
|---|---|---|---|
| `ctx.args` | `Record<string, unknown>` | kapy | Parsed arguments and flags |
| `ctx.config` | `Record<string, unknown>` | kapy | Merged configuration |
| `ctx.command` | `string` | kapy | The command name being executed |
| `ctx.duration` | `number` | kapy | Milliseconds since command started |
| `ctx.aborted` | `boolean` | kapy | Whether the command was aborted |
| `ctx.log(msg)` | function | kapy | Styled output (green) |
| `ctx.warn(msg)` | function | kapy | Styled output (yellow) |
| `ctx.error(msg)` | function | kapy | Styled output (red) |
| `ctx.spinner(text)` | function | kapy-components | Returns a progress spinner |
| `ctx.prompt(msg)` | function | kapy-components | Interactive prompt, returns promise |
| `ctx.abort(code?)` | function | kapy | Cancel execution with optional exit code |

### 3.3 Nested Commands

Commands use the `:` separator convention for nesting. This mirrors pi's
convention and allows flat registration without requiring a nested object
model. Users type `:` as the separator:

- `deploy` → base command
- `deploy:aws` → subcommand for AWS
- `deploy:gcp` → subcommand for GCP

An extension adding `deploy:aws` automatically registers as a subcommand of
`deploy`. Running `my-cli deploy` without a subcommand shows help for all
`deploy:*` commands.

> **Rationale for `:`**: Space-separated subcommands (`deploy aws`) require a
> nested routing tree and make extension command registration more complex. The
> `:` convention keeps the command registry flat, avoids ambiguity with
> positional args, and makes it easy for extensions to add subcommands without
> modifying the parent.

### 3.4 End-User Experience

```bash
my-cli deploy --env production
my-cli deploy:aws --region us-east-1
my-cli deploy:gcp --project my-proj
```

## 4. Hook System

Hooks let extensions react to lifecycle events without modifying command code.

### 4.1 Built-in Hooks

| Hook | When it fires |
|---|---|
| `on:load` | CLI startup, after extensions are loaded |
| `on:extension:loaded` | After each extension's `register()` completes |
| `before:command` | Before any command runs |
| `after:command` | After any command completes (success or error) |
| `before:<name>` | Before a specific command (e.g. `before:deploy`) |
| `after:<name>` | After a specific command |
| `on:error` | When any unhandled error occurs in the pipeline (command, hook, or middleware). Errors within `on:error` handlers are caught and logged to stderr. |

### 4.2 Registering Hooks

```ts
export function register(api: KapyExtensionAPI) {
  api.addHook("before:deploy", async (ctx) => {
    if (!ctx.config.credentials) {
      ctx.error("No credentials configured");
      ctx.abort(1);
    }
  });

  api.addHook("after:command", async (ctx) => {
    ctx.log(`Command ${ctx.command} finished in ${ctx.duration}ms`);
  });
}
```

### 4.3 Execution Order

Middleware wraps the entire hook+command pipeline. The full execution order is:

1. Middleware stack (outermost to innermost) — each calls `next()` to proceed
2. `before:command` hooks (in extension load order)
3. `before:<name>` hooks
4. Command handler
5. `after:<name>` hooks
6. `after:command` hooks
7. Middleware stack unwinds (post-`next()` code runs in reverse order)

If middleware short-circuits (doesn't call `next()`), no hooks or command run.
If any `before` hook calls `ctx.abort()`, remaining `before` hooks for that
event are skipped, the command handler is skipped, and `after` hooks fire with
`ctx.aborted = true`.

### 4.4 Custom Events

Extensions can emit and listen to custom events:

```ts
api.emit("deploy:success", { url: "https://..." });
api.on("deploy:success", async (data) => {
  // notify slack, etc.
});
```

## 5. Middleware Pipeline

Middleware wraps command execution, allowing extensions to intercept, modify,
or short-circuit the request/response flow. Like Express middleware but for CLI
commands.

### 5.1 How Middleware Works

```ts
api.addMiddleware(async (ctx, next) => {
  const start = Date.now();
  await next(); // pass control to next middleware / command
  const duration = Date.now() - start;
  ctx.log(`Completed in ${duration}ms`);
});
```

### 5.2 Behaviors

- **Ordered execution** — middleware runs in registration order (extensions load
  in config order)
- **Can transform** `ctx.args` before `next()` or transform output after
- **Can short-circuit** — calling `ctx.abort()` instead of `next()` stops the
  chain
- **Error handling** — if `next()` throws, the next middleware's `catch` handles
  it

### 5.3 Built-in Middleware

Kapy ships optional middleware that extension authors can use:

- `kapy/middleware/logging` — structured logging
- `kapy/middleware/timing` — command duration tracking
- `kapy/middleware/error-handler` — catches unhandled errors, formats output

### 5.4 Hooks vs Middleware

- **Hooks** are `before/after` side effects — they run but can't transform the
  flow
- **Middleware** wraps the entire execution — can transform input/output and
  control flow

## 6. Extension Contract

### 6.1 Extension Structure

Every extension is an npm package (or git repo) with this convention:

```
@foo/kapy-deploy-aws/
├── package.json        # must have "kapy-extension" keyword
├── src/
│   └── index.ts        # exports register() and meta
└── README.md
```

### 6.2 Extension Entry Point

Extensions export an async `register` function and a `meta` object:

```ts
import type { KapyExtensionAPI } from "kapy";

export async function register(api: KapyExtensionAPI) {
  api.addCommand({ name: "deploy:aws", description: "Deploy to AWS", ... });
  api.addHook("before:deploy", async (ctx) => { ... });
  api.addMiddleware(async (ctx, next) => { ... });
}

export const meta = {
  name: "@foo/kapy-deploy-aws",
  version: "1.0.0",
  dependencies: ["@foo/kapy-aws-core"],  // loaded first
};
```

`register()` is async to allow extensions to do async setup (e.g., connecting
to a service, loading remote config). If `register()` throws, the extension is
skipped with a warning and other extensions continue loading.

Optionally, `register()` may return a dispose function for cleanup:

```ts
export async function register(api: KapyExtensionAPI): Promise<void | (() => void)> {
  const conn = await db.connect();
  api.addCommand("db:query", async (ctx) => { ... });
  return () => conn.close();  // called on extension unload
}
```

### 6.3 Command Name Conflicts

If two extensions register the same command name, kapy emits a warning and
uses the **last-loaded** extension's command. Extension load order follows
the order in `kapy.config.ts` extensions array, with dependencies loaded first.

Extensions are encouraged to namespace commands with their package scope:
`@foo/kapy-deploy` should register `deploy:foo` rather than claiming `deploy`.

```ts
interface KapyExtensionAPI {
  addCommand(definition: CommandDefinition): void;
  addHook(event: string, handler: HookHandler): void;
  addMiddleware(middleware: Middleware): void;
  declareConfig(schema: ConfigSchema): void;
  emit(event: string, data?: unknown): void;
  on(event: string, handler: EventHandler): void;
}
```

### 6.4 Extension Config Schema

Extensions declare their configuration schema under their own namespace, and
kapy provides a typed config accessor. Config keys are automatically prefixed
with the extension's name to avoid collisions:

```ts
export function register(api: KapyExtensionAPI) {
  api.declareConfig({
    region: { type: "string", default: "us-east-1", description: "AWS region" },
    profile: { type: "string", description: "AWS profile name" },
  });

  api.addCommand("deploy:aws", async (ctx) => {
    // Config is namespaced: { "deploy-aws": { region: "us-east-1", ... } }
    const { region, profile } = ctx.config["deploy-aws"];
  });
}
```

If two extensions declare the same config key path **within their own
namespace** (impossible by design — each extension owns its namespace), it's a
no-op. If they declare overlapping keys across namespaces, the hierarchy
merges normally since the paths are different.

## 7. Config System

### 7.1 Config Hierarchy

Values are merged in order; later sources override earlier ones:

```
kapy defaults → project kapy.config.ts → ~/.kapy/config.json → env vars → CLI flags
```

The project config is TypeScript (`kapy.config.ts`) because it may contain
logic (conditionals, imports). The global config is JSON because it's
machine-managed by `kapy install`/`kapy config` and should not require a TS
runtime in `~/.kapy/`.

### 7.2 Project Config (`kapy.config.ts`)

```ts
import { defineConfig } from "kapy";

export default defineConfig({
  name: "my-cli",
  extensions: [
    "npm:@foo/kapy-deploy-aws@^1.0.0",
    "git:github.com/bar/kapy-tools@main",
    "./local-ext",
  ],
  middleware: [logging, timing],
});
```

### 7.3 Global Config (`~/.kapy/config.json`)

```json
{
  "extensions": {
    "@foo/kapy-deploy-aws": {
      "version": "1.2.0",
      "config": {
        "region": "eu-west-1"
      }
    }
  }
}
```

### 7.4 Environment Variables

Config values can be overridden with an env prefix. The prefix defaults to
`KAPY_` in standalone mode but is **configurable** in embedded mode via
`defineConfig()`:

```ts
// kapy.config.ts
export default defineConfig({
  name: "my-cli",
  envPrefix: "MY_CLI",  // overrides default "KAPY_"
  // ...
});
```

```bash
# Standalone (default prefix)
KAPY_DEPLOY_AWS_REGION=us-west-2 kapy deploy:aws

# Embedded
MY_CLI_DEPLOY_AWS_REGION=us-west-2 my-cli deploy:aws
```

## 8. Distribution & Install

### 8.1 Install Commands

```bash
kapy install npm:@foo/kapy-ext            # from npm
kapy install npm:@foo/kapy-ext@1.2.3       # pinned version
kapy install git:github.com/user/repo      # from git
kapy install git:github.com/user/repo@v2   # git tag<br>kapy install ./path/to/ext                 # local (dev mode)
```

### 8.2 Manage Commands

```bash
kapy upgrade           # upgrade kapy itself to the latest version
kapy list              # show installed extensions
kapy update            # update all extensions
kapy update <name>     # update a specific extension
kapy remove <name>     # uninstall an extension
kapy config            # view/edit configuration
```

> **Note**: `kapy search` is planned for post-MVP. It will search npm for
> packages with the `kapy-extension` keyword.

### 8.3 Dev Mode

```bash
kapy dev              # run CLI with hot reload on extension changes
kapy dev --debug      # verbose logging
```

Dev mode watches extension source files for changes and **restarts the process**
(not in-process HMR — simpler and more reliable). On file change, kapy exits
and re-spawns itself, reloading all extensions from scratch.

### 8.4 Scaffolding

```bash
kapy init my-cli              # scaffold a new kapy-powered CLI project
kapy init my-cli --template   # with example commands and extension
```

## 9. Project Structure

### 9.1 Scaffolded Project (`kapy init my-cli`)

```
my-cli/
├── .kapy/
│   ├── config.json            # extension configuration
│   └── extensions/            # installed extensions (gitignored)
├── src/
│   ├── commands/
│   │   └── deploy.ts         # built-in command
│   └── index.ts              # entry point: kapy().command(...).run()
├── kapy.config.ts             # kapy project config
├── package.json               # includes kapy and kapy-components as deps
└── tsconfig.json
```

### 9.2 Global Standalone (`~/.kapy/`)

```
~/.kapy/
├── config.json                # global config + extension settings
├── extensions.json            # extension manifest (name, version, source, checksum)
├── extensions/                # installed extensions
│   ├── node_modules/
│   └── ...
└── cache/                     # downloaded packages cache
```

The `extensions.json` manifest tracks installed extensions:

```json
{
  "extensions": {
    "@foo/kapy-deploy-aws": {
      "version": "1.2.0",
      "source": "npm:@foo/kapy-deploy-aws@1.2.0",
      "checksum": "sha512-abc123...",
      "installedAt": "2025-04-10T12:00:00Z"
    }
  }
}
```

## 10. AI Agent Compatibility

Kapy is designed to be friendly to AI agents (coding assistants, CI bots,
automated tooling) as well as humans. All commands support two universal flags:

### 10.1 Universal Flags

| Flag | Purpose |
|---|---|
| `--json` | Output structured JSON instead of styled text |
| `--no-input` | Skip all interactive prompts; use defaults or fail with a clear exit code |

Example:

```bash
kapy deploy:aws --json --no-input
# {"status":"success","url":"https://app.example.com","region":"us-east-1"}

kapy install npm:@foo/kapy-ext --json --no-input
# {"installed":"@foo/kapy-ext@1.2.0","commands":["deploy:aws"],"hooks":["before:deploy"]}
```

### 10.2 Discovery Commands

Agents need to discover what a kapy-powered CLI can do without reading docs:

| Command | Output |
|---|---|
| `kapy commands [--json]` | List all registered commands with args, flags, and descriptions |
| `kapy inspect [--json]` | Dump full state: installed extensions, config, available hooks, middleware |
| `kapy help <command> [--json]` | Detailed help for a specific command |

Example:

```bash
kapy commands --json
# [
#   {
#     "name": "deploy",
#     "description": "Deploy your application",
#     "args": [{"name": "env", "required": true}],
#     "flags": [{"name": "verbose", "alias": "v", "type": "boolean"}],
#     "subcommands": ["deploy:aws", "deploy:gcp"]
#   },
#   ...
# ]
```

### 10.3 Structured Exit Codes

Exit codes are consistent across all commands so agents can interpret results:

| Code | Meaning |
|---|---|
| `0` | Success |
| `1` | General error |
| `2` | Invalid arguments or unknown command |
| `3` | Extension error (extension threw during load or execution) |
| `4` | Config error (missing or invalid configuration) |
| `5` | Network error (install/update failed) |
| `10` | Aborted by hook or middleware (`ctx.abort()`) |

### 10.4 Agent Hints (Extension Metadata)

Extensions can declare `agentHints` in their command definitions — a
machine-readable description of what the command does, when to use it, and
what kind of output to expect:

```ts
api.addCommand({
  name: "deploy:aws",
  description: "Deploy to AWS",
  agentHints: {
    purpose: "Deploys the project to an AWS environment",
    when: "When the user wants to deploy to AWS specifically",
    output: "JSON with deployment URL and region on success",
    sideEffects: "Creates or updates AWS resources",
    requires: ["AWS credentials configured"],
  },
  // ...
});
```

These hints are included in `kapy commands --json` output, giving agents the
context they need to choose the right command without human guidance.

### 10.5 Programmatic Usage

For agents that want to invoke kapy from code rather than spawning a process:

```bash
kapy run <command> --json --no-input
```

This is the same as running a command directly, but guarantees `--json` and
`--no-input` behavior. Agents should always use `--json --no-input` for
machine-consumable output.

## 11. Security

- Extensions run in the same process (no sandboxing by default; Bun sandboxing
  is a future goal)
- `kapy install` shows a trust prompt on first install (extension name, source,
  what it registers)
- `--trust` flag skips the trust prompt (for CI/automation)
- Extensions are code — users should review before installing
- **Future**: The `meta` field in extensions will support a `permissions`
  declaration (e.g., `permissions: ["fs:read", "fs:write", "net", "env"]`).
  This is a documentation contract for MVP — not enforced at runtime yet.

## 12. Tech Stack

| Concern | Choice |
|---|---|
| Language | TypeScript |
| Runtime | **Bun** (primary), Node.js compatible |
| Arg parser | Custom (lightweight, built for extension `:` command convention) |
| Build | Bun's native bundler |
| Package manager | Bun (bun install) |
| Test | Bun test runner (bun test) |
| Lint | Biome |
| Color/styling | picocolors |
| Spinner/prompts | Custom (Bun-native, no Node-specific deps like ora) |
| File watching | Bun.FileSink / chokidar for dev mode |
| TUI framework | **@opentui/core** (direct dep of `kapy-components`, powers `kapy tui`) |
| UI components | **kapy-components** (separate package, re-exported by `kapy`) |

**Bun-first rationale**: Bun provides a single runtime, bundler, test runner,
and package manager — eliminating the need for tsup, turbo, vitest, and
separate tool config. Extensions are loaded as ESM modules via Bun's native
TypeScript support. The CLI boots faster on Bun's startup time. Node.js
compatibility is maintained where feasible, but Bun is the primary target.

## 13. OpenTUI Integration (`kapy tui`)

Kapy's core runtime uses simple terminal output (`ctx.log`, `ctx.warn`,
`ctx.error`, `ctx.spinner`, `ctx.prompt`). Running `kapy tui` opens an
interactive terminal UI powered by [OpenTUI](https://opentui.com/) where
extensions can render rich interfaces.

### 13.1 How It Works

- `kapy tui` is a built-in command that launches the OpenTUI-based TUI shell
- Extensions register TUI views/screens via `api.addScreen()`
- The TUI shell provides navigation (sidebar, keybindings) between screens
- Extensions that don't register screens still appear as regular commands

```bash
kapy tui            # launch the interactive TUI
kapy tui --screen dashboard  # open directly to a specific screen
```

### 13.2 Extension API for TUI

Extensions register screens via `api.addScreen()`. UI components come from
`kapy-components` (or re-exported via `kapy`):

```ts
import type { KapyExtensionAPI } from "kapy";
import { Box, Text, ScrollBox } from "kapy-components";

export async function register(api: KapyExtensionAPI) {
  api.addScreen({
    name: "dashboard",
    label: "Dashboard",
    icon: "📊",
    render(ctx) {
      return Box({ flexDirection: "column", gap: 1 },
        Text({ content: "Project Dashboard", fg: "#00FF00" }),
        ScrollBox({ height: 20 },
          Text({ content: "...metrics..." })
        )
      );
    },
    keyBindings: {
      q: "quit",
      r: "refresh",
    },
  });
}
```

### 13.3 TUI Shell Layout

When `kapy tui` is run, the default layout:

```
┌─────────┬──────────────────────────────┐
│ Sidebar │         Main Area            │
│         │                              │
│ 📊 Home │   [Active screen content]    │
│ 📦 Ext  │                              │
│ 🔧 Conf │                              │
│ ⚡ Term │                              │
│         │                              │
│         │                              │
├─────────┴──────────────────────────────┤
│ Status Bar: extension info / key hints │
└─────────────────────────────────────────┘
```

- **Sidebar**: Lists screens registered by extensions
- **Main area**: Renders the active screen's OpenTUI components
- **Status bar**: Shows current context, key hints, and extension info

Built-in screens:
- **Home**: Overview of installed extensions and recent activity
- **Extensions**: Browse, install, remove, configure extensions
- **Config**: Edit kapy configuration interactively
- **Terminal**: A built-in terminal for running commands

### 13.4 Rendering Lifecycle

1. User runs `kapy tui` — OpenTUI renderer initializes
2. Sidebar populates with screens from loaded extensions
3. User navigates to a screen — that extension's `render()` is called
4. Screen handles keyboard input via `keyBindings`
5. Pressing `q` or `Ctrl+C` exits the TUI, restoring the terminal

When `--json` or `--no-input` flags are set, `kapy tui` is unavailable and
prints an error — TUI requires an interactive terminal. This ensures AI agent
compatibility is never broken.

### 13.5 Package Structure

Two publishable packages plus a scaffolding template:

```
packages/
├── kapy/                  # runtime + CLI bin + TUI shell (depends on kapy-components, @opentui/core)
├── kapy-components/       # UI components built on @opentui/core (Box, Text, Input, ScrollBox, etc.)
└── create-kapy/           # scaffolding template (not a dependency)
```

What lives in each package:

| Concern | Package |
|---|---|
| CLI bin (`kapy`), command registry, hooks, middleware, extension loader, config | `kapy` |
| `kapy tui` command, renderer lifecycle, sidebar, built-in screens | `kapy` |
| `api.addScreen()`, `api.addCommand()`, `api.addHook()` | `kapy` |
| `Box`, `Text`, `Input`, `Select`, `ScrollBox`, `Code`, `Diff`, `Spinner` | `kapy-components` |
| Layout patterns (sidebar, status bar) | `kapy-components` |
| `ctx.spinner()`, `ctx.prompt()` | `kapy-components` (injected into ctx by kapy) |
| `@opentui/core` wrappers and abstractions | `kapy-components` |

`kapy` re-exports `kapy-components` for convenience. CLI-only extensions
depend only on `kapy`; TUI extensions may add `kapy-components` explicitly.

## 14. MVP Scope

The first release should include:

1. **`kapy` package** (`packages/kapy`) — everything in one package: command
   registry, hooks, middleware, extension loader, config system, CLI bin,
   TUI shell, built-in commands (`init`, `install`, `list`, `update`,
   `remove`, `upgrade`, `config`, `dev`, `commands`, `inspect`, `tui`)
2. **`kapy-components` package** (`packages/kapy-components`) — UI components
   built on `@opentui/core` (Box, Text, Input, Select, ScrollBox, Code, Diff,
   Spinner, layout patterns). Re-exported by `kapy` for convenience.
3. **Scaffolding** (`packages/create-kapy`) — `bun create kapy` project
   template
4. **Example extension** — a reference extension demonstrating commands, hooks,
   middleware, and a TUI screen
5. **Documentation** — README with quickstart guide

Out of scope for MVP:
- `kapy search` (can be added later)
- Custom themes
- RPC/SDK modes
- Sandboxed extensions