<p align="center">
  <img src="./assets/capybara.webp" alt="Kapy — the agent-first CLI framework" width="256" />
</p>

<h1 align="center">kapy 🐹</h1>

<p align="center">
  <strong>The agent-first CLI framework</strong><br/>
  Build AI tools from the terminal. Commands, hooks, middleware, TUI — everything snaps together.
</p>

<p align="center">
  <a href="#install">Install</a> · <a href="#quick-start">Quick Start</a> · <a href="#extensions">Extensions</a> · <a href="#tui">TUI</a> · <a href="#ai-agents">AI Agents</a>
</p>

---

## Install

```bash
bun install -g kapy
```

## Quick Start

### Standalone mode

Run `kapy` directly. It ships with meta-commands — its CLI surface is empty until you install extensions:

```bash
kapy install npm:@foo/kapy-deploy
kapy deploy:aws --region us-east-1
kapy tui
```

### Embedded mode

Build your own extensible CLI on top of kapy:

```ts
import { kapy } from "kapy"

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
| `kapy upgrade [--pm <bun|npm|yarn|pnpm>]` | Upgrade kapy (auto-detects package manager) |
| `kapy config` | View/edit configuration |
| `kapy dev` | Run CLI in dev mode with hot reload |
| `kapy commands` | List all registered commands |
| `kapy inspect` | Dump full state (extensions, config, hooks) |
| `kapy tui` | Launch interactive terminal UI |

## Extensions

Extensions are TypeScript modules that export a `register` function:

```ts
import type { KapyExtensionAPI } from "kapy"

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

  api.addScreen({
    name: "dashboard",
    label: "Dashboard",
    icon: "📊",
    render(ctx) {
      return { type: "Text", props: { content: "Project Dashboard" } }
    },
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

## `kapy tui`

Launch the interactive terminal UI:

```bash
kapy tui
kapy tui --screen dashboard
```

Extensions register screens via `api.addScreen()`. The TUI provides sidebar navigation, screen switching, and a status bar.

Built-in screens: Home 📊, Extensions 📦, Config 🔧, Terminal ⚡

## Config

Config hierarchy (later overrides earlier):

```
kapy defaults → kapy.config.ts → ~/.kapy/config.json → env vars → CLI flags
```

```ts
// kapy.config.ts
import { defineConfig } from "kapy"

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

## AI Agent Support

Kapy puts agents first. Every command supports `--json` and `--no-input` for machine-readable, non-interactive output:

```bash
kapy commands --json
kapy deploy:aws --json --no-input
kapy inspect --json
```

Extensions declare `agentHints` — structured metadata that AI agents can parse to understand what a command does and how to call it. Structured exit codes give agents unambiguous signal: `0` success, `1` error, `2` invalid args, `3` extension error, `4` config error, `5` network error, `10` aborted by hook/middleware.

Compose extensions into agent toolchains. Hooks and middleware let you inject auth, rate-limiting, logging, and retries without touching command logic.

## Packages

| Package | Purpose |
|---|---|
| `@moikapy/kapy` | Runtime + CLI bin + TUI shell + agent support. Install this. |
| `@moikapy/kapy-components` | UI components on @opentui/core (Banner, Box, Text, Input, Select, ScrollBox, Code, Diff, Spinner, Sidebar, StatusBar). Re-exported by `@moikapy/kapy`. |

## Tech Stack

TypeScript · Bun · @opentui/core · picocolors · Biome

## License

MIT