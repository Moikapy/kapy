# ADR-014: For each={signal()} causes blank TUI render

> Status: Accepted

## Context

When using Solid.js `<For each={signal()}>` where the signal returns a typed array (e.g., `createSignal<Msg[]>([])`), the OpenTUI/Solid JSX renderer produces a blank TUI. Static arrays like `<For each={['A','B','C']}>` work fine.

This was discovered during the Kapy TUI implementation. The simplest base TUI (route context, sidebar toggle, textarea) works perfectly. But adding `<For each={messages()}>` where messages is a reactive signal causes the entire render to produce blank output — no error, just an empty frame.

## Decision

Avoid `<For each={signal()}>` in Kapy TUI components. Use `<Show>` with index-based access or manual conditional rendering instead.

## Alternatives Considered

1. **Fix the OpenTUI reconciler** — requires deep debugging of the Solid JSX → Renderable pipeline. Root cause unknown.
2. **Use `<For>` only with static/literal arrays** — works but useless for dynamic message lists.
3. **Use index-based rendering with `<Show>`** — chosen. Less elegant but reliable.

## Investigation Details

- `<For each={['A','B','C']}>` inside `<Show when={route === "home"}>` ✅ works
- `<For each={messages()}>` inside `<Show when={messages().length > 0}>` ❌ blank
- Even `<For each={messages()}>` at root level with empty signal ❌ blank
- The same `<For each={signal()}>` pattern works in vanilla Solid.js outside OpenTUI
- Likely a Bun JSX transform or OpenTUI Renderable construction issue with Solid's `<For>` reconciler

## Consequences

Message rendering in the TUI will use `<Show>` + index access instead of `<For>`. This is a known limitation that should be revisited when OpenTUI updates its Solid reconciler.