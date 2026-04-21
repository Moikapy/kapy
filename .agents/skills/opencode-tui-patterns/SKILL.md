---
name: opencode-tui-patterns
description: >
  Patterns and improvements for Kapy's TUI chat message rendering, informed by OpenCode's approach.
  Use this skill when modifying the Kapy TUI message display, adding thinking/reasoning UI,
  improving tool call/result rendering, adding collapsible sections, applying theme tokens,
  or any work on packages/kapy/src/tui/ components. Also use when discussing or planning
  TUI UX improvements — this skill captures the evolving set of patterns we adopt from OpenCode.
---

# OpenCode TUI Patterns for Kapy

This is a living skill — it grows as we research and adopt more patterns from OpenCode. Each section captures what we've learned, what Kapy does today, and what the target state looks like.

## Quick Reference: Key Files

| Purpose | File |
|---------|------|
| Message rendering | `packages/kapy/src/tui/components/message-item.tsx` |
| Chat screen layout | `packages/kapy/src/tui/views/chat-screen.tsx` |
| Message type def | `packages/kapy/src/tui/types.ts` (Msg interface) |
| Event→signal bridge | `packages/kapy/src/tui/hooks/use-chat.ts` |
| Theme tokens | `packages/kapy-components/src/theme.ts` |
| OpenCode TUI source | `packages/opencode/src/cli/cmd/tui/routes/session/index.tsx` |

---

## Pattern 1: Thinking / Reasoning Display

### Current Kapy State (post-session-1)
- Thinking visible inside assistant message, left border `colors.bgElement`
- `_Thinking:_ ` italic prefix inline with reasoning content (matches OpenCode pattern)
- Bottom status shows `● thinking` while streaming (minimal indicator)
- No toggle visibility yet (showThinking signal not wired)

### OpenCode Pattern
- **Toggle visibility** via `ctx.showThinking()` signal, bound to keybind + `/thinking` slash command, persisted in KV store
- **Label**: `_Thinking:_ ` prefix in italic markdown before the reasoning content
- **Subtle syntax**: All token foreground alphas multiplied by `thinkingOpacity` (default 0.6), making syntax highlighting visually recede vs main response
- **Rendering**: `<code filetype="markdown" streaming={true} syntaxStyle={subtleSyntax()} content={"_Thinking:_ " + reasoning} fg={theme.textMuted} />`
- **Border**: Left border only, colored `theme.backgroundElement` (low-contrast)
- **Conceal**: `conceal={ctx.conceal()}` hides markdown formatting, shows rendered output only
- **[REDACTED] filter**: Strips OpenRouter encrypted reasoning markers

### Adoption Target
- [ ] Add `showThinking` signal (default: true), toggleable via keybind
- [x] Add `_Thinking:_ ` italic prefix before reasoning content
- [ ] Switch from `<text>` to `<code filetype="markdown">` for syntax highlighting
- [ ] Implement `subtleSyntax` style (multiply token alphas by 0.6)
- [x] Use theme tokens instead of hardcoded hex
- [ ] Add conceal support (render markdown as formatted text)

### Implementation Notes

The `showThinking` toggle needs a keybinding registered in the chat screen. The current "thinking..." status indicator at the bottom of `chat-screen.tsx:57-59` can remain — it shows while streaming before any content arrives.

For `subtleSyntax`, we need to intercept the syntax highlighting theme and reduce all foreground color alphas. This creates visual hierarchy: thinking text is intentionally faded compared to the main response.

The `<code>` component from `@opentui/core` supports `filetype`, `streaming`, `syntaxStyle`, `conceal`, and `fg` props — matching OpenCode's usage exactly.

---

## Pattern 2: Tool Call Rendering — InlineTool vs BlockTool

### Current Kapy State
- All tool calls rendered as one compact line: icon + bold name + truncated args
- No pending/running state shown — tool calls appear only after completion
- No distinction between simple tools (Read, Grep) and rich tools (Bash, Edit)
- Tool style map exists with per-tool icons/colors (good foundation)

### OpenCode Pattern
OpenCode splits tools into two rendering modes:

**InlineTool** — lightweight single-line display for simple tools:
- Read: `→ path/file.ts [offset=N, limit=N]`
- Glob: `✱ "pattern" in path/ (N matches)`
- Grep: `✱ "pattern" in path/ (N matches)`
- WebFetch: `% url`
- Generic: `⚙ toolName [key=value, ...]`
- Pending text while running: `~ Reading file...`, `~ Searching content...`
- Color logic: pending=`theme.warning`, running=`theme.text`, completed=`theme.textMuted`
- Denied tools: `STRIKETHROUGH` attribute

**BlockTool** — expanded panel with detail area for rich tools:
- Bash: left-bordered panel, title `# Shell`, content = command + output
- Edit: title `# Edit path/to/file`, content = diff preview
- Write: title `# Wrote path/to/file`, content = diagnostics
- Background: `theme.backgroundPanel`
- Border: left border `theme.background`
- Click-to-expand for output > 10 lines (bash) or > 3 lines (generic)

