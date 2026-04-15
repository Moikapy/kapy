import type { JSX } from "solid-js";

interface Message {
	id: string;
	role: "user" | "assistant" | "system" | "tool_call" | "tool_result";
	content: string;
	streaming?: boolean;
	reasoning?: string;
	toolName?: string;
}

export function MessageItem(props: { msg: Message }): JSX.Element {
	const m = props.msg;
	if (m.role === "user") return <box border={["left"]} borderColor="#00AAFF" marginTop={1} flexShrink={0}><box paddingTop={1} paddingBottom={1} paddingLeft={2} backgroundColor="#1a1a2e"><text fg="#c0caf5">{m.content}</text></box></box>;
	if (m.role === "system") return <box paddingLeft={3} marginTop={1} flexShrink={0}><text fg="#7aa2f7">{m.content}</text></box>;
	if (m.role === "tool_call") return <box border={["left"]} borderColor="#e0af68" marginTop={1} flexShrink={0}><box paddingLeft={2} paddingTop={1} paddingBottom={1} backgroundColor="#2a2a1e"><text fg="#e0af68">{"⚙ "}{m.content}</text></box></box>;
	if (m.role === "tool_result") return <box border={["left"]} borderColor="#565f89" marginTop={1} flexShrink={0}><box paddingLeft={2} paddingTop={1} paddingBottom={1} backgroundColor="#1a1a2a"><text fg="#a9b1d6">{"↳ "}{m.content}</text></box></box>;
	// assistant
	return <box paddingLeft={3} marginTop={1} flexShrink={0}>
		{(m.reasoning ?? "") !== "" && <box><text fg="#565f89" italic>{m.reasoning}</text></box>}
		<text fg="#9ece6a">{m.content}{m.streaming ? " ●" : ""}</text>
	</box>;
}