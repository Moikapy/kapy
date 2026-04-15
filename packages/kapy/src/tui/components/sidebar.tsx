import { type JSX, Show } from "solid-js";

interface SidebarProps {
	model: () => string;
	msgCount: () => number;
	models: () => string[];
}

export function Sidebar(props: SidebarProps): JSX.Element {
	return (
		<box backgroundColor="#1a1a2e" width={36} paddingTop={1} paddingBottom={1} paddingLeft={2} paddingRight={2} flexShrink={0}>
			<text fg="#c0caf5" bold>Session</text>
			<text fg="#565f89">Current chat</text>
			<box height={1} />
			<text fg="#00AAFF">▸ Model</text>
			<text fg="#c0caf5">  {props.model()}</text>
			<box height={1} />
			<text fg="#00AAFF">▸ Messages</text>
			<text fg="#c0caf5">  {props.msgCount()}</text>
			<box height={1} />
			<text fg="#00AAFF">▸ Tools</text>
			<text fg="#c0caf5">  5</text>
			<box height={1} />
			<text fg="#00AAFF">▸ Commands</text>
			<text fg="#565f89">  /sidebar /clear</text>
			<text fg="#565f89">  exit      quit</text>
			<box height={1} />
			<text fg="#00AAFF">▸ Keys</text>
			<text fg="#565f89">  ctrl+\ sidebar</text>
			<text fg="#565f89">  esc abort/home</text>
			<Show when={props.models().length > 0}>
				<box height={1} />
				<text fg="#00AAFF">▸ Models</text>
				{props.models().map(m => <text fg="#565f89">  {m}</text>)}
			</Show>
		</box>
	);
}