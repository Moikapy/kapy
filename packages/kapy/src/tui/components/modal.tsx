/**
 * ModalContent — dialog content views for the kapy TUI.
 *
 * These are content components rendered inside the DialogProvider overlay.
 * The DialogProvider handles the absolute-positioned backdrop, borders,
 * and close behavior. These components just render the inner content.
 */

import type { JSX } from "solid-js";
import { For, Show, createSignal, onMount } from "solid-js";
import { useKeyboard } from "@opentui/solid";
import type { SessionInfo } from "../../ai/session/types.js";
import { ChatSession } from "../../ai/chat-session.js";

// ── Types ──────────────────────────────────────────────────────────

export type ModalView =
	| { type: "help" }
	| { type: "models"; models: string[]; current: string }
	| { type: "tools"; tools: string[] }
	| { type: "keys" }
	| { type: "sessions"; sessions?: SessionInfo[]; onLoad?: (path: string) => void }

export interface ModalContentProps {
	view: ModalView;
	onClose?: () => void;
}

// ── Content components ─────────────────────────────────────────────

function HelpContent(): JSX.Element {
	return (
		<box flexDirection="column">
			<text fg="#00AAFF">Commands</text>
			<box height={1} />
			<text fg="#c0caf5">  /help       <text fg="#565f89">Show this help</text></text>
			<text fg="#c0caf5">  /model X     <text fg="#565f89">Switch to model X</text></text>
			<text fg="#c0caf5">  /models      <text fg="#565f89">List available models</text></text>
			<text fg="#c0caf5">  /tools       <text fg="#565f89">List registered tools</text></text>
			<text fg="#c0caf5">  /keys        <text fg="#565f89">Show keyboard shortcuts</text></text>
			<text fg="#c0caf5">  /clear       <text fg="#565f89">Clear chat history</text></text>
			<box height={1} />
			<text fg="#c0caf5">  exit         <text fg="#565f89">Quit kapy</text></text>
			<box height={1} />
			<text fg="#565f89">Press Esc to close</text>
		</box>
	);
}

function ModelsContent(props: { models: string[]; current: string }): JSX.Element {
	return (
		<box flexDirection="column">
			<text fg="#00AAFF">Models</text>
			<box height={1} />
			<For each={props.models}>
				{(m: string) => (
					<text fg={m === props.current ? "#c0caf5" : "#565f89"}>
						{m === props.current ? "▸ " : "  "}{m}
					</text>
				)}
			</For>
			<box height={1} />
			<text fg="#565f89">Use /model X to switch · Esc to close</text>
		</box>
	);
}

function ToolsContent(props: { tools: string[] }): JSX.Element {
	return (
		<box flexDirection="column">
			<text fg="#00AAFF">Tools</text>
			<box height={1} />
			<For each={props.tools}>
				{(t: string) => (
					<text fg="#c0caf5">  {t}</text>
				)}
			</For>
			<box height={1} />
			<text fg="#565f89">Esc to close</text>
		</box>
	);
}

function KeysContent(): JSX.Element {
	return (
		<box flexDirection="column">
			<text fg="#00AAFF">Keyboard Shortcuts</text>
			<box height={1} />
			<text fg="#c0caf5">  Ctrl+C / Ctrl+D  <text fg="#565f89">Quit</text></text>
			<text fg="#c0caf5">  Esc               <text fg="#565f89">Abort / Close dialog</text></text>
			<text fg="#c0caf5">  ↑ / ↓             <text fg="#565f89">Navigate palette</text></text>
			<text fg="#c0caf5">  Tab               <text fg="#565f89">Autocomplete command</text></text>
			<text fg="#c0caf5">  Enter             <text fg="#565f89">Execute / Send</text></text>
			<box height={1} />
			<text fg="#565f89">Esc to close</text>
		</box>
	);
}

