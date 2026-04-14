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

function App() {
  const route = useContext(RC)!;
  const dims = useTerminalDimensions();
  const [sidebar, setSidebar] = createSignal(false);
  let ref: any;

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
                  <textarea
                    focused
                    placeholder="Ask anything..."
                    placeholderColor="#565f89"
                    textColor="#c0caf5"
                    focusedTextColor="#c0caf5"
                    focusedBackgroundColor="#22223a"
                    cursorColor="#c0caf5"
                    minHeight={1}
                    maxHeight={3}
                    keyBindings={KB}
                    onContentChange={() => {}}
                    onSubmit={() => {
                      if (ref) {
                        const text = ref.plainText?.trim();
                        if (text) { ref.clear(); route.navigate({ type: "session" }); }
                      }
                    }}
                    ref={(r2: any) => { ref = r2; setTimeout(() => r2?.focus(), 10); }}
                  />
                  <text fg="#00AAFF">⟩ kapy</text>
                </box>
              </box>
              <box flexGrow={1} minHeight={0} />
            </box>
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
            <text fg="#565f89">Sidebar content</text>
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
    externalOutputMode: "passthrough",
    targetFps: 60,
    exitOnCtrlC: false,
    useKittyKeyboard: {},
    autoFocus: true,
    openConsoleOnError: false,
  });
  process.on("SIGHUP", () => { try { renderer.destroy(); } catch {} process.exit(0); });
  process.on("SIGINT", () => { try { renderer.destroy(); } catch {} process.exit(0); });
  setTimeout(() => { try { renderer.destroy(); } catch {} process.exit(0); }, 5000);
  await render(() => <RP><App /></RP>, renderer);
}
main().catch(e => { console.error(e); process.exit(1); });
