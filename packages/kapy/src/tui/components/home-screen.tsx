import type { JSX } from "solid-js";
import type { KeyBinding } from "@opentui/core";

interface HomeScreenProps {
	keyBindings: KeyBinding[];
	onSubmit: () => void;
	onKeyDown: (evt: any) => void;
	onContentChange: () => void;
	inputRef: (r: any) => void;
}

export function HomeScreen(props: HomeScreenProps): JSX.Element {
	return (
		<box flexDirection="column" alignItems="center" paddingLeft={2} paddingRight={2} flexGrow={1}>
			<box flexGrow={1} minHeight={0} />
			<ascii_font text="KAPY" font="slick" color="#00AAFF" />
			<text fg="#565f89">human-first digital assistant</text>
			<box height={2} />
			<box border={["left"]} borderColor="#00AAFF" width="100%" maxWidth={72}>
				<box paddingLeft={2} paddingTop={1} paddingBottom={1} backgroundColor="#22223a">
					<textarea focused placeholder="Ask anything..." placeholderColor="#565f89"
						textColor="#c0caf5" focusedTextColor="#c0caf5" focusedBackgroundColor="#22223a"
						cursorColor="#c0caf5" minHeight={1} maxHeight={4} keyBindings={props.keyBindings}
						onContentChange={props.onContentChange}
						onKeyDown={props.onKeyDown}
						onSubmit={props.onSubmit}
						ref={props.inputRef}
					/>
				</box>
			</box>
			<box flexGrow={1} minHeight={0} />
		</box>
	);
}