### Adoption Target
- [x] Split `tool_call` rendering into InlineTool (simple) and BlockTool (rich)
- [x] Add pending state: `~ Reading file...` with spinner while tool runs
- [ ] Add completed state in `theme.textMuted` (dimmed)
- [ ] Add denied/error state with strikethrough or error styling
- [ ] Bash → BlockTool with expand/collapse for long output
- [ ] Edit/Write → BlockTool with diff/content preview
- [ ] Read/Grep/Glob → InlineTool with match counts and file paths
- [x] Wire `tool_execution_start` / `tool_execution_end` events for real-time status

### Implementation Notes

The `tool_execution_start` and `tool_execution_end` events exist in `use-chat.ts:178-182` but are currently ignored. These are the key to showing pending/running state.

The `Msg` type likely needs extending to carry status: `status?: "pending" | "running" | "completed" | "error" | "denied"`.

For pending text per tool type, add a `PENDING_MESSAGES` map alongside `TOOL_STYLES`:
```
read_file: "Reading file..."
bash: "Writing command..."
grep: "Searching content..."
glob: "Finding files..."
```

---

## Pattern 3: Tool Result Rendering

### Current Kapy State
- Collapsed by default: `✓` (success) or `✗` (error) + summary + `[NL]` hint
- Expandable in code but **bug: `setExpanded` is never called** — results are always collapsed
- No hide toggle for completed tool results
- No grouping of context tools

### OpenCode Pattern
- Tool results integrated with tool calls (not separate messages)
- Collapsible details with animated expand/collapse
- `showDetails` toggle hides completed tools entirely (keybind + `/tool_details`)
- Error results: `ToolErrorCard` — red card background, collapsible, copy-to-clipboard
- Context grouping: Read/Glob/Grep/List grouped into single "Gathered context" / "Gathered context" collapsible

### Adoption Target
- [x] Fix the expand bug — wire `setExpanded` to click or Enter key
- [ ] Add `/tool_details` slash command to hide/show completed tool results
- [ ] Group context tools (Read/Glob/Grep) into a single collapsible "Gathered context" block
- [ ] Error results: red-styled collapsible card with copy button
- [ ] Consider merging tool_call + tool_result into a single Msg with status lifecycle

### Implementation Notes

The merged tool lifecycle approach would change the `Msg` type to something like:
```ts
interface ToolMsg {
  id: string;
  role: "tool";
  toolName: string;
  args: string;
  status: "pending" | "running" | "completed" | "error";
  result?: string;
  resultSummary?: string;
  isExpandable?: boolean;
  expanded?: boolean;
}
```

This follows OpenCode's `ToolPart` model where a single part represents the full lifecycle.

---

## Pattern 8: User Message Background

### OpenCode Pattern
- Outer `<box>`: left border colored by agent color (`local.agent.color(props.message.agent)`)
- Inner `<box>`: `backgroundColor={hover() ? theme.backgroundElement : theme.backgroundPanel}`
- Text: `fg={theme.text}` (not muted, not accent — plain text color)
- Padding: `paddingTop={1} paddingBottom={1} paddingLeft={2}`
- Queued badge: `<span style={{ bg: color(), fg: queuedFg(), bold: true }}> QUEUED </span>`

### Adoption Target
- [x] Add left border colored `colors.primary`
- [x] Add `backgroundColor={colors.bgPanel}` inner box
- [x] Change text from `colors.primary` (blue accent) to `colors.text` (default text)
- [x] Add padding (top/bottom 1, left 2)
- [ ] Add hover state (`onMouseOver`/`onMouseOut` to toggle `bgElement` vs `bgPanel`)

---

## Pattern 4: Theme Tokens Over Hardcoded Colors

### Current Kapy State
- Theme tokens exist in `kapy-components/src/theme.ts` but are NOT used by `message-item.tsx`
- Hardcoded Tokyo Night hex colors: `#565f89`, `#7aa2f7`, `#9ece6a`, `#414868`, `#c0caf5`, `#a9b1d6`, `#f7768e`, `#ff9e64`, `#2ac3de`, `#bb9af7`, `#7dcfff`, `#e0af68`
- No theme switching support

### OpenCode Pattern
- All colors reference semantic theme tokens: `theme.textMuted`, `theme.backgroundElement`, `theme.error`, `theme.backgroundPanel`
- 35+ built-in themes (catppuccin, dracula, gruvbox, tokyonight, etc.)
- System theme auto-generated from terminal color palette
- Custom themes loaded from `~/.opencode/themes/*.json`

### Adoption Target
- [x] Replace all hardcoded hex in `message-item.tsx` with `colors.*` from theme.ts
- [x] Import and use `colors` from `@moikapy/kapy-components`
- [ ] Later: add theme switching + custom theme loading

### Color Mapping (Current → Token)

