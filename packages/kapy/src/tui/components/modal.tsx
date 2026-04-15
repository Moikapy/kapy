/**
 * Modal — full-screen centered overlay for the kapy TUI.
 *
 * Renders a bordered box centered on screen over the content.
 * Content is driven by ModalView state. Escape key closes it.
 * No absolute positioning needed — renders after content in the tree
 * so it paints on top.
 */

import { colors } from "@moikapy/kapy-components";
import type { JSX } from "solid-js";
import { For, Show } from "solid-js";

export type ModalView =
	| { type: "help" }
	| { type: "models"; models: string[]; current: string }
	| { type: "tools"; tools: string[] }
	| { type: "keys" };

export interface ModalProps {
	/** What to show in the modal */
	view: ModalView;
	/** Close handler */
	onClose: () => void;
}

function HelpContent(): JSX.Element {
	return (
		<box flexDirection="column">
			<text fg={colors.primary}>Commands</text>
			<box height={1} />
			<text fg={colors.text}>
				{"  /help       "}
				<text fg={colors.muted}>Show this help</text>
			</text>
			<text fg={colors.text}>
				{"  /model X     "}
				<text fg={colors.muted}>Switch to model X</text>
			</text>
			<text fg={colors.text}>
				{"  /models      "}
				<text fg={colors.muted}>List available models</text>
			</text>
			<text fg={colors.text}>
				{"  /tools       "}
				<text fg={colors.muted}>List registered tools</text>
			</text>
			<text fg={colors.text}>
				{"  /clear       "}
				<text fg={colors.muted}>Clear chat</text>
			</text>
			<box height={1} />
			<text fg={colors.text}>
				{"  exit         "}
				<text fg={colors.muted}>Quit kapy</text>
			</text>
			<box height={1} />
			<text fg={colors.muted}>Press Esc to close</text>
		</box>
	);
}

function ModelsContent(props: { models: string[]; current: string }): JSX.Element {
	return (
		<box flexDirection="column">
			<text fg={colors.primary}>Models</text>
			<box height={1} />
			<For each={props.models}>
				{(m: string) => (
					<text fg={m === props.current ? colors.text : colors.muted}>
						{m === props.current ? "▸ " : "  "}
						{m}
					</text>
				)}
			</For>
			<box height={1} />
			<text fg={colors.muted}>Use /model X to switch · Esc to close</text>
		</box>
	);
}

function ToolsContent(props: { tools: string[] }): JSX.Element {
	return (
		<box flexDirection="column">
			<text fg={colors.primary}>Tools</text>
			<box height={1} />
			<For each={props.tools}>
				{(t: string) => (
					<text fg={colors.text}>
						{"  "}
						{t}
					</text>
				)}
			</For>
			<box height={1} />
			<text fg={colors.muted}>Esc to close</text>
		</box>
	);
}

function KeysContent(): JSX.Element {
	return (
		<box flexDirection="column">
			<text fg={colors.primary}>Keyboard Shortcuts</text>
			<box height={1} />
			<text fg={colors.text}>
				{"  Ctrl+C / Ctrl+D  "}
				<text fg={colors.muted}>Quit</text>
			</text>
			<text fg={colors.text}>
				{"  Esc               "}
				<text fg={colors.muted}>Abort / Close modal</text>
			</text>
			<text fg={colors.text}>
				{"  ↑ / ↓             "}
				<text fg={colors.muted}>Navigate palette</text>
			</text>
			<text fg={colors.text}>
				{"  Tab               "}
				<text fg={colors.muted}>Autocomplete command</text>
			</text>
			<text fg={colors.text}>
				{"  Enter             "}
				<text fg={colors.muted}>Execute / Send</text>
			</text>
			<box height={1} />
			<text fg={colors.muted}>Esc to close</text>
		</box>
	);
}

export function Modal(props: ModalProps): JSX.Element {
	const title = (): string => {
		switch (props.view.type) {
			case "help":
				return "Help";
			case "models":
				return "Models";
			case "tools":
				return "Tools";
			case "keys":
				return "Keys";
		}
	};

	return (
		<box flexGrow={1} backgroundColor={colors.bg} flexDirection="column" alignItems="center" justifyContent="center">
			<box
				border={["top", "right", "bottom", "left"]}
				borderColor={colors.primary}
				backgroundColor={colors.bg}
				paddingLeft={2}
				paddingRight={2}
				paddingTop={1}
				paddingBottom={1}
				width={48}
			>
				<box flexDirection="column" width="100%">
					{/* Title bar */}
					<box flexDirection="row" justifyContent="space-between">
						<text fg={colors.primary}>{title()}</text>
						<text fg={colors.muted}>× Esc</text>
					</box>
					<box border={["bottom"]} borderColor={colors.border} width="100%">
						<text> </text>
					</box>
					<box height={1} />
					{/* Content */}
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
						<ToolsContent tools={(props.view as { type: "tools"; tools: string[] }).tools} />
					</Show>
					<Show when={props.view.type === "keys"}>
						<KeysContent />
					</Show>
				</box>
			</box>
		</box>
	);
}
