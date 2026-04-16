/**
 * MessageItem — renders individual messages in the chat list.
 *
 * Design follows OpenCode/pi patterns:
 * - User messages: left-bordered, blue accent
 * - Assistant messages: green text, collapsible thinking
 * - Tool calls: compact inline — tool icon + name + truncated key args
 * - Tool results: hidden by default, expandable summary line
 * - System messages: dim, minimal
 *
 * Click any message to copy. Tool calls/results can be expanded with Enter.
 */

import type { JSX } from "solid-js";
import { createSignal, Show } from "solid-js";
import { useRenderer } from "@opentui/solid";
import type { Msg } from "../types.js";

// ── Tool name → color/icon mapping ──────────────────────────────────

const TOOL_STYLES: Record<string, { icon: string; color: string }> = {
	// File ops — pink/magenta
	read_file: { icon: "󰈚", color: "#f7768e" },
	write_file: { icon: "󰆓", color: "#f7768e" },
	edit_file: { icon: "󰏫", color: "#ff9e64" },
	// Search — teal
	grep: { icon: "󰈬", color: "#2ac3de" },
	glob: { icon: "󰈔", color: "#2ac3de" },
	find: { icon: "󰈔", color: "#2ac3de" },
	// Shell — orange
	bash: { icon: "󰅂", color: "#ff9e64" },
	// Grimoire — purple
	grimoire_read: { icon: "󰮦", color: "#bb9af7" },
	grimoire_write: { icon: "󰮦", color: "#bb9af7" },
	grimoire_list: { icon: "󰮦", color: "#bb9af7" },
	grimoire_search: { icon: "󰮦", color: "#bb9af7" },
	grimoire_ingest: { icon: "󰮦", color: "#bb9af7" },
	grimoire_lint: { icon: "󰮦", color: "#bb9af7" },
	soul_evolve: { icon: "󰮦", color: "#bb9af7" },
	// Web — cyan
	web_fetch: { icon: "󰖟", color: "#7dcfff" },
	web_search: { icon: "󰖟", color: "#7dcfff" },
};

const DEFAULT_TOOL_STYLE = { icon: "󱁨", color: "#e0af68" };

function getToolStyle(name: string) {
	return TOOL_STYLES[name] ?? DEFAULT_TOOL_STYLE;
}

/** Extract a short summary from tool call args for inline display */
function summarizeToolArgs(content: string): { name: string; args: string } {
	// Parse "⟹ tool_name({args})" format
	const match = content.match(/⟹\s+(\w+)\((.+)\)$/s);
	if (!match) return { name: content, args: "" };
	const name = match[1];
	let args = match[2];

	// Try to extract key fields for compact display
	try {
		const parsed = JSON.parse(args);
		// Show just the primary arg for common tools
		if (parsed.path) return { name, args: parsed.path as string };
		if (parsed.query) return { name, args: `"${parsed.query}"` as string };
		if (parsed.command) return { name, args: parsed.command as string };
		// Fallback: truncate
		const short = JSON.stringify(parsed);
		return { name, args: short.length > 60 ? `${short.slice(0, 57)}...` : short };
	} catch {
		// Not JSON — truncate raw
		return { name, args: args.length > 60 ? `${args.slice(0, 57)}...` : args };
	}
}

/** Summarize a tool result — line count, error, or first line preview */
function summarizeResult(content: string): { text: string; isError: boolean } {
	if (!content) return { text: "(empty)", isError: false };
	if (content.startsWith("Error:") || content.startsWith("error:") || content.includes("not found")) {
		return { text: content.slice(0, 80), isError: true };
	}
	const lines = content.split("\n").length;
	if (lines > 3) return { text: `${lines} lines`, isError: false };
	return { text: content.slice(0, 80), isError: false };
}

// ── Component ───────────────────────────────────────────────────────

export function MessageItem(props: { msg: Msg; onCopy?: (text: string) => void }): JSX.Element {
	const m = props.msg;
	const renderer = useRenderer();
	const [expanded, setExpanded] = createSignal(false);

	function handleClick() {
		try { if ((renderer as any).hasSelection) return; } catch {}
		const text = m.content;
		if (!text) return;
		try {
			const ok = renderer.copyToClipboardOSC52(text);
			if (ok && props.onCopy) props.onCopy(text);
		} catch {}
	}

	// ── User ──────────────────────────────────────────────────────

	if (m.role === "user" && m.queued) {
		return (
			<box marginTop={1} flexShrink={0}>
				<text fg="#565f89" selectable>{m.content}</text>
				<text fg="#565f89"> (queued)</text>
			</box>
		);
	}

	if (m.role === "user") {
		return (
			<box marginTop={1} flexShrink={0} onMouseUp={handleClick}>
				<text fg="#7aa2f7" selectable>{m.content}</text>
			</box>
		);
	}

	// ── System ────────────────────────────────────────────────────

	if (m.role === "system") {
		return (
			<box paddingLeft={2} marginTop={1} flexShrink={0}>
				<text fg="#565f89" selectable>{m.content}</text>
			</box>
		);
	}

	// ── Tool Call — compact inline ──────────────────────────────

	if (m.role === "tool_call") {
		const { name, args } = summarizeToolArgs(m.content);
		const style = getToolStyle(name);
		return (
			<box marginTop={0} flexShrink={0} onMouseUp={handleClick}>
				<text fg={style.color}>{style.icon} </text>
				<text fg="#c0caf5"><b>{name}</b></text>
				<Show when={args.length > 0}>
					<text fg="#565f89"> {args}</text>
				</Show>
			</box>
		);
	}

	// ── Tool Result — collapsed by default ──────────────────────

	if (m.role === "tool_result") {
		const summary = summarizeResult(m.content);
		const lines = m.content.split("\n").length;
		const canExpand = lines > 3 || m.content.length > 80;

		return (
			<box marginLeft={2} flexShrink={0} flexDirection="column">
				<box flexDirection="row" onMouseUp={handleClick}>
					<Show when={summary.isError}>
						<text fg="#f7768e">✗ </text>
					</Show>
					<Show when={!summary.isError}>
						<text fg="#565f89">  ✓ </text>
					</Show>
					<text fg={summary.isError ? "#f7768e" : "#565f89"} selectable>{summary.text}</text>
					<Show when={canExpand && !expanded()}>
						<text fg="#414868"> [{lines}L]</text>
					</Show>
				</box>
				<Show when={expanded()}>
					<box paddingLeft={2} border={["left"]} borderColor="#414868" flexDirection="column">
						<text fg="#a9b1d6" selectable>{m.content}</text>
					</box>
				</Show>
			</box>
		);
	}

	// ── Assistant — thinking + response ───────────────────────────

	return (
		<box paddingLeft={1} marginTop={1} flexShrink={0} flexDirection="column" onMouseUp={handleClick}>
			<Show when={(m.reasoning ?? "") !== ""}>
				<box border={["left"]} borderColor="#414868" paddingLeft={1} marginBottom={0}>
					<text fg="#565f89" selectable>
						<em>{m.reasoning}</em>
					</text>
				</box>
			</Show>
			<text fg="#9ece6a" selectable>
				{m.content}
				{m.streaming ? " ●" : ""}
			</text>
		</box>
	);
}