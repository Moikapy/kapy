# kapy

The pi.dev for CLI — an extensible CLI framework with first-class support for extensions, hooks, middleware, and a built-in TUI.

## Install

```bash
bun install -g kapy
```

## Quick Start

### Standalone mode

Run `kapy` directly. It ships with no commands until you add extensions:

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
| `kapy upgrade` | Upgrade kapy itself to the latest version |
| `kapy config` | View/edit configuration |
| `kapy dev` | Run CLI in dev mode with hot reload |
| `kapy commands` | List all registered commands |
| `kapy inspect` | Dump full state (extensions, config, hooks) |
| `kapy tui` | Launch interactive terminal UI |

## Extensions

Extensions are TypeScript modules that export a `register` function:

```ts
import type { KapyExtensionAPI } from "kapy"
import { Box, Text, ScrollBox } from "kapy-components"

export async function register(api: KapyExtensionAPI) {
  api.addCommand({
    name: "deploy:aws",
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
      return Box({ flexDirection: "column", gap: 1 },
        Text({ content: "Project Dashboard", fg: "#00FF00" }),
        ScrollBox({ height: 20 },
          Text({ content: "...metrics..." })
        )
      )
    },
  })
}

export const meta = {
  name: "@foo/kapy-deploy-aws",
  version: "1.0.0",
  dependencies: [],
}
```

Install extensions from npm, git, or local paths:

```bash
kapy install npm:@foo/kapy-ext
kapy install npm:@foo/kapy-ext@1.2.3
kapy install git:github.com/user/repo
kapy install ./path/to/ext
```

## `kapy tui`

Launch the interactive terminal UI powered by [OpenTUI](https://opentui.com/):

```bash
kapy tui
kapy tui --screen dashboard
```

Extensions register screens via `api.addScreen()`. The TUI shell provides a sidebar, main area, and status bar. Built-in screens include Home, Extensions, Config, and Terminal.

## AI Agent Compatibility

All commands support `--json` and `--no-input` for machine-readable output:

```bash
kapy commands --json
kapy deploy:aws --json --no-input
kapy inspect --json
```

Extensions can declare `agentHints` for machine-readable command descriptions. Structured exit codes: `0` success, `1` error, `2` invalid args, `3` extension error, `4` config error, `5` network error, `10` aborted.

## Packages

| Package | Purpose |
|---|---|
| `kapy` | Runtime + CLI + TUI shell. Install this. |
| `kapy-components` | UI components on @opentui/core (Box, Text, Input, ScrollBox, etc.). Re-exported by `kapy`. |
| `create-kapy` | Scaffolding template for `bun create`. |

## Tech Stack

TypeScript, Bun runtime, @opentui/core, Biome, picocolors

## License

MIT