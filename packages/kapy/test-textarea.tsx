#!/usr/bin/env bun
import { createCliRenderer } from "@opentui/core";
import { render } from "@opentui/solid";

function App() {
  let textRef: any;
  return (
    <box flexDirection="column" width={60} height={10} backgroundColor="#1a1b26" paddingLeft={2} paddingRight={2}>
      <text fg="#565f89">Type and press Enter:</text>
      <textarea
        focused
        placeholder="Test input..."
        placeholderColor="#565f89"
        textColor="#c0caf5"
        keyBindings={[{ name: "return", action: "submit" }, { name: "return", shift: true, action: "newline" }]}
        onContentChange={() => {
          console.log("CHANGE:", textRef?.plainText);
        }}
        onKeyDown={(evt: any) => {
          console.log("KEY:", evt.name, "shift:", evt.shift);
        }}
        onSubmit={() => {
          const val = textRef?.plainText ?? "(empty)";
          console.log("SUBMIT:", val);
          if (val === "exit") process.exit(0);
        }}
        ref={(r: any) => {
          textRef = r;
          setTimeout(() => r?.focus(), 10);
        }}
      />
    </box>
  );
}

const renderer = await createCliRenderer({
  externalOutputMode: "passthrough",
  targetFps: 60,
  exitOnCtrlC: true,
  autoFocus: true,
});

await render(() => <App />, renderer);