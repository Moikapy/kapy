import { createCliRenderer, type KeyBinding } from "@opentui/core";
import { render } from "@opentui/solid";
import { createSignal, createContext, useContext, type ParentComponent, Show } from "solid-js";

type RD = { type: "home" } | { type: "session"; sessionID: string };
const RC = createContext<{ data: () => RD; navigate: (r: RD) => void }>();
const RP: ParentComponent = (props) => {
  const [d, setD] = createSignal<RD>({ type: "home" });
  return <RC.Provider value={{ data: d, navigate: (r) => setD(r) }}>{props.children}</RC.Provider>;
};

const KB: KeyBinding[] = [{ name: "return", action: "submit" }, { name: "return", shift: true, action: "newline" }];

function App() {
  const route = useContext(RC)!;
  let ref: any;

  return (
    <box flexDirection="column" padding={1} backgroundColor="#1a1b26">
      <Show when={route.data().type === "home"}>
        <text fg="#00AAFF" bold>KAPY</text>
        <text fg="#565f89">Route + textarea test</text>
        <box height={1} />
        <box border={["left"]} borderColor="#00AAFF">
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
                  if (text) { ref.clear(); route.navigate({ type: "session", sessionID: `s-${Date.now()}` }); }
                }
              }}
              ref={(r2: any) => { ref = r2; setTimeout(() => r2?.focus(), 10); }}
            />
            <text fg="#00AAFF">⟩ kapy</text>
          </box>
        </box>
      </Show>
      <Show when={route.data().type === "session"}>
        <text fg="#c0caf5">Session mode</text>
      </Show>
      <text fg="#565f89">Auto-exit in 5s...</text>
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
