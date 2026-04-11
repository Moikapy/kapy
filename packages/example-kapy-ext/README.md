# example-kapy-ext

Reference extension for [kapy](https://github.com/Moikapy/kapy) demonstrating all extension capabilities:

- **Commands** — `hello:ext`, `greet` (with args, flags, hooks)
- **Hooks** — `before:greet`, `after:greet`, `before:command`, `after:command`
- **Middleware** — timing middleware that logs command duration
- **TUI Screen** — "Example" screen in `kapy tui`
- **Config** — `greeting` and `enthusiasm` config options

## Install

```bash
kapy install ./packages/example-kapy-ext
```

## Usage

```bash
# Say hello
kapy hello:ext
kapy hello:ext --name "World"

# Greet with style
kapy greet World
kapy greet World --enthusiasm 10
kapy greet World --formal

# See it in TUI
kapy tui --screen example
```

## Extension Structure

```
src/index.ts          # register() + meta exports
```

The `register()` function uses the `KapyExtensionAPI` surface to:
1. `addCommand()` — registers new CLI commands
2. `addHook()` — listens to lifecycle events
3. `addMiddleware()` — wraps command execution
4. `addScreen()` — adds a TUI screen
5. `declareConfig()` — declares namespaced config options