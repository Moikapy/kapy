/**
 * Full Kapy TUI with Ollama streaming chat.
 * 
 * This is a WIP file — it compiles fine but the TUI renders blank
 * due to an unknown OpenTUI/Solid JSX rendering issue.
 * 
 * The proven working base is in app.tsx (98 lines, home + sidebar).
 * To debug: add features to app.tsx ONE AT A TIME and test after each.
 * 
 * Known findings:
 * - useKeyboard() from @opentui/solid causes blank TUI render
 * - SidebarProvider as separate context causes issues
 * - Sub-components that receive signal function props may cause issues
 * - The 98-line inline App() with local signals is the proven pattern
 * 
 * Features when it works:
 * - Home → Session navigation on first message
 * - Ollama streaming via /v1/chat/completions
 * - Message display with streaming indicator
 * - Toggleable sidebar via /sidebar or Ctrl+\
 * - Error display, abort on Escape
 */

export {}; // This file is not currently used — see app.tsx for the working TUI

import { createCliRenderer, type CliRendererConfig, type KeyBinding } from "@opentui/core";
import { render, useTerminalDimensions } from "@opentui/solid";
import { createSignal, createEffect, createMemo, batch, Show, For, Switch, Match, createContext, useContext, type ParentComponent } from "solid-js";

type RD = { type: "home" } | { type: "session"; sessionID: string };
const RC = createContext<{ data: () => RD; navigate: (r: RD) => void }>();
const RP: ParentComponent = (props) => {
  const [d, setD] = createSignal<RD>({ type: "home" });
  return <RC.Provider value={{ data: d, navigate: setD }}>{props.children}</RC.Provider>;
};

const KB: KeyBinding[] = [{ name: "return", action: "submit" }, { name: "return", shift: true, action: "newline" }];
const DEFAULT_MODEL = "glm-5.1:cloud";
const SYS_MSG = "You are Kapy, an agent-first CLI assistant. Be concise and direct.";
const SIDEBAR_W = 36;

interface API { role: string; content: string }
async function* streamOllama(model: string, messages: API[], signal?: AbortSignal): AsyncGenerator<string> {
  const res = await fetch("http://localhost:11434/v1/chat/completions", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, stream: true }), signal,
  });
  if (!res.ok) throw new Error(`Ollama: ${await res.text().catch(() => res.statusText)}`);
  if (!res.body) throw new Error("No body");
  const reader = res.body.getReader(), dec = new TextDecoder();
  let buf = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      for (const line of buf.split("\n")) {
        buf = buf.slice(buf.indexOf("\n") + 1);
        const d = line.startsWith("data: ") ? line.slice(6) : line;
        if (d === "[DONE]") return;
        try { const p = JSON.parse(d); if (p.choices?.[0]?.delta?.content) yield p.choices[0].delta.content; } catch {}
      }
    }
  } finally { reader.releaseLock(); }
}

interface Msg { id: string; role: "user" | "assistant" | "system"; content: string; streaming?: boolean }