| Hardcoded | Usage | Token |
|-----------|-------|-------|
| `#565f89` | Muted text, thinking, tool args | `colors.muted` |
| `#7aa2f7` | User messages | `colors.primary` |
| `#9ece6a` | Assistant response | `colors.success` |
| `#414868` | Borders, dim hints | `colors.muted` (or add `colors.borderDim`) |
| `#c0caf5` | Bold tool names, default text | `colors.text` |
| `#a9b1d6` | Expanded tool result text | `colors.textMuted` |
| `#f7768e` | Errors, file ops | `colors.error` |
| `#ff9e64` | Bash, edits | `colors.warning` |
| `#2ac3de` | Search tools | Add `colors.teal` or derive |
| `#bb9af7` | Grimoire tools | Add `colors.purple` or derive |
| `#7dcfff` | Web tools | Add `colors.cyan` or derive |
| `#e0af68` | Default tool | `colors.warning` |
| `#1a1b26` | Background | `colors.bg` |

---

## Pattern 5: Smart Margin and Visual Spacing

### Current Kapy State
- User/system messages: `marginTop={1}`
- Tool calls: `marginTop={0}`
- Tool results: `marginLeft={2}`
- Assistant: `paddingLeft={1} marginTop={1}`
- No smart margin based on adjacent message types

### OpenCode Pattern
- `InlineTool` calculates margin based on previous sibling type — adds breathing room after text parts or taller blocks
- Thinking block adds `marginTop={1}` only when preceded by other content
- BlockTool always gets `marginTop={1}`

### Adoption Target
- [ ] Add smart margin: tool calls after assistant text get no extra space; after user messages get `marginTop={1}`
- [ ] Consecutive tool calls: no margin between them (visual grouping)
- [ ] Tool result immediately after its tool call: indented together, no gap

---

## Pattern 6: Streaming Indicators

### Current Kapy State
- Assistant streaming: `●` character after content
- Bottom status: `"thinking..."` while agent streaming

### OpenCode Pattern
- `Spinner` component for running tools (animated)
- `streaming={true}` on `<code>` for incremental character rendering of thinking text
- Web UI: `TextShimmer` sweep gradient animation on "Thinking..." text and running tool titles
- Web UI: `TextReveal` mask-wipe animation showing reasoning headings

### Adoption Target
- [ ] Use `<spinner>` component for tools in running state (if available in opentui)
- [ ] Add `streaming` prop to thinking `<code>` for incremental rendering
- [ ] Consider animated `●` cursor (pulse/blink) for assistant streaming

---

## Pattern 7: Click-to-Copy and Interaction

### Current Kapy State
- All messages support click-to-copy via OSC52
- No keyboard interaction (expand/collapse) for messages
- No selection awareness beyond try/catch guard

### OpenCode Pattern
- Click to expand/collapse tool details
- Click to navigate to subagent sessions (Task tool)
- Selection-aware: don't copy if text is selected
- Copy button on error cards (web UI)

### Adoption Target
- [ ] Wire expand/collapse to Enter key when message is focused
- [ ] Selection-aware click: skip copy if terminal has selection (already guarded)
- [ ] Consider focused message concept for keyboard-driven expand

---

## Research Backlog

Patterns to investigate as we continue:

- **Context tool grouping** (OpenCode web groups Read/Glob/Grep into "Gathered context" — should we adopt this for TUI?)
- **Animated transitions** (spring physics for expand/collapse, mask-wipe for headings — feasible in opentui?)
- **Tool-specific formatters** (Read shows `↳ Loaded filepath`, Bash shows command + truncated output, Edit shows diff)
- **Session turn model** (OpenCode wraps each agent turn in a `SessionTurn` with status/progress — could improve our message grouping)
- **Permission gating UI** (OpenCode shows pending/denied states for tools awaiting approval — we have beforeToolCall hooks but no UI)
- **Multiple session tabs** (OpenCode web has concurrent sessions — relevant to Kapy's multi-session architecture?)
- **Theme system** (full theme switching like OpenCode's 35+ themes vs our single token set)

---

## Architecture Notes

### Msg Type Evolution

The current `Msg` interface (`tui/types.ts:53-62`) needs to evolve to support richer tool states. The target shape likely merges `tool_call` and `tool_result` into a unified `tool` role with a status lifecycle:

```ts
export interface Msg {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  streaming?: boolean;
  reasoning?: string;
  // Tool-specific fields (when role === "tool")
  toolName?: string;
  toolArgs?: string;       // extracted args, not raw "⟹ name(json)"
  toolStatus?: "pending" | "running" | "completed" | "error" | "denied";
  toolResult?: string;     // populated on completion
  // Display hints
  queued?: boolean;
}
```

This matches OpenCode's `ToolPart` model where one entity tracks the full lifecycle.

### Event Bridge Changes

`use-chat.ts` currently emits tool_call and tool_result as separate Msgs. The bridge needs to:

1. On `tool_execution_start`: create a `tool` Msg with `toolStatus: "running"`
2. On `tool_execution_end`: update that Msg with `toolStatus: "completed"` and `toolResult`
3. On `message_end` with toolResult content: update the existing tool Msg (not create a new one)

This requires tracking tool calls by ID so results can be matched back. The `toolCallId` from `ToolResultMessage` maps to the `id` from `ToolCall`.