import { useThemeColors } from "@moikapy/kapy-components";
import type { KeyBinding } from "@opentui/core";
import type { JSX } from "solid-js";
import { MessageInput, type MessageInputProps } from "../components/message-input.js";

interface HomeScreenProps {
	keyBindings: KeyBinding[];
	onSubmit: MessageInputProps["onSubmit"];
	onSlashCommand: MessageInputProps["onSlashCommand"];
	onExit: MessageInputProps["onExit"];
	onKeyDown: MessageInputProps["onKeyDown"];
	inputRef: MessageInputProps["inputRef"];
	model?: string;
	thinkingLevel?: string;
	streaming?: boolean;
}

export function HomeScreen(props: HomeScreenProps): JSX.Element {
	const c = useThemeColors();
	return (
		<box flexDirection="column" alignItems="center" paddingLeft={2} paddingRight={2} flexGrow={1}>
			<box flexGrow={1} minHeight={0} />
			<ascii_font text="KAPY" font="tiny" color={c().primary} />
			<box height={2} />
			<MessageInput
				keyBindings={props.keyBindings}
				placeholder="Ask anything..."
				onSubmit={props.onSubmit}
				onSlashCommand={props.onSlashCommand}
				onExit={props.onExit}
				onKeyDown={props.onKeyDown}
				inputRef={props.inputRef}
				maxWidth={72}
				model={props.model}
				thinkingLevel={props.thinkingLevel}
				streaming={props.streaming}
			/>
			<box flexGrow={1} minHeight={0} />
		</box>
	);
}
