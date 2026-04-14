import { createCliRenderer, type KeyBinding } from "@opentui/core";
import { render } from "@opentui/solid";
import { createSignal, createContext, useContext, type ParentComponent, Show } from "solid-js";

type RouteData = { type: "home" } | { type: "session"; sessionID: string };
const RC = createContext<{ data: () => RouteData; navigate: (r: RouteData) => void }>();
const RP: ParentComponent = (props) => {
  const [d, setD] = createSignal<RouteData>({ type: "home" });
  return <RC.Provider value={{ data: d, navigate: (r) => setD(r) }}>{props.children}</RC.Provider>;
};

const TC = { accent: "#00AAFF", bg: "#1a1b26", text: "#c0caf5", muted: "#565f89", panel: "#1a1a2e", elem: "#22223a" };
const TP: ParentComponent = (props) => <>{props.children}</>;
function useT() { return TC; }
function useR() { return useContext(RC)!; }

const KB: KeyBinding[] = [{ name: "return", action: "submit" }, { name: "return", shift: true, action: "newline" }];

function App() {
  const r = useR();
  const t = useT();
  let ref: any;
  const [input, setInput] = createSignal("");

  return (
    <box flexDirection="column" padding={1} backgroundColor={t.bg}>
      <Show when={r.data().type === "home"}>
        <text fg={t.accent} bold>KAPY</text>
        <text fg={t.muted}>agent-first cli</text>
        <box height={1} />
        <box border={["left"]} borderColor={t.accent}>
          <box paddingLeft={2} paddingTop={1} backgroundColor={t.elem}>
            <textarea
              focused
              placeholder="Ask anything..."
              placeholderColor={t.muted}
              textColor={t.text}
              focusedTextColor={t.text}
              focusedBackgroundColor={t.elem}
              cursorColor={t.text}
              minHeight={1}
              maxHeight={3}
              keyBindings={KB}
              onContentChange={() => { if (ref) setInput(ref.plainText); }}
              onSubmit={() => {
                const text = input().trim();
                if (!text) return;
                setInput(""); if (ref) ref.clear();
                r.navigate({ type: "session", sessionID: `s-${Date.now()}` });
              }}
              ref={(r2: any) => { ref = r2; setTimeout(() => r2?.focus(), 10); }}
            />
            <text fg={t.accent}>⟩ <text fg={t.text}>kapy · glm-5.1:cloud</text></text>
          </box>
        </box>
        <box height={1} />
        <text fg={t.muted}>enter send · ctrl+\ sidebar · esc abort</text>
      </Show>
      <Show when={r.data().type === "session"}>
        <text fg={t.text}>Session view</text>
      </Show>
    </box>
  );
}

async function main() {
  await new Promise<void>(async (resolve) => {
    const renderer = await createCliRenderer({
      externalOutputMode: "passthrough",
      targetFps: 60,
      exitOnCtrlC: false,
      useKittyKeyboard: {},
      autoFocus: true,
      openConsoleOnError: false,
    });
    process.on("SIGHUP", () => { try { renderer.destroy(); } catch {} resolve(); });
    process.on("SIGINT", () => { try { renderer.destroy(); } catch {} resolve(); });
    setTimeout(() => { try { renderer.destroy(); } catch {} resolve(); }, 4000);
    await render(() => <RP><App /></RP>, renderer);
  });
}
main().catch(e => { console.error(e); process.exit(1); });
