import type { JSX } from "solid-js";
import type { Msg } from "../types.js";

export function MessageItem(props: { msg: Msg }): JSX.Element {
	const m = props.msg;

	// Queued user message — waiting for agent to finish
	if (m.role === "user" && m.queued) {
		return (
			<box border={["left"]} borderColor="#565f89" marginTop={1} flexShrink={0}>
				<box paddingTop={1} paddingBottom={1} paddingLeft={2} backgroundColor="#1a1a2e">
					<text fg="#565f89" selectable>{m.content}</text>
				</box>
			</box>
		);
	}

	if (m.role === "user") {
		return (
			<box border={["left"]} borderColor="#00AAFF" marginTop={1} flexShrink={0}>
				<box paddingTop={1} paddingBottom={1} paddingLeft={2} backgroundColor="#1a1a2e">
					<text fg="#c0caf5" selectable>{m.content}</text>
				</box>
			</box>
		);
	}

	if (m.role === "system") {
		return (
			<box paddingLeft={3} marginTop={1} flexShrink={0}>
				<text fg="#7aa2f7" selectable>{m.content}</text>
			</box>
		);
	}

	if (m.role === "tool_call") {
		return (
			<box border={["left"]} borderColor="#e0af68" marginTop={1} flexShrink={0}>
				<box paddingLeft={2} paddingTop={1} paddingBottom={1} backgroundColor="#2a2a1e">
					<text fg="#e0af68" selectable>{"⚙ "}{m.content}</text>
				</box>
			</box>
		);
	}

	if (m.role === "tool_result") {
		return (
			<box border={["left"]} borderColor="#565f89" marginTop={1} flexShrink={0}>
				<box paddingLeft={2} paddingTop={1} paddingBottom={1} backgroundColor="#1a1a2a">
					<text fg="#a9b1d6" selectable>{"↳ "}{m.content}</text>
				</box>
			</box>
		);
	}

	// assistant — reasoning in dim italic, content in bright green
	return (
		<box paddingLeft={3} marginTop={1} flexShrink={0}>
			{(m.reasoning ?? "") !== "" && (
				<text fg="#565f89" selectable>
					<em>{m.reasoning}</em>
				</text>
			)}
			<text fg="#9ece6a" selectable>
				{m.content}
				{m.streaming ? "●" : ""}
			</text>
		</box>
	);
}