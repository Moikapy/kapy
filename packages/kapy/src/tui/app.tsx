import { createCliRenderer, type KeyBinding } from "@opentui/core";
import { render, useTerminalDimensions, useKeyboard } from "@opentui/solid";
import { createSignal, createEffect, batch, Show, createContext, useContext, type ParentComponent } from "solid-js";

type RD = { type: "home" } | { type: "session"; sid: string };
const RC = createContext<{ data: () => RD; navigate: (r: RD) => void }>();
const RP: ParentComponent = (props) => {
  const [d, setD] = createSignal<RD>({ type: "home" });
  return <RC.Provider value={{ data: d, navigate: (r) => setD(r) }}>{props.children}</RC.Provider>;
};

const KB: KeyBinding[] = [{ name: "return", action: "submit" }, { name: "return", shift: true, action: "newline" }];
const MODEL = "glm-5.1:cloud";
const SYS_MSG = "You are Kapy, an agent-first CLI assistant. Be concise and direct.";

// Load project context from AGENTS.md
function loadProjectCtx(): string {
  try {
    const fs = require("fs"); const path = require("path");
    const cwd = process.cwd();
    for (const d of [cwd, path.dirname(cwd), path.dirname(path.dirname(cwd))]) {
      try { return fs.readFileSync(path.join(d, "AGENTS.md"), "utf-8"); } catch {}
    }
  } catch {}
  return "";
}
const projectCtx = loadProjectCtx();
const sysPrompt = projectCtx ? `${SYS_MSG}\n\n# Project Context\n${projectCtx}` : SYS_MSG;


async function fetchModels(): Promise<string[]> {
  try { const r = await fetch("http://localhost:11434/v1/models"); const d = await r.json(); return (d.data||[]).map((m:any)=>m.id).sort(); }
  catch { return []; }
}

// Lazy-loaded tool infrastructure (avoids module eval issues with OpenTUI)
let _toolSchemas: unknown[] | null = null;
async function getToolSchemas(): Promise<unknown[]> {
  if (!_toolSchemas) {
    const { ToolRegistry, readFileTool, writeFileTool, bashTool, globTool, grepTool } = await import("../tool/index.js");
    const { zodToJsonSchema } = await import("../tool/zod-to-json-schema.js");
    const reg = new ToolRegistry();
    reg.register(readFileTool); reg.register(writeFileTool); reg.register(bashTool); reg.register(globTool); reg.register(grepTool);
    _toolSchemas = reg.all().map(t => ({
      type: "function" as const,
      function: { name: t.name, description: t.description, parameters: t.parameters ? zodToJsonSchema(t.parameters) : { type: "object", properties: {} } },
    }));
  }
  return _toolSchemas;
}

async function executeTool(name: string, argsJson: string): Promise<string> {
  const { ToolRegistry, readFileTool, writeFileTool, bashTool, globTool, grepTool } = await import("../tool/index.js");
  const reg = new ToolRegistry();
  reg.register(readFileTool); reg.register(writeFileTool); reg.register(bashTool); reg.register(globTool); reg.register(grepTool);
  const tool = reg.get(name);
  if (!tool) return `Error: Tool "${name}" not found`;
  try {
    const args = JSON.parse(argsJson);
    const result = await tool.execute(`call_${Date.now()}`, args, undefined as any, () => {}, { cwd: process.cwd() });
    return typeof result === "string" ? result : (result as any)?.output ?? JSON.stringify(result);
  } catch (err) { return `Error: ${err instanceof Error ? err.message : String(err)}`; }
}

interface Msg { id: string; role: "user" | "assistant" | "system" | "tool_call" | "tool_result"; content: string; streaming?: boolean; reasoning?: string; toolName?: string }

// Module-level renderer ref so useKeyboard can call destroy on exit
let _renderer: any = null;

