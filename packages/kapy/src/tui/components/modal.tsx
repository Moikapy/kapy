/**
 * ModalContent — dialog content views for the kapy TUI.
 *
 * These are content components rendered inside the DialogProvider overlay.
 * The DialogProvider handles the absolute-positioned backdrop, borders,
 * and close behavior. These components just render the inner content.
 */

import type { JSX } from "solid-js";
import { For, Show } from "solid-js";

// ── Types ──────────────────────────────────────────────────────────

export type ModalView =
	| { type: "help" }
	| { type: "models"; models: string[]; current: string }
	| { type: "tools"; tools: string[] }
	| { type: "keys" }
	| { type: "sessions" };

export interface ModalContentProps {
	view: ModalView;
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

function SessionsContent(): JSX.Element {
	return (
		<box flexDirection="column">
			<text fg="#00AAFF">Sessions</text>
			<box height={1} />
			<text fg="#565f89">Previous chat sessions are stored in ~/.kapy/sessions/</text>
			<text fg="#565f89">Sessions resume automatically on restart.</text>
			<box height={1} />
			<text fg="#c0caf5">  /sessions   <text fg="#565f89">List and resume sessions</text></text>
			<text fg="#c0caf5">  /clear      <text fg="#565f89">Start a fresh session</text></text>
			<box height={1} />
			<text fg="#565f89">Esc to close</text>
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
				<SessionsContent />
			</Show>
		</box>
	);
}