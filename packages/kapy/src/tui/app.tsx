import { createCliRenderer, type KeyBinding } from "@opentui/core";
import { render, useTerminalDimensions } from "@opentui/solid";
import { createSignal, batch, Show, createContext, useContext, type ParentComponent } from "solid-js";

type RD = { type: "home" } | { type: "session"; sid: string };
const RC = createContext<{ data: () => RD; navigate: (r: RD) => void }>();
const RP: ParentComponent = (props) => {
  const [d, setD] = createSignal<RD>({ type: "home" });
  return <RC.Provider value={{ data: d, navigate: (r) => setD(r) }}>{props.children}</RC.Provider>;
};

const KB: KeyBinding[] = [{ name: "return", action: "submit" }, { name: "return", shift: true, action: "newline" }];
const MODEL = "glm-5.1:cloud";

interface API { role: string; content: string }
async function* streamOllama(model: string, msgs: API[], sig?: AbortSignal): AsyncGenerator<string> {
  const res = await fetch("http://localhost:11434/v1/chat/completions", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages: msgs, stream: true }), signal: sig,
  });
  if (!res.ok) throw new Error("Ollama: " + (await res.text().catch(() => res.statusText)));
  if (!res.body) throw new Error("No body");
  const rd = res.body.getReader(), dec = new TextDecoder(); let buf = "";
  try {
    while (true) { const { done, value } = await rd.read(); if (done) break;
      buf += dec.decode(value, { stream: true }); const ls = buf.split("\n"); buf = ls.pop() || "";
      for (const l of ls) { const d = l.startsWith("data: ") ? l.slice(6) : l; if (d === "[DONE]") return;
        try { const p = JSON.parse(d); if (p.choices?.[0]?.delta?.content) yield p.choices[0].delta.content; } catch {} } }
  } finally { rd.releaseLock(); }
}

interface Msg { id: string; role: "user" | "assistant"; content: string }

function App() {
  const route = useContext(RC)!;
  const dims = useTerminalDimensions();
  const [sidebar, setSidebar] = createSignal(false);
  const [msgs, setMsgs] = createSignal<Msg[]>([]);
  const [streaming, setStreaming] = createSignal(false);
  const [err, setErr] = createSignal("");
  const [inputVal, setInputVal] = createSignal("");
  let abortCtrl: AbortController | null = null;
  let ref: any; let sessRef: any; let scrollRef: any;

  const send = async (text: string) => {
    if (!text.trim() || streaming()) return;
    const userMsg = text.trim();
    batch(() => { setMsgs(p => [...p, { id: "u"+Date.now(), role: "user", content: userMsg }]); setErr(""); });
    if (route.data().type === "home") route.navigate({ type: "session", sid: "s"+Date.now() });
    setStreaming(true); abortCtrl = new AbortController();
    const aId = "a"+Date.now();
    setMsgs(p => [...p, { id: aId, role: "assistant", content: "" }]);
    try {
      const apiMsgs: API[] = [...msgs().map(m => ({ role: m.role, content: m.content })), { role: "user", content: userMsg }];
      let full = "";
      for await (const chunk of streamOllama(MODEL, apiMsgs, abortCtrl.signal)) {
        full += chunk;
        setMsgs(p => { const u=[...p]; const i=u.findIndex(m=>m.id===aId); if(i!==-1) u[i]={...u[i],content:full}; return u; });
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
    return false;
  };

  return (
    <box width={dims().width} height={dims().height} backgroundColor="#1a1b26" flexDirection="column">
      <box flexDirection="row" flexGrow={1} minHeight={0}>
        <box flexGrow={1} minWidth={0}>
          <Show when={route.data().type === "home"}>
            <box flexDirection="column" alignItems="center" paddingLeft={2} paddingRight={2} flexGrow={1}>
              <box flexGrow={1} minHeight={0} />
              <text fg="#00AAFF" bold>KAPY</text>
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
                  <box flexDirection="row" paddingTop={1} gap={1}>
                    <text fg="#00AAFF">⟩</text>
                    <text fg="#c0caf5">kapy · {MODEL}</text>
                  </box>
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
                {msgs().map(m =>
                  m.role === "user"
                    ? <box border={["left"]} borderColor="#00AAFF" marginTop={1} flexShrink={0}><box paddingTop={1} paddingBottom={1} paddingLeft={2} backgroundColor="#1a1a2e"><text fg="#c0caf5">{m.content}</text></box></box>
                    : <box paddingLeft={3} marginTop={1} flexShrink={0}><text fg="#9ece6a">{m.content}</text></box>
                )}
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
                        if (t==="exit"||t===":q") { process.exit(0); return; }
                        if (t.startsWith("/")&&isSlash(t)) { setInputVal(""); if(sessRef) sessRef.clear(); return; }
                        setInputVal(""); if(sessRef) sessRef.clear(); send(t);
                      },0),0); }}
                      ref={(r2: any) => { sessRef = r2; setTimeout(() => r2?.focus(), 10); }}
                    />
                    <box flexDirection="row" paddingTop={1} gap={1}>
                      <text fg="#00AAFF">⟩</text>
                      <text fg="#c0caf5">kapy · {MODEL}</text>
                      <Show when={streaming()}><text fg="#565f89">thinking...</text></Show>
                    </box>
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
            <text fg="#c0caf5">  {MODEL}</text>
            <box height={1} />
            <text fg="#00AAFF">▸ Messages</text>
            <text fg="#c0caf5">  {msgs().length}</text>
            <box height={1} />
            <text fg="#00AAFF">▸ Commands</text>
            <text fg="#565f89">  /sidebar /clear</text>
            <text fg="#565f89">  exit      quit</text>
            <box height={1} />
            <text fg="#00AAFF">▸ Keys</text>
            <text fg="#565f89">  ctrl+\ sidebar</text>
            <text fg="#565f89">  esc abort/home</text>
          </box>
        </Show>
      </box>
      <box flexDirection="row" justifyContent="space-between" paddingLeft={2} paddingRight={2} flexShrink={0}>
        <text fg="#565f89">~/kapy</text>
        <text fg="#565f89">⊙ ollama · {MODEL}</text>
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
	const cleanup = () => { try { renderer.destroy(); } catch {} };
	process.on("SIGHUP", () => { cleanup(); process.exit(0); });
	process.on("SIGINT", () => { cleanup(); process.exit(0); });
	process.on("SIGTERM", () => { cleanup(); process.exit(0); });
	await render(() => <RP><App /></RP>, renderer);
}
