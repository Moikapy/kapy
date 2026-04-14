import { createCliRenderer, type KeyBinding } from "@opentui/core";
import { render, useTerminalDimensions } from "@opentui/solid";
import { createSignal, createContext, useContext, type ParentComponent, Show } from "solid-js";

type RD = { type: "home" } | { type: "session" };
const RC = createContext<{ data: () => RD; navigate: (r: RD) => void }>();
const RP: ParentComponent = (props) => {
  const [d, setD] = createSignal<RD>({ type: "home" });
  return <RC.Provider value={{ data: d, navigate: (r) => setD(r) }}>{props.children}</RC.Provider>;
};

const KB: KeyBinding[] = [{ name: "return", action: "submit" }, { name: "return", shift: true, action: "newline" }];

function HomeView(props: { onSend: (t: string) => void }) {
  let ref: any;
  const [input, setInput] = createSignal("");
  return (
    <box flexDirection="column" alignItems="center" paddingLeft={2} paddingRight={2} flexGrow={1}>
      <box flexGrow={1} minHeight={0} />
      <text fg="#00AAFF" bold>KAPY</text>
      <text fg="#565f89">agent-first cli</text>
      <box height={1} />
      <box border={["left"]} borderColor="#00AAFF" width="100%" maxWidth={72}>
        <box paddingLeft={2} paddingTop={1} backgroundColor="#22223a">
          <textarea
            focused placeholder="Ask anything..." placeholderColor="#565f89" textColor="#c0caf5"
            focusedTextColor="#c0caf5" focusedBackgroundColor="#22223a" cursorColor="#c0caf5"
            minHeight={1} maxHeight={3} keyBindings={KB}
            onContentChange={() => { if (ref) setInput(ref.plainText); }}
            onSubmit={() => { if (ref) { const t = ref.plainText?.trim(); if (t) { ref.clear(); props.onSend(t); } } }}
            ref={(r: any) => { ref = r; setTimeout(() => r?.focus(), 10); }}
          />
          <text fg="#00AAFF">⟩ kapy</text>
        </box>
      </box>
      <box flexGrow={1} minHeight={0} />
    </box>
  );
}

function App() {
  const route = useContext(RC)!;
  const dims = useTerminalDimensions();
  const [sidebar, setSidebar] = createSignal(false);

  const send = (text: string) => {
    route.navigate({ type: "session" });
  };

  return (
    <box width={dims().width} height={dims().height} backgroundColor="#1a1b26" flexDirection="column">
      <box flexDirection="row" flexGrow={1} minHeight={0}>
        <box flexGrow={1} minWidth={0}>
          <Show when={route.data().type === "home"}>
            <HomeView onSend={send} />
          </Show>
          <Show when={route.data().type === "session"}>
            <box paddingLeft={2} paddingRight={2}>
              <text fg="#c0caf5">Session mode</text>
            </box>
          </Show>
        </box>
        <Show when={sidebar()}>
          <box backgroundColor="#1a1a2e" width={36} paddingTop={1} paddingLeft={2} flexShrink={0}>
            <text fg="#c0caf5"><b>Session</b></text>
          </box>
        </Show>
      </box>
      <box flexDirection="row" justifyContent="space-between" paddingLeft={2} paddingRight={2} flexShrink={0}>
        <text fg="#565f89">~/kapy</text>
        <text fg="#565f89">⊙ ollama · glm-5.1:cloud</text>
      </box>
    </box>
  );
}

async function main() {
  const renderer = await createCliRenderer({
    externalOutputMode: "passthrough", targetFps: 60, exitOnCtrlC: false,
    useKittyKeyboard: {}, autoFocus: true, openConsoleOnError: false,
  });
  process.on("SIGHUP", () => { try { renderer.destroy(); } catch {} process.exit(0); });
  process.on("SIGINT", () => { try { renderer.destroy(); } catch {} process.exit(0); });
  setTimeout(() => { try { renderer.destroy(); } catch {} process.exit(0); }, 5000);
  await render(() => <RP><App /></RP>, renderer);
}
main().catch(e => { console.error(e); process.exit(1); });
