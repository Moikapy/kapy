# AI Harness Spec — Kapy

> Status: **Draft**  
> Author: Moikapy + Shalom 🐉  
> Date: 2026-04-13  
> Updated: 2026-04-13 (v3 — pi-aligned internals, OpenCode TUI, Ollama auto-detect)

## What This Is

A **harness** is deterministic execution infrastructure that wraps around an AI model to manage its lifecycle, context, tools, memory, and safety. The model is the brain. The harness is everything else.

Kapy as a harness provides:
- **Tool management** — typed schemas, execution, permission gates
- **Context management** — session persistence, compaction, project knowledge
- **Safety/guardrails** — per-tool permission rules, dry-run, confirmation
- **State persistence** — tree-structured sessions, branch, resume
- **Memory** — AGENTS.md, project context, cross-session knowledge
- **LLM provider discovery** — auto-detect installed models (like pi-ollama)

The harness is model-agnostic. It doesn't call any LLM directly — but it provides the adapter layer so any LLM can plug in.

**Phase 6 adds agent mode** — a built-in LLM loop that uses harness APIs internally. The harness is complete without it.

## 1. LLM Provider System (pi-aligned)

Following pi's `@mariozechner/pi-ai` architecture: unified multi-provider API with automatic model discovery.

### 1.1 Provider Interface

```ts
interface Provider {
  id: string;                           // "ollama", "ollama-cloud", "openai", "anthropic"
  name: string;                         // "Ollama Local", "OpenAI"
  models: ProviderModelConfig[];         // available models
  stream: StreamFn;                     // LLM streaming function
}

interface ProviderModelConfig {
  id: string;                           // "gemma3" or "gemma3:cloud"
  name: string;                         // display name with emoji badges
  api: string;                          // "openai-completions" | "anthropic" | etc.
  contextWindow: number;               // max context tokens
  maxTokens: number;                   // max output tokens
  cost: { input: number; output: number; cacheRead: number; cacheWrite: number };
  input: ("text" | "image")[];          // input modalities
  reasoning: boolean;                   // supports extended thinking
}

type StreamFn = (options: StreamOptions) => EventStream<AssistantMessageEvent, Message[]>;

interface StreamOptions {
  model: string;
  messages: Message[];
  tools?: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  thinkingLevel?: ThinkingLevel;
  // ...provider-specific options
}

type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high";
```

### 1.2 Ollama Auto-Detection (pi-ollama pattern)

The Ollama provider follows the same pattern as `@0xkobold/pi-ollama`:

1. **Auto-detect local Ollama** by hitting `http://localhost:11434/api/tags`
2. **Query `/api/show` for each model** to get accurate context length, capabilities, parameter size
3. **Detect vision/reasoning** from capabilities and model metadata
4. **Register discovered models** as available providers
5. **Cloud Ollama** support with API key
6. **Config hierarchy**: env vars > `kapy.config.ts` > `~/.kapy/config.json`

```ts
// kapy.config.ts
export default defineConfig({
  ai: {
    providers: {
      ollama: {
        baseUrl: "http://localhost:11434",
        cloudUrl: "https://ollama.com",
        apiKey: undefined,  // or env KAPY_OLLAMA_API_KEY
      },
      openai: {
        apiKey: undefined,  // or env KAPY_OPENAI_API_KEY
        models: ["gpt-4o", "gpt-4o-mini"],
      },
      anthropic: {
        apiKey: undefined,  // or env KAPY_ANTHROPIC_API_KEY
        models: ["claude-sonnet-4-20250514"],
      },
    },
  },
});
```

**Discovery flow:**
```ts
async function discoverProviders(config: AIConfig): Promise<Provider[]> {
  const providers: Provider[] = [];

  // 1. Ollama local — auto-detect
  const ollamaLocal = await discoverOllamaLocal(config.providers.ollama);
  if (ollamaLocal) providers.push(ollamaLocal);

  // 2. Ollama cloud — if API key present
  if (config.providers.ollama.apiKey) {
    const ollamaCloud = await discoverOllamaCloud(config.providers.ollama);
    if (ollamaCloud) providers.push(ollamaCloud);
  }

  // 3. Configured providers (OpenAI, Anthropic, etc.)
  for (const [id, providerConfig] of Object.entries(config.providers)) {
    if (id === "ollama") continue; // already handled
    if (!providerConfig.apiKey) continue;
    providers.push(createConfiguredProvider(id, providerConfig));
  }

  // 4. Extensions can register custom providers
  return providers;
}
```

