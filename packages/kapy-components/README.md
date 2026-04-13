# @moikapy/kapy-components

**UI components for kapy TUI** — built on @opentui/core.

Declarative component API for building terminal interfaces:

```ts
import { Box, Text, createBanner } from "@moikapy/kapy-components"
```

## Components

| Component | Description |
|---|---|
| `Box` | Layout container with borders, padding, and flex |
| `Text` | Styled text output with colors and formatting |
| `Input` | Single-line text input |
| `Select` | Interactive selection list |
| `ScrollBox` | Scrollable content container |
| `Code` | Syntax-highlighted code display |
| `Diff` | Side-by-side diff viewer |
| `Spinner` | Animated progress indicator |
| `Banner` | ASCII art banner text |
| `Sidebar` | Navigation sidebar |
| `StatusBar` | Bottom status bar |

## Hooks

| Hook | Description |
|---|---|
| `useFocus` | Track focus state for a component |
| `useInput` | Bind keyboard input handling |

## Installation

```bash
bun add @moikapy/kapy-components
```

> **Note:** `@moikapy/kapy` re-exports all kapy-components, so you usually don't need to install this separately.

## License

MIT