import { createCliRenderer, type KeyBinding } from "@opentui/core";
import { render } from "@opentui/solid";
import { createSignal, Show } from "solid-js";

const KB: KeyBinding[] = [{ name: "return", action: "submit" }, { name: "return", shift: true, action: "newline" }];

function App() {
  let ref: any;
  const [sent, setSent] = createSignal("");
  return (
    <box flexDirection="column" padding={1} backgroundColor="#1a1b26">
      <text fg="#00AAFF" bold>KAPY</text>
      <text fg="#565f89">Text area test</text>
      <box height={1} />
      <box border={["left"]} borderColor="#00AAFF">
        <box paddingLeft={2} paddingTop={1} backgroundColor="#22223a">
          <textarea
            focused
            placeholder="Type here..."
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
                if (text) { setSent(text); ref.clear(); }
              }
            }}
            ref={(r: any) => { ref = r; setTimeout(() => r?.focus(), 10); }}
          />
          <text fg="#00AAFF">⟩ kapy</text>
        </box>
      </box>
      <Show when={sent() !== ""}>
        <text fg="#9ece6a">Sent: {sent()}</text>
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
  await render(() => <App />, renderer);
}
main().catch(e => { console.error(e); process.exit(1); });