**`/api/show` details extraction** (same as pi-ollama):
```ts
async function fetchModelDetails(modelName: string, baseUrl: string): Promise<ModelDetails | null> {
  try {
    const response = await fetch(`${baseUrl}/api/show`, {
      method: "POST",
      body: JSON.stringify({ model: modelName, verbose: true }),
    });
    return await response.json();
  } catch {
    return null;
  }
}

function getContextLength(details: ModelDetails): number {
  // Extract from model_info.*.context_length
  // Fallback: heuristic from parameter size, then from model name
}

function hasVisionCapability(details: ModelDetails): boolean {
  // Check capabilities array for "vision"
  // Check model_info for clip.has_vision_encoder
  // Check general.architecture for llava, bakllava, moondream
}
```

### 1.3 Extension Provider Registration

Extensions can register custom providers, just like pi-ollama registers itself:

```ts
// Extension: kapy-provider-bedrock
export function register(api: KapyExtensionAPI) {
  api.registerProvider("bedrock", {
    name: "Amazon Bedrock",
    models: [
      { id: "claude-sonnet-4", name: "Claude Sonnet 4", api: "anthropic", contextWindow: 200000, ... },
    ],
    stream: bedrockStreamFn,
  });
}
```

### 1.4 Provider Commands

```bash
kapy provider list                    # List all available providers and models
kapy provider status                  # Check connection status for each provider
kapy provider info <model>           # Show detailed model info (like /ollama-info)
kapy provider detect                  # Auto-detect providers and models
```

## 2. Agent Loop (pi-aligned)

Following pi's `@mariozechner/pi-agent-core` architecture: `Agent` class with steering/follow-up queues, `AgentTool<T>` with Zod parameters, `AgentMessage` union type, `EventStream<AgentEvent>` for UI updates.

### 2.1 Core Types

```ts
// Following pi-agent-core's AgentMessage pattern
type AgentMessage =
  | { role: "user"; content: string; images?: ImageContent[]; timestamp: number }
  | { role: "assistant"; content: string; toolCalls?: ToolCall[]; timestamp: number }
  | { role: "toolResult"; toolCallId: string; content: string; isError: boolean; timestamp: number }
  | { role: "system"; content: string; timestamp: number };

// Following pi-agent-core's AgentTool pattern
interface KapyTool<TParams extends z.ZodType = z.ZodType> {
  name: string;
  description: string | ((agent: AgentInfo) => string);  // Dynamic per agent
  parameters: TParams;
  execute: (args: z.infer<TParams>, ctx: KapyToolContext) => Promise<KapyToolResult>;
  isReadOnly?: (input: z.infer<TParams>) => boolean;
  isConcurrencySafe?: (input: z.infer<TParams>) => boolean;
  checkPermissions?: (input: z.infer<TParams>) => PermissionCheck;
}

interface KapyToolResult {
  output: string;
  title: string;
  metadata?: Record<string, unknown>;
}

// Following pi-agent-core's AgentEvent pattern
type KapyEvent =
  | { type: "agent_start" }
  | { type: "agent_end"; messages: AgentMessage[] }
  | { type: "turn_start" }
  | { type: "turn_end"; message: AgentMessage; toolResults: AgentMessage[] }
  | { type: "message_start"; message: AgentMessage }
  | { type: "message_update"; message: AgentMessage; delta: string }
  | { type: "message_end"; message: AgentMessage }
  | { type: "tool_execution_start"; toolCallId: string; toolName: string; args: unknown }
  | { type: "tool_execution_update"; toolCallId: string; partial: unknown }
  | { type: "tool_execution_end"; toolCallId: string; result: unknown; isError: boolean }
  | { type: "permission_request"; tool: string; pattern: string; input: unknown }
  | { type: "compaction_start" }
  | { type: "compaction_end"; summary: string };
```

### 2.2 Agent Class (pi-aligned)

```ts
class KapyAgent {
  // State (following pi's AgentState pattern)
  private state: AgentState;
  private steeringQueue: AgentMessage[];
  private followUpQueue: AgentMessage[];
  private abortController: AbortController | null;

  // Configuration
  private providers: Provider[];
  private tools: KapyTool[];
  private permissions: PermissionConfig;
  private session: SessionManager;
  private memory: MemoryStore;

  // Events (following pi's EventStream pattern)
  private listeners: Set<(event: KapyEvent) => void>;

  // Following pi's Agent API
  setSystemPrompt(prompt: string): void;
  setModel(model: string): void;
  setThinkingLevel(level: ThinkingLevel): void;
  setTools(tools: KapyTool[]): void;

  // Steering (from pi: interrupts agent mid-run)
  steer(message: AgentMessage): void;

  // Follow-up (from pi: waits until agent finishes)
  followUp(message: AgentMessage): void;

  // Prompt the agent
  prompt(input: string, images?: ImageContent[]): Promise<void>;

  // Continue from current context (for retries)
  continue(): Promise<void>;

  // Abort current execution
  abort(): void;

  // Wait for agent to finish current work
  waitForIdle(): Promise<void>;

  // Subscribe to events
  subscribe(fn: (event: KapyEvent) => void): () => void;

  // Context management (from pi's transformContext pattern)
  setContextTransformer(fn: (messages: AgentMessage[]) => Promise<AgentMessage[]>): void;
}
```