function App() {
  const route = useContext(RC)!;
  const dims = useTerminalDimensions();

  // Global key handler — Ctrl+C/D exits even when textarea is focused
  useKeyboard((evt: any) => {
    if (evt.ctrl && (evt.name === "c" || evt.name === "d")) {
      try { _renderer?.destroy(); } catch {}
      setTimeout(() => process.exit(0), 50);
    }
  });
  const [sidebar, setSidebar] = createSignal(false);
  const [msgs, setMsgs] = createSignal<Msg[]>([]);
  const [streaming, setStreaming] = createSignal(false);
  const [err, setErr] = createSignal("");
  const [inputVal, setInputVal] = createSignal("");
  const [model, setModel] = createSignal(MODEL);
  const [models, setModels] = createSignal<string[]>([]);

  let abortCtrl: AbortController | null = null;
  let ref: any; let sessRef: any; let scrollRef: any;

  // Auto-scroll to bottom on new messages
  createEffect(() => { if (msgs().length > 0) setTimeout(() => scrollRef?.scrollTo?.(99999), 50); });

  const send = async (text: string) => {
    if (!text.trim() || streaming()) return;
    const userMsg = text.trim();
    batch(() => { setMsgs(p => [...p, { id: "u"+Date.now(), role: "user", content: userMsg }]); setErr(""); });
    if (route.data().type === "home") route.navigate({ type: "session", sid: "s"+Date.now() });
    setStreaming(true); abortCtrl = new AbortController();

    const apiMsgs: Array<{role: string; content: string; tool_call_id?: string}> = [
      { role: "system", content: sysPrompt },
      ...msgs().filter(m => m.role !== "tool_call" && m.role !== "tool_result").map(m => ({ role: m.role, content: m.content })),
      { role: "user", content: userMsg },
    ];

    const MAX_ROUNDS = 10;
    try {
      for (let round = 0; round < MAX_ROUNDS; round++) {
        const aId = "a"+Date.now()+"_"+round;
        setMsgs(p => [...p, { id: aId, role: "assistant", content: "", streaming: true }]);
        let full = ""; let reasoning = "";
        const toolCalls: Array<{id: string; name: string; args: string}> = [];

        // Build request body with tool schemas
        const body: Record<string, unknown> = { model: model(), messages: apiMsgs, stream: true, temperature: 0.7, max_tokens: 4096 };
        try {
          const schemas = await getToolSchemas();
          if (schemas.length > 0) body.tools = schemas;
        } catch {} // tool schemas are optional

        const res = await fetch("http://localhost:11434/v1/chat/completions", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body), signal: abortCtrl.signal,
        });
        if (!res.ok) throw new Error("Ollama: " + (await res.text().catch(() => res.statusText)));
        if (!res.body) throw new Error("No body");

        const rd = res.body.getReader(); const dec = new TextDecoder(); let buf = "";
        try {
          while (true) { const { done, value } = await rd.read(); if (done) break;
            buf += dec.decode(value, { stream: true }); const ls = buf.split("\n"); buf = ls.pop() || "";
            for (const l of ls) { const d = l.startsWith("data: ") ? l.slice(6) : l; if (d === "[DONE]") break;
              try { const p = JSON.parse(d); const delta = p.choices?.[0]?.delta;
                if (delta?.content) full += delta.content;
                if (delta?.reasoning_content) reasoning += delta.reasoning_content;
                if (delta?.tool_calls) { for (const tc of delta.tool_calls) {
                  const ex = toolCalls.find(t => t.id === tc.id);
                  if (ex) { if (tc.function?.arguments) ex.args += tc.function.arguments; }
                  else { toolCalls.push({ id: tc.id ?? `call_${Date.now()}`, name: tc.function?.name ?? "", args: tc.function?.arguments ?? "" }); }
                } }
                setMsgs(p => { const u=[...p]; const i=u.findIndex(m=>m.id===aId); if(i!==-1) u[i]={...u[i],content:full,streaming:true,reasoning:reasoning||undefined}; return u; });
              } catch {}
            }
          }
        } finally { rd.releaseLock(); }

        setMsgs(p => { const u=[...p]; const i=u.findIndex(m=>m.id===aId); if(i!==-1) u[i]={...u[i],streaming:false}; return u; });

        if (toolCalls.length === 0) break; // No tool calls, we're done

        // Execute tool calls
        apiMsgs.push({ role: "assistant", content: full });
        for (const tc of toolCalls) {
          const toolMsg = `⟹ ${tc.name}(${tc.args.length > 80 ? tc.args.slice(0,77)+"..." : tc.args})`;
          setMsgs(p => [...p, { id: "t"+Date.now(), role: "tool_call", content: toolMsg, toolName: tc.name }]);
          const result = await executeTool(tc.name, tc.args);
          const preview = result.length > 200 ? result.slice(0,197)+"..." : result;
          setMsgs(p => [...p, { id: "r"+Date.now(), role: "tool_result", content: preview, toolName: tc.name }]);
          apiMsgs.push({ role: "tool", content: result, tool_call_id: tc.id });
        }
      }
    } catch (e: any) { if (e.name !== "AbortError") setErr(e instanceof Error ? e.message : String(e)); }
    finally { setStreaming(false); abortCtrl = null; }
  };
  const abort = () => { if (abortCtrl) { abortCtrl.abort(); abortCtrl = null; } };
  const onKey = (evt: any) => {
    if (evt.ctrl && evt.name === "\\") setSidebar(v=>!v);
    if (evt.name === "escape") { if (streaming()) abort(); else if (route.data().type === "session") route.navigate({type:"home"}); }
  };
  const isSlash = (t: string): boolean => {
    const c = t.trim().toLowerCase();
    if (c === "/sidebar" || c === "/sb") { setSidebar(v=>!v); return true; }
    if (c === "/clear") { setMsgs([]); return true; }
    if (c === "/models") {
      fetchModels().then(names => { setModels(names); setSidebar(true); })
        .catch(() => setErr("Failed to fetch models"));
      return true;
    }
    // /model <name> to switch
    const modelMatch = t.trim().match(/^\/model\s+(.+)$/i);
    if (modelMatch) { setModel(modelMatch[1].trim()); return true; }
    if (c === "/tools") {
      import("../tool/index.js").then(m => {
        const names = [m.readFileTool.name, m.writeFileTool.name, m.bashTool.name, m.globTool.name, m.grepTool.name].join(", ");
        batch(() => { setMsgs(p => [...p, { id: "t"+Date.now(), role: "system", content: `Available tools: ${names}` }]); });
      });
      return true;
    }
    if (c === "/help") {
      batch(() => {
        setMsgs(p => [...p,
          { id: "h"+Date.now(), role: "system", content: "Commands:\n  /help     Show this help\n  /model X   Switch to model X\n  /models    List available models\n  /tools     List registered tools\n  /sidebar   Toggle sidebar\n  /clear     Clear chat\n  exit       Quit kapy" }
        ]);
      });
      return true;
    }
    return false;
  };

  return (
    <box width={dims().width} height={dims().height} backgroundColor="#1a1b26" flexDirection="column">
      <box flexDirection="row" flexGrow={1} minHeight={0}>
        <box flexGrow={1} minWidth={0}>
          <Show when={route.data().type === "home"}>
            <box flexDirection="column" alignItems="center" paddingLeft={2} paddingRight={2} flexGrow={1}>
              <box flexGrow={1} minHeight={0} />
              <ascii_font text="KAPY" font="tiny" color="#00AAFF" />
              <text fg="#565f89">agent-first cli</text>
              <box height={1} />
              <box border={["left"]} borderColor="#00AAFF" width="100%" maxWidth={72}>
                <box paddingLeft={2} paddingTop={1} backgroundColor="#22223a">
                  <textarea focused placeholder="Ask anything..." placeholderColor="#565f89"
                    textColor="#c0caf5" focusedTextColor="#c0caf5" focusedBackgroundColor="#22223a"
                    cursorColor="#c0caf5" minHeight={1} maxHeight={4} keyBindings={KB}
                    onContentChange={() => { if (ref) setInputVal(ref.plainText); }}
                    onKeyDown={onKey}
                    onSubmit={() => { const t=inputVal().trim(); if (!t||streaming()) return; setInputVal(""); if (ref) ref.clear(); send(t); }}
                    ref={(r2: any) => { ref = r2; setTimeout(() => r2?.focus(), 10); }}
                  />
                </box>
              </box>
              <box flexGrow={1} minHeight={0} />
            </box>
          </Show>
          <Show when={route.data().type === "session"}>
            <box flexDirection="column" height="100%" paddingLeft={2} paddingRight={2}>
              <scrollbox ref={(r: any) => { scrollRef = r; }} flexGrow={1} minHeight={0}>
                <box height={1} />
                <Show when={msgs().length === 0}><text fg="#565f89">No messages yet.</text></Show>
                {msgs().map(m => {
                  if (m.role === "user") return <box border={["left"]} borderColor="#00AAFF" marginTop={1} flexShrink={0}><box paddingTop={1} paddingBottom={1} paddingLeft={2} backgroundColor="#1a1a2e"><text fg="#c0caf5">{m.content}</text></box></box>;
                  if (m.role === "system") return <box paddingLeft={3} marginTop={1} flexShrink={0}><text fg="#7aa2f7">{m.content}</text></box>;
                  if (m.role === "tool_call") return <box border={["left"]} borderColor="#e0af68" marginTop={1} flexShrink={0}><box paddingLeft={2} paddingTop={1} paddingBottom={1} backgroundColor="#2a2a1e"><text fg="#e0af68">{"⚙ "}{m.content}</text></box></box>;
                  if (m.role === "tool_result") return <box border={["left"]} borderColor="#565f89" marginTop={1} flexShrink={0}><box paddingLeft={2} paddingTop={1} paddingBottom={1} backgroundColor="#1a1a2a"><text fg="#a9b1d6">{"↳ "}{m.content}</text></box></box>;
                  return <box paddingLeft={3} marginTop={1} flexShrink={0}>
                    {(m.reasoning ?? "") !== "" && <box><text fg="#565f89" italic>{m.reasoning}</text></box>}
                    <text fg="#9ece6a">{m.content}{m.streaming ? " ●" : ""}</text>
                  </box>;
                })}
                <box height={2} />
              </scrollbox>
              <Show when={err().length > 0}><text fg="#f7768e">Error: {err()}</text></Show>
              <box flexShrink={0}>
                <box border={["left"]} borderColor="#00AAFF" width="100%">
                  <box paddingLeft={2} paddingRight={2} paddingTop={1} backgroundColor="#22223a">
                    <textarea focused placeholder="Message..." placeholderColor="#565f89" textColor="#c0caf5"
                      focusedTextColor="#c0caf5" focusedBackgroundColor="#22223a" cursorColor="#c0caf5"
                      minHeight={1} maxHeight={4} keyBindings={KB}
                      onContentChange={() => { if (sessRef) setInputVal(sessRef.plainText); }}
                      onKeyDown={onKey}
                      onSubmit={() => { setTimeout(()=>setTimeout(()=>{
                        const t=inputVal().trim(); if (!t) return;
                        if (t==="exit"||t===":q") { try { _renderer?.destroy(); } catch {} setTimeout(() => process.exit(0), 50); return; }
                        if (t.startsWith("/")&&isSlash(t)) { setInputVal(""); if(sessRef) sessRef.clear(); return; }
                        setInputVal(""); if(sessRef) sessRef.clear(); send(t);
                      },0),0); }}
                      ref={(r2: any) => { sessRef = r2; setTimeout(() => r2?.focus(), 10); }}
                    />
                    <Show when={streaming()}><text fg="#565f89">thinking...</text></Show>
                  </box>
                </box>
              </box>
            </box>
          </Show>
        </box>
        <Show when={sidebar()}>
          <box backgroundColor="#1a1a2e" width={36} paddingTop={1} paddingBottom={1} paddingLeft={2} paddingRight={2} flexShrink={0}>
            <text fg="#c0caf5" bold>Session</text>
            <text fg="#565f89">Current chat</text>
            <box height={1} />
            <text fg="#00AAFF">▸ Model</text>
            <text fg="#c0caf5">  {model()}</text>
            <box height={1} />
            <text fg="#00AAFF">▸ Messages</text>
            <text fg="#c0caf5">  {msgs().length}</text>
            <box height={1} />
            <text fg="#00AAFF">▸ Tools</text>
            <text fg="#c0caf5">  5</text>
            <box height={1} />
            <text fg="#00AAFF">▸ Commands</text>
            <text fg="#565f89">  /sidebar /clear</text>
            <text fg="#565f89">  exit      quit</text>
            <box height={1} />
            <text fg="#00AAFF">▸ Keys</text>
            <text fg="#565f89">  ctrl+\ sidebar</text>
            <text fg="#565f89">  esc abort/home</text>
            <Show when={models().length > 0}>
              <box height={1} />
              <text fg="#00AAFF">▸ Models</text>
              {models().map(m => <text fg="#565f89">  {m}</text>)}
            </Show>
          </box>
        </Show>
      </box>
      <box flexDirection="row" justifyContent="space-between" paddingLeft={2} paddingRight={2} flexShrink={0}>
        <text fg="#565f89">~/kapy</text>
        <text fg="#565f89">⊙ ollama · {model()}</text>
      </box>
    </box>
  );
}

export async function launchChatTUI(): Promise<void> {
	if (!process.stdout.isTTY) {
		console.error("TUI requires an interactive terminal (TTY).");
		return;
	}
	const renderer = await createCliRenderer({
		externalOutputMode: "passthrough" as const,
		targetFps: 60,
		gatherStats: false,
		exitOnCtrlC: false,
		useKittyKeyboard: {},
		autoFocus: true,
		openConsoleOnError: false,
	});
	_renderer = renderer;
	const cleanup = () => { try { renderer.destroy(); } catch {} };
	process.on("SIGHUP", () => { cleanup(); setTimeout(() => process.exit(0), 50); });
	process.on("SIGINT", () => { cleanup(); setTimeout(() => process.exit(0), 50); });
	process.on("SIGTERM", () => { cleanup(); setTimeout(() => process.exit(0), 50); });
	await render(() => <RP><App /></RP>, renderer);
}