function SessionsContent(props: { onLoad?: (path: string) => void }): JSX.Element {
	try { require("fs").appendFileSync("/tmp/kapy-debug.log", `${new Date().toISOString().slice(11,23)} SessionsContent RENDERED\n`); } catch {}
	const [sessions, setSessions] = createSignal<SessionInfo[]>([]);
	const [idx, setIdx] = createSignal(0);

	onMount(async () => {
		try {
			const all = await ChatSession.listAllSessions();
			try { require("fs").appendFileSync("/tmp/kapy-debug.log", `${new Date().toISOString().slice(11,23)} SessionsContent loaded ${all.length} sessions\n`); } catch {}
			all.sort((a, b) => b.modified.getTime() - a.modified.getTime());
			setSessions(all.slice(0, 20));
		} catch (e) {
			try { require("fs").appendFileSync("/tmp/kapy-debug.log", `${new Date().toISOString().slice(11,23)} SessionsContent error: ${e}\n`); } catch {}
			setSessions([]);
		}
	});

	// Keyboard navigation: up/down to move, Enter to load session
	useKeyboard((evt: any) => {
		const list = sessions();
		if (list.length === 0) return;

		if (evt.name === "up") {
			setIdx((i: number) => Math.max(0, i - 1));
			evt.preventDefault();
			return;
		}
		if (evt.name === "down") {
			setIdx((i: number) => Math.min(list.length - 1, i + 1));
			evt.preventDefault();
			return;
		}
		if (evt.name === "return" || evt.name === "enter") {
			const s = list[idx()];
			if (s && props.onLoad) {
				try { require("fs").appendFileSync("/tmp/kapy-debug.log", `${new Date().toISOString().slice(11,23)} SessionsContent: loading ${s.path}\n`); } catch {}
				props.onLoad(s.path);
			}
			evt.preventDefault();
			return;
		}
	});

	return (
		<box flexDirection="column">
			<text fg="#00AAFF">Sessions</text>
			<box height={1} />
			<Show when={sessions().length > 0} fallback={<text fg="#565f89">No sessions found.</text>}>
				<For each={sessions()}>
					{(s, i) => (
						<box flexDirection="row" width="100%" paddingBottom={1} backgroundColor={i() === idx() ? "#22223a" : "transparent"}>
							<text fg={i() === idx() ? "#c0caf5" : "#565f89"}>{i() === idx() ? "\u25b8 " : "  "}{s.created.toLocaleDateString()} </text>
							<text fg={i() === idx() ? "#7aa2f7" : "#565f89"}>{s.firstMessage.slice(0, 40) || s.id}</text>
							<text fg="#565f89"> ({s.messageCount} msgs)</text>
						</box>
					)}
				</For>
			</Show>
			<box height={1} />
			<text fg="#565f89">Up/Down navigate  Enter resume  Esc close</text>
		</box>
	);
}

// ── Main content component ─────────────────────────────────────────

/** Renders dialog content based on the current ModalView. */
export function ModalContent(props: ModalContentProps): JSX.Element {
	const title = (): string => {
		switch (props.view.type) {
			case "help": return "Help";
			case "models": return "Models";
			case "tools": return "Tools";
			case "keys": return "Keys";
			case "sessions": return "Sessions";
		}
	};

	return (
		<box flexDirection="column" width="100%">
			<box flexDirection="row" justifyContent="space-between">
				<text fg="#00AAFF">{title()}</text>
				<text fg="#565f89">× Esc</text>
			</box>
			<box height={1} />
			<Show when={props.view.type === "help"}>
				<HelpContent />
			</Show>
			<Show when={props.view.type === "models"}>
				<ModelsContent
					models={(props.view as { type: "models"; models: string[]; current: string }).models}
					current={(props.view as { type: "models"; models: string[]; current: string }).current}
				/>
			</Show>
			<Show when={props.view.type === "tools"}>
				<ToolsContent
					tools={(props.view as { type: "tools"; tools: string[] }).tools}
				/>
			</Show>
			<Show when={props.view.type === "keys"}>
				<KeysContent />
			</Show>
			<Show when={props.view.type === "sessions"}>
				<SessionsContent onLoad={(path) => { props.onClose?.(); (props.view as any).onLoad?.(path); }} />
			</Show>
		</box>
	);
}