# @moikapy/kapy-agent

General-purpose agent with transport abstraction, state management, and tool execution. Built on `@moikapy/kapy-ai`.

**Forked from [@mariozechner/pi-agent-core](https://github.com/badlogic/pi-mono/tree/main/packages/agent)** — thanks to Mario Zechner for the excellent foundation.

## What Changed From pi-agent-core

- Package rebranded: `@mariozechner/pi-agent-core` → `@moikapy/kapy-agent`
- Dependency updated: `@mariozechner/pi-ai` → `@moikapy/kapy-ai`
- All internal imports updated

The API surface is identical. Swap the package name and everything works.

## Installation

```bash
bun add @moikapy/kapy-agent
```

## Quick Start

```ts
import { Agent } from "@moikapy/kapy-agent";
import { getModel } from "@moikapy/kapy-ai";

const agent = new Agent({
  initialState: {
    systemPrompt: "You are a helpful assistant.",
    model: getModel("anthropic", "claude-sonnet-4-20250514"),
  },
});

agent.subscribe((event) => {
  if (event.type === "message_update" && event.assistantMessageEvent?.type === "text_delta") {
    process.stdout.write(event.assistantMessageEvent.delta);
  }
});

await agent.prompt("Hello!");
```

## Core Concepts

- **AgentMessage** — Flexible message type supporting LLM messages + custom app messages
- **convertToLlm** — Bridge from app messages to LLM-compatible format
- **transformContext** — Prune/compact context before LLM calls
- **Steering & FollowUp** — Queue messages to inject mid-run or after completion
- **beforeToolCall / afterToolCall** — Hooks for permission checks and result post-processing
- **Parallel/Sequential tool execution** — Configurable per assistant turn

## License

MIT — Original work by Mario Zechner. Forked and modified by Moikapy.