function App() {
  const route = useContext(RC)!;
  const dims = useTerminalDimensions();
  const [sidebar, setSidebar] = createSignal(false);
  const [messages, setMessages] = createSignal<Msg[]>([]);
  const [isStreaming, setIsStreaming] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  let abortCtrl: AbortController | null = null;
  let homeRef: any; const [homeInput, setHomeInput] = createSignal("");
  let sessRef: any; const [sessInput, setSessInput] = createSignal("");
  let scrollRef: any;

  createEffect(() => {
    if (messages().length > 0) setTimeout(() => scrollRef?.scrollTo?.(scrollRef?.scrollHeight ?? 99999), 50);
  });

  const send = async (text: string) => {
    if (!text.trim() || isStreaming()) return;
    if (route.data().type === "home") route.navigate({ type: "session", sessionID: `s${Date.now()}` });
    batch(() => { setMessages(p => [...p, { id: `u${Date.now()}`, role: "user", content: text.trim() }]); setError(null); });
    setIsStreaming(true); abortCtrl = new AbortController();
    const aId = `a${Date.now()}`;
    setMessages(p => [...p, { id: aId, role: "assistant", content: "", streaming: true }]);
    try {
      const apiMsgs: API[] = [{ role: "system", content: SYS_MSG }, ...messages().map(m => ({ role: m.role, content: m.content })), { role: "user", content: text.trim() }];
      let full = "";
      for await (const chunk of streamOllama(DEFAULT_MODEL, apiMsgs, abortCtrl.signal)) {
        full += chunk;
        setMessages(p => { const u = [...p]; const i = u.findIndex(m => m.id === aId); if (i !== -1) u[i] = { ...u[i], content: full, streaming: true }; return u; });
      }
      setMessages(p => { const u = [...p]; const i = u.findIndex(m => m.id === aId); if (i !== -1) u[i] = { ...u[i], streaming: false }; return u; });
    } catch (e: any) {
      if (e.name !== "AbortError") { setError(e instanceof Error ? e.message : String(e)); setMessages(p => p.filter(m => m.id !== aId || m.content)); }
    } finally { setIsStreaming(false); abortCtrl = null; }
  };

  const abort = () => { if (abortCtrl) { abortCtrl.abort(); abortCtrl = null; } };
  const handleKey = (evt: any) => {
    if (evt.ctrl && evt.name === "\\") { setSidebar(v => !v); }
    if (evt.name === "escape") {
      if (isStreaming()) abort();
      else if (route.data().type === "session") route.navigate({ type: "home" });
    }
  };
  const handleSlash = (t: string): boolean => {
    const cmd = t.trim().toLowerCase();
    if (cmd === "/sidebar" || cmd === "/sb") { setSidebar(v => !v); return true; }
    if (cmd === "/clear" || cmd === "/cls") { setMessages([]); return true; }
    return false;
  };

  const mc = createMemo(() => messages().length);
  const uc = createMemo(() => messages().filter(m => m.role === "user").length);

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
                <box paddingLeft={2} paddingRight={2} paddingTop={1} backgroundColor="#22223a">
                  <textarea focused placeholder='Ask anything... "Fix a TODO"' placeholderColor="#565f89"
                    textColor="#c0caf5" focusedTextColor="#c0caf5" focusedBackgroundColor="#22223a"
                    cursorColor="#c0caf5" minHeight={1} maxHeight={4} keyBindings={KB}
                    onContentChange={() => { if (homeRef) setHomeInput(homeRef.plainText); }}
                    onKeyDown={handleKey}
                    onSubmit={() => { const t = homeInput().trim(); if (!t||isStreaming()) return; setHomeInput(""); if (homeRef) homeRef.clear(); send(t); }}
                    ref={(r2: any) => { homeRef = r2; setTimeout(() => r2?.focus(), 10); }}
                  />
                  <box flexDirection="row" paddingTop={1} gap={1}>
                    <text fg="#00AAFF">⟩</text>
                    <text fg="#c0caf5">kapy · {DEFAULT_MODEL}</text>
                    <Show when={isStreaming()}><text fg="#565f89">thinking...</text></Show>
                  </box>
                </box>
              </box>
              <box height={2} />
              <text fg="#565f89"><text fg="#00AAFF">enter</text> send · <text fg="#00AAFF">shift+enter</text> newline</text>
              <text fg="#565f89"><text fg="#00AAFF">ctrl+\</text> sidebar · <text fg="#00AAFF">esc</text> abort · <text fg="#00AAFF">ctrl+c</text> quit</text>
              <box flexGrow={1} minHeight={0} />
            </box>
          </Show>
          <Show when={route.data().type === "session"}>
            <box flexDirection="column" height="100%" paddingLeft={2} paddingRight={2}>
              <scrollbox ref={(r: any) => { scrollRef = r; }} flexGrow={1} minHeight={0}>
                <box height={1} />
                <For each={messages()}>
                  {(m) => <Switch>
                    <Match when={m.role === "user"}>
                      <box border={["left"]} borderColor="#00AAFF" marginTop={1} flexShrink={0}>
                        <box paddingTop={1} paddingBottom={1} paddingLeft={2} backgroundColor="#1a1a2e"><text fg="#c0caf5">{m.content}</text></box>
                      </box>
                    </Match>
                    <Match when={m.role === "assistant"}>
                      <box paddingLeft={3} marginTop={1} flexShrink={0}>
                        <text fg="#c0caf5">{m.content}<Show when={m.streaming}><text fg="#00AAFF"> ●</text></Show></text>
                      </box>
                    </Match>
                  </Switch>}
                </For>
                <Show when={isStreaming()}>
                  <box paddingLeft={3} marginTop={1} flexShrink={0}><text fg="#00AAFF">● <text fg="#565f89">thinking...</text></text></box>
                </Show>
                <box height={2} />
              </scrollbox>
              <Show when={error() !== null}>
                <box paddingLeft={3} paddingBottom={1} flexShrink={0}><text fg="#f7768e">Error: {error()}</text></box>
              </Show>
              <box flexShrink={0}>
                <box border={["left"]} borderColor="#00AAFF" width="100%">
                  <box paddingLeft={2} paddingRight={2} paddingTop={1} backgroundColor="#22223a">
                    <textarea focused placeholder="Message..." placeholderColor="#565f89"
                      textColor="#c0caf5" focusedTextColor="#c0caf5" focusedBackgroundColor="#22223a"
                      cursorColor={isStreaming() ? "#444466" : "#c0caf5"}
                      minHeight={1} maxHeight={4} keyBindings={KB}
                      onContentChange={() => { if (sessRef) setSessInput(sessRef.plainText); }}
                      onKeyDown={handleKey}
                      onSubmit={() => { setTimeout(() => setTimeout(() => {
                        const t = sessInput().trim(); if (!t) return;
                        if (t==="exit"||t===":q") { process.exit(0); return; }
                        if (t.startsWith("/")&&handleSlash(t)) { setSessInput(""); if (sessRef) sessRef.clear(); return; }
                        setSessInput(""); if (sessRef) sessRef.clear(); send(t);
                      },0),0); }}
                      ref={(r2: any) => { sessRef = r2; setTimeout(() => r2?.focus(), 10); }}
                    />
                    <box flexDirection="row" paddingTop={1} gap={1}>
                      <text fg="#00AAFF">⟩</text>
                      <text fg="#c0caf5">kapy · {DEFAULT_MODEL}</text>
                      <Show when={isStreaming()}><text fg="#565f89">thinking...</text></Show>
                    </box>
                  </box>
                </box>
              </box>
            </box>
          </Show>
        </box>
        <Show when={sidebar()}>
          <box backgroundColor="#1a1a2e" width={SIDEBAR_W} height="100%" paddingTop={1} paddingBottom={1} paddingLeft={2} paddingRight={2} flexShrink={0}>
            <scrollbox flexGrow={1}>
              <box flexShrink={0} gap={1} paddingRight={1}>
                <text fg="#c0caf5"><b>Session</b></text>
                <text fg="#565f89">Current chat</text>
                <box height={1} />
                <text fg="#565f89"><text fg="#00AAFF">▸</text> Model</text>
                <text fg="#c0caf5">  {DEFAULT_MODEL}</text>
                <box height={1} />
                <text fg="#565f89"><text fg="#00AAFF">▸</text> Messages</text>
                <text fg="#c0caf5">  {mc()} total · {uc()} user</text>
                <box height={1} />
                <text fg="#565f89"><text fg="#00AAFF">▸</text> Commands</text>
                <text fg="#565f89">  /sidebar  toggle panel</text>
                <text fg="#565f89">  /clear    clear chat</text>
                <text fg="#565f89">  exit      quit kapy</text>
                <box height={1} />
                <text fg="#565f89"><text fg="#00AAFF">▸</text> Keybinds</text>
                <text fg="#565f89">  ctrl+\    toggle sidebar</text>
                <text fg="#565f89">  esc       abort / home</text>
                <text fg="#565f89">  ctrl+c    quit</text>
              </box>
            </scrollbox>
            <box flexShrink={0} paddingTop={1}>
              <text fg="#565f89"><text fg="#9ece6a">•</text> <b>Ka</b><text fg="#c0caf5"><b>py</b></text> v0.2.0</text>
            </box>
          </box>
        </Show>
      </box>
      <box flexDirection="row" justifyContent="space-between" paddingLeft={2} paddingRight={2} flexShrink={0}>
        <text fg="#565f89">~/kapy</text>
        <text fg="#565f89">⊙ ollama · <text fg="#c0caf5">{DEFAULT_MODEL}</text></text>
      </box>
    </box>
  );
}

async function _launchChatTUI(): Promise<void> {
  if (!process.stdout.isTTY) { console.error("TUI requires TTY."); return; }
  const renderer = await createCliRenderer({
    externalOutputMode: "passthrough" as const, targetFps: 60, gatherStats: false, exitOnCtrlC: false,
    useKittyKeyboard: {}, autoFocus: true, openConsoleOnError: false,
  });
  const cleanup = () => { try { renderer.destroy(); } catch {} };
  process.on("SIGHUP", () => { cleanup(); process.exit(0); });
  process.on("SIGINT", () => { cleanup(); process.exit(0); });
  process.on("SIGTERM", () => { cleanup(); process.exit(0); });
  await render(() => <RP><App /></RP>, renderer);
}