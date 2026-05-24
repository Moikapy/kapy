<p align="center">
  <img src="./assets/capybara.webp" alt="Kapy — the extensible CLI framework" width="256" />
</p>

<h1 align="center">kapy 🐹</h1>

<p align="center">
  <strong>The extensible CLI framework</strong><br/>
  Commands, hooks, middleware, extensions — everything snaps together.
</p>

<p align="center">
  <a href="#install">Install</a> · <a href="#quick-start">Quick Start</a> · <a href="#extensions">Extensions</a> · <a href="#config">Config</a> · <a href="#context-api">Context API</a>
</p>

---

## Install

```bash
bun install -g kapy
```

## Quick Start

### Standalone mode

Run `kapy` directly. It ships with meta-commands — its CLI surface grows as you install extensions:

```bash
kapy install npm:@foo/kapy-deploy
kapy deploy:aws --region us-east-1
```

### Embedded mode

Build your own extensible CLI on top of kapy:

```ts
import { kapy } from "@moikapy/kapy"

kapy()
  .command("deploy", {
    description: "Deploy your application",
    args: [{ name: "env", description: "Environment", default: "staging" }],
    flags: {
      verbose: { type: "boolean", alias: "v", description: "Verbose output" },
    },
  }, async (ctx) => {
    ctx.log(`Deploying to ${ctx.args.env}...`)
  })
  .run()
```

## Built-in Commands

| Command | Description |
|---|---|
| `kapy init <name>` | Scaffold a new kapy-powered CLI project |
| `kapy install <pkg>` | Install an extension (npm/git/local) |
| `kapy list` | Show installed extensions |
| `kapy update [name]` | Update all or a specific extension |
| `kapy remove <name>` | Uninstall an extension |
| `kapy upgrade [--pm <bun\|npm\|yarn\|pnpm>]` | Upgrade kapy (auto-detects package manager) |
| `kapy config` | View/edit configuration |
| `kapy dev` | Run CLI in dev mode with hot reload |
| `kapy commands` | List all registered commands |
| `kapy inspect` | Dump full state (extensions, config, hooks) |
| `kapy help [command]` | Show help for a command |

## Extensions

Extensions are npm packages with the `kapy-extension` keyword. They export a `register` function and a `meta` object:

```ts
import type { KapyExtensionAPI } from "@moikapy/kapy"

export async function register(api: KapyExtensionAPI) {
  api.addCommand("deploy:aws", {
    description: "Deploy to AWS",
  }, async (ctx) => {
    ctx.log("Deploying to AWS...")
  })

  api.addHook("before:deploy", async (ctx) => {
    // auth check, etc.
  })

  api.addMiddleware(async (ctx, next) => {
    const start = Date.now()
    await next()
    ctx.log(`Completed in ${Date.now() - start}ms`)
  })

  api.declareConfig({
    region: { type: "string", required: true, description: "AWS region" },
  })

  api.on("custom-event", async (data) => {
    console.log("Event received:", data)
  })
}

export const meta = {
  name: "@foo/kapy-deploy-aws",
  version: "1.0.0",
  dependencies: [],
}
```

Install from npm, git, or local paths:

```bash
kapy install npm:@foo/kapy-ext
kapy install npm:@foo/kapy-ext@1.2.3
kapy install git:github.com/user/repo
kapy install ./path/to/ext
```

### Extension API

| Method | Purpose |
|---|---|
| `addCommand(def)` | Register a command |
| `addHook(event, handler)` | Register a lifecycle hook |
| `addMiddleware(mw)` | Register middleware |
| `declareConfig(schema)` | Declare config schema (auto-namespaced) |
| `emit(event, data?)` | Emit a custom event |
| `on(event, handler)` | Listen for a custom event |

## Config

Config hierarchy (later overrides earlier):

```
kapy defaults → kapy.config.ts → ~/.kapy/config.json → env vars → CLI flags
```

```ts
// kapy.config.ts
import { defineConfig } from "@moikapy/kapy"

export default defineConfig({
  name: "my-cli",
  extensions: ["npm:@foo/kapy-deploy"],
  envPrefix: "MY_CLI",
})
```

```bash
# Environment variables
KAPY_DEPLOY_AWS_REGION=us-west-2 kapy deploy:aws

# Custom prefix (embedded mode)
MY_CLI_DEPLOY_AWS_REGION=us-west-2 my-cli deploy:aws
```

## Machine-Readable Output

Every command supports `--json` and `--no-input` for scripts and automation:

```bash
kapy commands --json
kapy deploy:aws --json --no-input
kapy inspect --json
```

## Context API