### 2.3 Named Agents (OpenCode pattern)

```ts
interface AgentInfo {
  name: string;
  description: string;
  mode: "primary" | "subagent";
  model?: { provider: string; model: string };
  prompt?: string;
  permission: PermissionConfig;
  steps?: number;           // max tool calls per turn
  temperature?: number;
  color?: string;           // TUI display color
}

// Built-in agents (following OpenCode's pattern)
const BUILT_IN_AGENTS: Record<string, AgentInfo> = {
  build: {
    name: "build",
    description: "Default agent. Full access, asks on destructive ops.",
    mode: "primary",
    permission: {
      "*": "allow",
      install: "ask",
      remove: "ask",
      deploy: "ask",
    },
  },
  plan: {
    name: "plan",
    description: "Read-only agent for analysis and planning.",
    mode: "primary",
    permission: {
      "*": "deny",
      read: "allow",
      glob: "allow",
      grep: "allow",
      list: "allow",
    },
  },
};
```

Users switch agents with `Tab` (in TUI). Extensions register custom agents via `api.addAgent()`.

## 3. Tool Interface

### 3.1 Schema Command

```bash
kapy schema --json        # Full registry with types + agentHints
kapy schema --tools       # Tools only (agent-consumable)
kapy schema --commands    # Commands only
```

### 3.2 Fix `--json` Gaps

Every builtin must produce structured JSON. NDJSON for streaming events.

### 3.3 `ctx.emit()` for Structured Events

```ts
ctx.emit("progress", { step: "downloading", percent: 40 });
ctx.emit("log", { level: "info", message: "Installing dependencies..." });
```

In `--json` mode: NDJSON on stdout. In TUI: updates the message component.

### 3.4 `addTool()` API with Zod

```ts
api.addTool({
  name: "analyze-bundle",
  description: "Analyze bundle size",
  parameters: z.object({
    path: z.string().describe("Path to analyze"),
    threshold: z.number().optional().describe("Size threshold in KB"),
  }),
  isReadOnly: () => true,
  checkPermissions: (input) => ({ granted: true }),
  execute: async (params, ctx) => ({
    output: JSON.stringify(result),
    title: `Bundle analysis: ${params.path}`,
    metadata: { totalSize: result.totalSize },
  }),
});
```

### 3.5 Invocation

```bash
kapy call install --input '{"source": "my-ext", "trust": true}'
kapy call deploy:aws --input '{"env": "staging"}' --stream
kapy call deploy:aws --input '{"env": "staging"}' --dry-run
```

## 4. Permission System (pi-aligned)

Pi doesn’t have a built-in permission rules engine. Instead, **extensions hook into the `tool_call` event** and decide whether to block or allow. Kapy follows the same pattern.

### 4.1 Event-Driven Permission (pi pattern)

Extensions register `tool_call` hooks that can block tool execution — same as pi:

```ts
// Built-in permission extension (kapy ships with this)
export default function permissionExtension(api: KapyExtensionAPI) {
  api.addHook("tool_call", async (event, ctx) => {
    // Block dangerous bash commands
    if (event.toolName === "bash") {
      const command = event.input.command as string;
      if (/\brm\s+(-rf?|--recursive)/i.test(command)) {
        if (!ctx.isInteractive) {
          return { block: true, reason: "Dangerous command blocked (no UI for confirmation)" };
        }
        const choice = await ctx.confirm(`⚠️ Dangerous command:\n\n  ${command}\n\nAllow?`);
        if (!choice) return { block: true, reason: "Blocked by user" };
      }
    }
    return undefined; // allow
  });
}
```

### 4.2 Config-Driven Rules (built-in extension)

Kapy ships a built-in permission extension that reads config-based rules. This is like OpenCode's declarative format, but implemented as an extension hook (pi pattern):

```ts
// kapy.config.ts
export default defineConfig({
  permission: {
    "*": "allow",           // default: allow everything
    install: "ask",          // ask before installing
    remove: "ask",            // ask before removing
    deploy: "ask",            // ask before deploying
    config: {
      "*": "allow",          // allow most config reads
      ".env": "ask",         // ask for .env files
      ".env.*": "ask",      // ask for .env.* files
    },
  },
});
```

