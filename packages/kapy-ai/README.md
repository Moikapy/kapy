# @moikapy/kapy-ai

Unified LLM API with automatic model discovery and provider configuration.

**Forked from [@mariozechner/pi-ai](https://github.com/badlogic/pi-mono/tree/main/packages/ai)** — thanks to Mario Zechner for the excellent foundation.

## What Changed From pi-ai

- Package rebranded: `@mariozechner/pi-ai` → `@moikapy/kapy-ai`
- CLI bin renamed: `pi-ai` → `kapy-ai`
- All internal imports updated to `@moikapy/kapy-ai`

The API surface is identical. If you were using `pi-ai`, swap the package name and everything works.

## Installation

```bash
bun add @moikapy/kapy-ai
```

## Quick Start

```ts
import { getModel, streamSimple } from "@moikapy/kapy-ai";

const model = getModel("anthropic", "claude-sonnet-4-20250514");
const stream = streamSimple(model, {
  systemPrompt: "You are a helpful assistant.",
  messages: [{ role: "user", content: [{ type: "text", text: "Hello!" }] }],
});

for await (const event of stream) {
  if (event.type === "text_delta") {
    process.stdout.write(event.delta);
  }
}
```

## Supported Providers

- **Anthropic** — Claude models
- **OpenAI** — GPT models (Completions + Responses API)
- **Google** — Gemini models
- **Google Vertex AI** — Enterprise Gemini
- **Mistral** — Mistral models
- **Amazon Bedrock** — Multi-provider via AWS
- **Azure OpenAI** — Enterprise OpenAI

## License

MIT — Original work by Mario Zechner. Forked and modified by Moikapy.