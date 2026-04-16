import type { JSX } from "solid-js";
import { useRenderer } from "@opentui/solid";
import type { Msg } from "../types.js";

export function MessageItem(props: { msg: Msg; onCopy?: (text: string) => void }): JSX.Element {
	const m = props.msg;
	const renderer = useRenderer();

	/** Click: copy message text if no text is selected (i.e. not a drag-select) */
	function handleClick() {
		// If the user just finished a drag-selection, don't copy the whole message
		try {
			if ((renderer as any).hasSelection) return;
		} catch {}
		const text = m.content;
		if (!text) return;
		try {
			const ok = renderer.copyToClipboardOSC52(text);
			if (ok && props.onCopy) props.onCopy(text);
		} catch {}
	}

	// Queued user message — waiting for agent to finish
	if (m.role === "user" && m.queued) {
		return (
			<box border={["left"]} borderColor="#565f89" marginTop={1} flexShrink={0}>
				<box paddingTop={1} paddingBottom={1} paddingLeft={2} backgroundColor="#1a1a2e" onMouseUp={handleClick}>
					<text fg="#565f89" selectable>{m.content}</text>
				</box>
			</box>
		);
	}

	if (m.role === "user") {
		return (
			<box border={["left"]} borderColor="#00AAFF" marginTop={1} flexShrink={0}>
				<box paddingTop={1} paddingBottom={1} paddingLeft={2} backgroundColor="#1a1a2e" onMouseUp={handleClick}>
					<text fg="#c0caf5" selectable>{m.content}</text>
				</box>
			</box>
		);
	}

	if (m.role === "system") {
		return (
			<box paddingLeft={3} marginTop={1} flexShrink={0} onMouseUp={handleClick}>
				<text fg="#7aa2f7" selectable>{m.content}</text>
			</box>
		);
	}

	if (m.role === "tool_call") {
		return (
			<box border={["left"]} borderColor="#e0af68" marginTop={1} flexShrink={0}>
				<box paddingLeft={2} paddingTop={1} paddingBottom={1} backgroundColor="#2a2a1e" onMouseUp={handleClick}>
					<text fg="#e0af68" selectable>{"⚙ "}{m.content}</text>
				</box>
			</box>
		);
	}

	if (m.role === "tool_result") {
		return (
			<box border={["left"]} borderColor="#565f89" marginTop={1} flexShrink={0}>
				<box paddingLeft={2} paddingTop={1} paddingBottom={1} backgroundColor="#1a1a2a" onMouseUp={handleClick}>
					<text fg="#a9b1d6" selectable>{"↳ "}{m.content}</text>
				</box>
			</box>
		);
	}

	// assistant — reasoning in dim italic, content in bright green
	return (
		<box paddingLeft={3} marginTop={1} flexShrink={0} onMouseUp={handleClick}>
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