Every command handler receives a `ctx` object:

```ts
async (ctx) => {
  // Basic
  ctx.args                    // Parsed args + flags
  ctx.config                  // Merged config
  ctx.log(msg)                // Styled success output
  ctx.warn(msg)               // Styled warning
  ctx.error(msg)              // Styled error
  ctx.spinner(text)           // Progress spinner
  ctx.prompt(msg)             // Interactive input
  ctx.confirm(msg)            // Yes/no confirm
  ctx.abort(code?)            // Cancel execution

  // Process-Aware (v0.2.0+)
  ctx.isInteractive           // True when TTY + !json + !noInput
  ctx.spawn(cmd, opts?)       // Spawn subprocess (TTY passthrough, abort-safe)
  ctx.exitCode                // Writable exit code (propagated to process.exit)
  ctx.teardown(fn)            // Register cleanup callback (LIFO, async-safe)

  // Agent-Native (v0.4.0+)
  ctx.setResult(data)         // Store structured result for --json/--compact
  ctx.result                  // Get stored result
  ctx.compact                 // True when --compact flag is set
  ctx.compactLine(msg)        // Output token-efficient one-liner
  ctx.json                    // True when --json flag is set
  ctx.noInput                 // True when --no-input flag is set
  ctx.parsed                  // Raw parsed argv (before coercion)
}
```

### `ctx.spawn()` Options

```ts
const result = await ctx.spawn(["tmux", "new-session", "-s", "dev"], {
  tty: true,           // Pass through stdin/stdout/stderr for interactive processes
  stream: false,       // Stream output in real-time (default: collect)
  env: { FOO: "bar" }, // Merge env vars with process.env
  cwd: "/tmp",         // Working directory
  abortOnError: true,  // Auto-kill process on ctx.abort()
  suppressOutput: true, // Suppress stdout in --json mode
})
// result: { exitCode, stdout, stderr, aborted }
```

## Agent-Native Features (v0.4.0)

Kapy is designed for AI agents first. Every kapy CLI automatically supports:

### Universal Flags

```
--json       Machine-readable JSON output (no ANSI, no spinners)
--compact    Token-efficient single-line output for agent context windows
--no-input   Skip all prompts — never block waiting for user input
--schema     Return JSON Schema for a command's args/flags/returns
--agent      Return AgentHints manifest (purpose, when, output, sideEffects)
```

### `ctx.setResult()` — Structured Return Values

Instead of scattering `console.log()` + `if (json)` blocks, call `setResult()` once:

```ts
async (ctx) => {
  const data = await doTheThing(ctx.args)
  ctx.setResult(data)   // stores for --json / --compact emission

  if (ctx.compact) {    // compact: token-efficient one-liners
    ctx.compactLine(formatCompact(data))
    return
  }
  if (ctx.json) return  // setResult auto-emits JSON

  // human-readable output below
  console.log(`Done: ${data.name}`)
}
```

### `ctx.compact` + `ctx.compactLine()`

When `--compact` is passed, `ctx.compact` is `true`. Use `ctx.compactLine(msg)` to output token-efficient one-liners instead of multi-line human output.

### `formatCompact(data)`

Utility that collapses any value into a single line:
- Objects → `key:value|key:value` (pipe-delimited)
- Numbers/strings → raw value
- null/undefined → empty string

```ts
import { formatCompact } from "@moikapy/kapy"

formatCompact({ pages: 42, size: "12kb" })
// "pages:42|size:12kb"
```

### `kapy commands --agent`

Returns an AgentHints manifest for all registered commands — AI agents discover commands without reading docs:

```json
{
  "name": "deploy",
  "purpose": "Deploy your application",
  "when": "When you need to push code to a server",
  "output": "{ url, duration }",
  "sideEffects": "Creates deployment on remote server",
  "requires": ["config.deploy.target"]
}
```

### `kapy <cmd> --schema`

Returns the JSON Schema for any command's input/output. Agents validate args before calling.

### Token Savings

| Mode | Sample output | Tokens | Savings |
|---|---|---|---|
| Human (default) | 4-8 lines with emojis, tips | ~200 | — |
| `--json` | Structured JSON | ~80 | 60% |
| `--compact` | Single pipe-delimited line | ~25 | **87%** |

## Tech Stack

TypeScript · Bun · picocolors · Biome

## Exit Codes

| Code | Meaning |
|---|---|
| 0 | Success |
| 1 | General error |
| 2 | Invalid arguments / unknown command |
| 3 | Extension error |
| 4 | Config error |
| 5 | Network error |
| 10 | Aborted by hook/middleware |

## License

MIT