Evaluation follows OpenCode's `findLast` rule: last matching rule wins, patterns support wildcards:

```ts
function evaluate(permission: string, pattern: string, rules: Rule[]): Rule {
  return rules.findLast(
    (rule) => wildcardMatch(permission, rule.permission) && wildcardMatch(pattern, rule.pattern)
  ) ?? { action: "ask", permission, pattern: "*" };
}
```

Named agents have their own permission rulesets that layer on top of the default config (OpenCode pattern).

### 4.3 Tool Metadata (Claude Code pattern)

Tools declare safety properties that permission hooks can use:

```ts
interface KapyTool<TParams extends z.ZodType = z.ZodType> {
  name: string;
  // ... existing fields
  isReadOnly?: (input: z.infer<TParams>) => boolean;
  isConcurrencySafe?: (input: z.infer<TParams>) => boolean;
  renderInvocation?: (input: any) => string;    // TUI rendering
  renderResult?: (result: ToolResult) => string;  // TUI rendering
}
```

### 4.4 Non-Interactive Mode

`--no-input` → `ask` becomes `deny` (can't prompt the user).
`--dry-run` → everything becomes a no-op with description.

### 4.5 Event Hook API (pi pattern)

```ts
// Full event hook system — same semantics as pi
type ToolCallEvent = {
  toolName: string;
  toolCallId: string;
  input: Record<string, unknown>;  // mutable — can patch
};

type ToolResultEvent = {
  toolName: string;
  toolCallId: string;
  input: Record<string, unknown>;
  result: {
    content: (TextContent | ImageContent)[];
    isError: boolean;
  };
};

api.addHook("tool_call", async (event, ctx) => {
  // Mutate event.input to patch arguments before execution
  // Return { block: true, reason: "..." } to block
  // Return undefined to allow
});

api.addHook("tool_result", async (event, ctx) => {
  // Modify result before sending to LLM
  // Return { content: [...], details: {...}, isError: true/false }
});
```

## 5. Session Management (pi pattern)

Tree-structured JSONL sessions with `id` + `parentId` per entry:

```ts
interface SessionEntry {
  id: string;
  parentId: string | null;
  role: "user" | "assistant" | "tool" | "system";
  content: string;
  phase?: "thought" | "action" | "observation";  // for session tree display
  toolCalls?: ToolCall[];
  timestamp: string;
  metadata?: Record<string, unknown>;
}
```

Stored as JSONL at `~/.kapy/sessions/{id}.jsonl`.

Forking, branching, resuming — all from the tree structure (pi pattern).

### Compaction

Auto-summarize when approaching context limit. Manual via `/compact`. Customizable via extensions (pi pattern). The full history remains in JSONL; compaction only affects what's sent to the LLM.

## 6. Memory

```bash
kapy memory get --json                 # All project + global knowledge
kapy memory set deployment.last "staging.example.com"
kapy memory search "deployment" --json
```

Under the hood: `~/.kapy/memory.json` (global) + `.kapy/memory.json` (project-local).

Plus AGENTS.md loading from `~/.kapy/AGENTS.md` + parent directories (pi pattern).

## 7. Dispatch Rule

```bash
kapy                        → Agent REPL (if ai.enabled, else help)
kapy "deploy staging"       → Agent single-shot
kapy install my-ext          → CLI command (exact match, unchanged)
kapy -- "run tests"          → Force agent mode
kapy provider list           → Provider management
kapy session list            → Session management
kapy schema --json           → Schema discovery
kapy context --json          → Project context for agents
kapy call <tool> --input     → Tool invocation
kapy memory <subcommand>     → Memory management
```

## 8. TUI Chat Screen (OpenCode-inspired)

Following OpenCode's TUI architecture: built on `@opentui/core` + Solid reconciler, same components kapy already uses.

### Route structure
```
home    → Landing with logo + prompt input + rotating suggestions
session → Chat interface (the main agent screen)
```

### Session Screen Layout

```
┌──────────────────────────────────────────────────────────┐
│  🐹 kapy  [build ▾] │ ctx: 42% │ $0.03 │ ollama/gemma3 │  ← header
├────────────┬─────────────────────────────────────────────┤
│ 📂 Sidebar │                                             │
│ ├── Files  │  💭 I need to set up auth. Let me start    │
│ ├── LSP    │     by scaffolding the project...           │
│ ├── MCP    │                                             │
│ └── Todos  │  🔧 kapy init auth --template service     │
│            │  ✓ Done                                      │
│            │                                             │
│ Press ?    │  💭 Good, now linting and tests...          │
│ for help   │                                             │
│            │  🐹 Auth service ready at ./auth. Deploy?   │
│            │                                             │
│            │  👤 _                                        │
├────────────┴─────────────────────────────────────────────┤
│  ↑hist  Tab=agent  Enter=steer  Shift+Enter=follow  Esc  │
└──────────────────────────────────────────────────────────┘
```

### Key TUI features

1. **Message queue** (pi pattern):
   - `Enter` → steering message (delivered after current tool calls finish)
   - `Shift+Enter` → follow-up message (delivered after agent finishes all work)
   - `Escape` → abort + restore queued messages

2. **Visible thought traces** (ReAct):
   - `💭` blocks before tool calls
   - Collapsible via `Ctrl+T`

3. **Tool call visualization** (Claude Code pattern):
   - `🔧` for invocation, `✓`/`✗` for result
   - Each tool defines `renderInvocation()` + `renderResult()`
   - Collapsible via `Ctrl+O`

4. **Agent switching** (OpenCode pattern):
   - `Tab` cycles between named agents (build ↔ plan)
   - Current agent + model shown in header

5. **Session nav** (pi pattern):
   - `/tree` opens branch navigator
   - `/fork` creates new session from branch point
   - `/compact` manually compacts context

6. **Home screen** (OpenCode pattern):
   - Logo + centered prompt input
   - Rotating placeholder suggestions
   - Entering prompt routes to session screen

7. **Sidebar** (OpenCode pattern):
   - Files, LSP diagnostics, MCP servers, Todos
   - Collapsible
   - Extension slot for custom panels (`api.addScreen()`)

8. **Provider status in header**:
   - Shows current model + provider (e.g., `ollama/gemma3`)
   - Context usage percentage
   - Cost tracking

### Component API

```tsx
// kapy-components (new additions)
MessageList      // Scrollable message list with virtualization
MessageInput     // Input with steering/follow-up queue indicator
MessageEntry     // Single message (thought/action/observation)
ToolCall         // Tool invocation + result display
Sidebar          // Collapsible sidebar
AgentBadge       // Agent name + permission indicator
ProviderStatus   // Model + provider + context + cost
```

## 9. Config

```ts
// kapy.config.ts
export default defineConfig({
  ai: {
    enabled: true,
    defaultMode: "agent",           // "agent" | "cli"
    defaultAgent: "build",          // which agent starts in REPL
    provider: "ollama",             // fallback if no models found
    model: undefined,               // uses first discovered model
    maxTurns: 10,                   // max tool call loops per request
    maxRecovery: 3,                 // max recovery loops on error
    compaction: true,               // auto-compact on context overflow

    providers: {
      ollama: {
        baseUrl: "http://localhost:11434",
        cloudUrl: "https://ollama.com",
        apiKey: undefined,          // or env KAPY_OLLAMA_API_KEY
      },
      openai: {
        apiKey: undefined,          // or env KAPY_OPENAI_API_KEY
        models: ["gpt-4o", "gpt-4o-mini"],
      },
      anthropic: {
        apiKey: undefined,          // or env KAPY_ANTHROPIC_API_KEY
        models: ["claude-sonnet-4-20250514"],
      },
    },
  },

  agents: {
    build: {
      description: "Default agent. Full access, asks on destructive ops.",
      permission: { "*": "allow", install: "ask", remove: "ask", deploy: "ask" },
    },
    plan: {
      description: "Read-only agent for analysis and planning.",
      permission: { "*": "deny", read: "allow", glob: "allow", grep: "allow", list: "allow" },
    },
  },
});
```

Environment: `KAPY_AI_*` prefix for all AI config. `KAPY_OLLAMA_HOST`, `KAPY_OLLAMA_API_KEY`, `KAPY_OPENAI_API_KEY`, etc.

## 10. File Structure

```
packages/kapy/src/
├── ai/
│   ├── agent.ts              # KapyAgent class (pi-aligned: steering, followUp, events)
│   ├── agent-loop.ts         # Core loop (pi-aligned: EventStream, turn management)
│   ├── types.ts              # AgentMessage, KapyEvent, KapyTool, AgentInfo
│   ├── providers/
│   │   ├── registry.ts       # Provider discovery and registration
│   │   ├── ollama.ts         # Ollama adapter (pi-ollama pattern: auto-detect, /api/show)
│   │   ├── openai.ts         # OpenAI-compatible adapter
│   │   ├── anthropic.ts      # Anthropic adapter
│   │   └── custom.ts         # User-configured endpoints
│   ├── session/
│   │   ├── manager.ts        # Tree-structured session CRUD (JSONL, id+parentId)
│   │   ├── compaction.ts     # Auto/manual context compaction
│   │   └── types.ts          # SessionEntry types
│   ├── memory/
│   │   ├── store.ts          # Key-value + search memory store
│   │   └── agents-md.ts      # AGENTS.md loading (walking parent dirs)
│   ├── permissions.ts         # Per-tool per-pattern permission system
│   ├── schema.ts             # Schema generation (command + tool registry)
│   ├── context.ts             # Project context generation
│   └── commands.ts            # CLI commands (schema, context, session, memory, call, provider)
├── command/
│   ├── context.ts             # ctx.emit() addition
│   └── parser.ts              # existing (AgentHints, Zod for tools)
├── tui/
│   └── screens/
│       ├── home.tsx            # Revised: logo + prompt + suggestions
│       ├── session.tsx        # New: chat interface (main agent screen)
│       └── ...                # existing screens
├── extension/
│   ├── api.ts                 # addTool(), addAgent(), registerProvider()
│   └── types.ts               # updated interfaces
└── components/ (in kapy-components)
    ├── message-list.tsx        # Scrollable message list
    ├── message-input.tsx       # Input with queue indicator
    ├── message-entry.tsx       # Single message rendering
    ├── tool-call.tsx           # Tool invocation + result display
    ├── sidebar.tsx             # Collapsible sidebar
    ├── agent-badge.tsx          # Agent name + permission indicator
    └── provider-status.tsx      # Model + context + cost display
```

## 11. Extension API (pi-aligned)

Following pi's `ExtensionAPI` pattern: same events, same method signatures, same context objects.

### 11.1 KapyExtensionAPI

```ts
interface KapyExtensionAPI {
  // === Pi-compatible methods ===

  // Subscribe to events (same as pi.on)
  on(event: string, handler: EventHandler): void;

  // Register a custom tool callable by the LLM (pi.registerTool)
  registerTool(definition: KapyToolRegistration): void;

  // Register a slash command (pi.registerCommand)
  registerCommand(name: string, options: CommandRegistration): void;

  // Register an LLM provider (pi.registerProvider)
  registerProvider(id: string, config: ProviderRegistration): void;
  unregisterProvider(id: string): void;

  // Send messages into the session (pi.sendMessage / pi.sendUserMessage)
  sendMessage(message: AgentMessage, options?: SendMessageOptions): void;
  sendUserMessage(content: string, options?: SendMessageOptions): void;

  // Append a custom entry to session (pi.appendEntry)
  appendEntry(customType: string, data: Record<string, unknown>): void;

  // Session management (pi.setSessionName / pi.getSessionName / pi.setLabel)
  setSessionName(name: string): void;
  getSessionName(): string;
  setLabel(entryId: string, label: string): void;

  // Register a keyboard shortcut (pi.registerShortcut)
  registerShortcut(shortcut: string, options: ShortcutOptions): void;

  // Register a flag (pi.registerFlag)
  registerFlag(name: string, options: FlagOptions): void;

  // Active tools (pi.getActiveTools / pi.getAllTools / pi.setActiveTools)
  getActiveTools(): KapyToolRegistration[];
  getAllTools(): KapyToolRegistration[];
  setActiveTools(names: string[]): void;

  // Model control (pi.setModel / pi.getThinkingLevel / pi.setThinkingLevel)
  setModel(model: string): void;
  getThinkingLevel(): ThinkingLevel;
  setThinkingLevel(level: ThinkingLevel): void;

  // Execute a command programmatically (pi.exec)
  exec(command: string, args?: string[], options?: ExecOptions): Promise<ExecResult>;

  // === Kapy-specific additions (not in pi) ===

  // Register a named agent
  addAgent(agent: AgentInfo): void;

  // Add a permission rule (convenience for built-in permission extension)
  addPermissionRule(tool: string, pattern: string, action: PermissionAction): void;

  // Middleware (kapy-specific, not in pi)
  addMiddleware(middleware: Middleware): void;

  // Config schema (kapy-specific)
  declareConfig(schema: ConfigSchema): void;

  // TUI screen (kapy-specific)
  addScreen(screen: ScreenDefinition): void;
}
```

### 11.2 Full Event System (pi-aligned)

Every event from pi's extension system, with the same semantics:

```ts
// === Resource Events ===

// Fired after session start / reload. Extensions contribute skill/prompt/theme paths.
api.on("resources_discover", async (event, ctx) => {
  // event.reason - "startup" | "reload"
  return { skillPaths: [...], promptPaths: [...], themePaths: [...] };
});

// === Session Events ===

api.on("session_start", async (event, ctx) => {
  // event.reason - "startup" | "reload" | "new" | "resume" | "fork"
  // event.previousSessionFile - for "new", "resume", "fork"
});

api.on("session_before_switch", async (event, ctx) => {
  // event.reason - "new" | "resume"
  // return { cancel: true } to cancel
});

api.on("session_before_fork", async (event, ctx) => {
  // event.entryId - entry being forked from
  // return { cancel: true } or { skipConversationRestore: true }
});

api.on("session_before_compact", async (event, ctx) => {
  // return { cancel: true } to cancel
  // return { compaction: { summary, firstKeptEntryId, tokensBefore } } for custom
});

api.on("session_compact", async (event, ctx) => {
  // Compaction completed
});

api.on("session_before_tree", async (event, ctx) => {
  // return { cancel: true } to cancel tree navigation
});

api.on("session_tree", async (event, ctx) => {
  // event.newLeafId, oldLeafId
});

api.on("session_shutdown", async (event, ctx) => {
  // Cleanup on exit
});

// === Agent Events ===

api.on("before_agent_start", async (event, ctx) => {
  // event.prompt, event.images, event.systemPrompt
  // return { message: {...}, systemPrompt: "..." } to inject context
});

api.on("agent_start", async (event, ctx) => {});
api.on("agent_end", async (event, ctx) => {
  // event.messages - messages from this prompt
});

api.on("turn_start", async (event, ctx) => {});
api.on("turn_end", async (event, ctx) => {
  // event.message, event.toolResults
});

// Message-level events (for TUI updates)
api.on("message_start", async (event, ctx) => {});
api.on("message_update", async (event, ctx) => {});
api.on("message_end", async (event, ctx) => {});

// Context: modify messages before each LLM call (pi's transformContext)
api.on("context", async (event, ctx) => {
  // event.messages - deep copy, safe to modify
  // return { messages: filtered } to replace
});

// Payload inspection/replacement before provider request
api.on("before_provider_request", async (event, ctx) => {
  // event.payload - provider-specific payload
  // return modified payload to replace
});

// Tool execution lifecycle
api.on("tool_execution_start", async (event, ctx) => {});
api.on("tool_execution_update", async (event, ctx) => {
  // event.partialResult for streaming tool updates
});
api.on("tool_execution_end", async (event, ctx) => {});

// === Tool Events (the important ones for permissions) ===

// Before tool executes. CAN BLOCK. event.input is mutable.
api.on("tool_call", async (event, ctx) => {
  // event.toolName, event.toolCallId, event.input (mutable)
  // Mutate event.input to patch arguments
  // return { block: true, reason: "..." } to block
  // return undefined to allow
});

// After tool executes. CAN MODIFY RESULT.
api.on("tool_result", async (event, ctx) => {
  // event.toolName, event.toolCallId, event.input
  // event.content, event.details, event.isError
  // return { content, details, isError } to patch result
});

// === Model Events ===

api.on("model_select", async (event, ctx) => {
  // event.model, event.previousModel, event.source ("set" | "cycle" | "restore")
});

// === Input Events ===

api.on("input", async (event, ctx) => {
  // event.text - raw input before skill/template expansion
  // event.images, event.source ("interactive" | "rpc" | "extension")
  // return { action: "transform", text: "..." } to rewrite input
  // return { action: "handled" } to skip LLM
  // return { action: "continue" } to pass through
});

// === User Bash Events ===

api.on("user_bash", async (event, ctx) => {
  // event.command, event.cwd, event.excludeFromContext
  // return { operations: {...} } for custom bash backend
  // return { result: {...} } to provide result directly
});
```

### 11.3 ExtensionContext (pi-aligned)

```ts
interface ExtensionContext {
  // UI interaction (pi's ctx.ui)
  ui: {
    notify(message: string, type?: "info" | "error" | "warning"): void;
    confirm(title: string, message: string): Promise<boolean>;
    select(message: string, options: string[]): Promise<string>;
    input(message: string): Promise<string>;
    custom(component: unknown): void; // full TUI component
  };

  // Whether TUI is available (false in --json / --no-input / pipe mode)
  hasUI: boolean;

  // Current working directory
  cwd: string;

  // Read-only session access (pi's ctx.sessionManager)
  sessionManager: SessionManager;

  // Model registry and current model
  modelRegistry: ModelRegistry;
  model: Model;

  // Abort signal for the current agent turn
  signal: AbortSignal | undefined;

  // Agent state queries
  isIdle(): boolean;
  abort(): void;
  hasPendingMessages(): boolean;
  getThinkingLevel(): ThinkingLevel;
  setThinkingLevel(level: ThinkingLevel): void;

  // Context usage
  getContextUsage(): { percent: number; tokensUsed: number; tokensMax: number };

  // System prompt access
  getSystemPrompt(): string;

  // Compaction trigger
  compact(): Promise<void>;

  // Session shutdown
  shutdown(): void;
}
```

### 11.4 KapyToolRegistration (pi-aligned)

```ts
interface KapyToolRegistration {
  name: string;
  label: string;                   // display name (pi pattern)
  description: string;
  promptSnippet?: string;          // one-liner added to "Available tools" (pi pattern)
  promptGuidelines?: string[];     // appended to Guidelines section (pi pattern)
  parameters: z.ZodType;           // Zod schema (pi uses TypeBox, we use Zod)
  prepareArguments?: (args: any) => any;  // compatibility shim before validation (pi pattern)
  execute: (toolCallId: string, params: any, signal: AbortSignal | undefined, onUpdate: ToolUpdateCallback, ctx: ExtensionContext) => Promise<ToolResult>;
}

interface ToolResult {
  content: (TextContent | ImageContent)[];
  details: Record<string, unknown>;
}

type ToolUpdateCallback = (partialResult: ToolResult) => void;
```

## 12. Implementation Phases

### Phase 1: Tool Interface
- `kapy schema --json` — serialize registry
- Fix `--json` gaps in all builtins
- `ctx.emit()` for NDJSON events
- `KapyTool` with Zod schemas + `addTool()`
- `kapy call <tool> --input` — structured invocation
- `--dry-run` flag

### Phase 2: Provider System + Ollama Auto-Detect
- Provider registry with auto-detection
- Ollama adapter (pi-ollama pattern: detect, `/api/show`, model badges)
- OpenAI + Anthropic adapters
- `kapy provider list/status/info/detect`
- Extension `registerProvider()` API

### Phase 3: Permission System
- Per-tool per-pattern `allow/ask/deny`
- `isReadOnly()`, `isConcurrencySafe()`, `checkPermissions()`
- `--no-input` → `ask` becomes `deny`

### Phase 4: Session + Context Management
- Tree-structured JSONL sessions
- `kapy session` commands
- `kapy context --json`
- Compaction API

### Phase 5: Agent Loop + Named Agents
- `KapyAgent` class (pi-aligned: steering, followUp, events)
- Named agents (build, plan, custom)
- `addAgent()` extension API
- ReAct system prompt

### Phase 6: TUI Chat (OpenCode-inspired)
- Home screen (logo + prompt + suggestions)
- Session screen (messages + sidebar + tool calls)
- Message queue (steering + follow-up)
- Agent switching (Tab)
- Provider status in header
- `/tree`, `/fork`, `/compact` commands
- Message components in kapy-components

### Phase 7: Memory
- Key-value + search memory store
- `kapy memory` commands
- Global + project-local memory

## 13. Alignment with Pi

| Pattern | Pi Implementation | Kapy Implementation |
|---------|-------------------|---------------------|
| LLM API | `@mariozechner/pi-ai` — unified multi-provider | Same pattern — `Provider` + `StreamFn` + `EventStream` |
| Agent loop | `@mariozechner/pi-agent-core` — `Agent` class | Same pattern — `KapyAgent` with steering/followUp/events |
| Ollama detection | `@0xkobold/pi-ollama` — auto-detect, `/api/show`, badges | Same pattern — same code, adapted for kapy |
| Sessions | JSONL with `id`+`parentId`, branching | Same pattern |
| Steering | `Enter` = steering, `Shift+Enter` = follow-up | Same pattern |
| Compaction | Auto + manual, customizable | Same pattern |
| Tools | TypeScript types + Effect-TS | Zod (equivalent validation + JSON schema gen) |
| Permissions | Per-tool per-pattern allow/ask/deny | Same pattern (from OpenCode) |
| Skills | agentskills.io format | Same format |
| AGENTS.md | Walk parent dirs, concatenate | Same pattern |
| Extensions | `register()` + `meta` exports | Same pattern, extended with `addTool/addAgent/registerProvider` |

## 14. Open Questions

- **Pi-ai dependency?** Should kapy depend on `@mariozechner/pi-ai` directly, or reimplement the provider adapter pattern? **Lean toward reimplementation** — kapy is lighter weight and the adapter pattern is simple. Pi-ai is ~8K lines.
- **Effect-TS?** OpenCode uses Effect-TS heavily. Kapy uses plain TypeScript. Keep it simple — no Effect-TS dependency.
- **Zod vs TypeBox?** Pi uses TypeBox (`@sinclair/typebox`). OpenCode uses Zod. Kapy should use **Zod** for tool schemas (better TypeScript inference + JSON schema generation).
- **Session storage format?** JSONL with `id`+`parentId`. Easy to append, supports branching, easy to parse.
- **Memory backend?** Start with JSON files. Future: SQLite for search.
- **MCP compatibility?** Harness tool interface should be mappable to MCP. Future work.
- **Client/server split?** Design the AI module API boundary now (same as pi's SDK mode). Start single-process.