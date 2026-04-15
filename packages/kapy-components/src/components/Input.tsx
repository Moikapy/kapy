/**
 * Input — styled text input component for kapy TUI.
 *
 * Wraps OpenTUI's <input> primitive with kapy brand styling.
 */
import type { JSX } from "solid-js";
import { colors } from "../theme.js";

export interface InputProps {
	/** Placeholder text */
	placeholder?: string;
	/** Initial value */
	value?: string;
	/** Input change handler */
	onInput?: (value: string) => void;
	/** Submit handler */
	onSubmit?: (value: string) => void;
	/** Whether the input has focus */
	focused?: boolean;
	/** Width */
	width?: number;
	/** Foreground color */
	fg?: string;
	/** Background color */
	bg?: string;
	/** Border color */
	borderColor?: string;
}

/** Styled text input with kapy branding */
export function Input(props: InputProps): JSX.Element {
	const bgColor = () => props.bg ?? colors.bgInput;
	const borderColor = () => props.borderColor ?? colors.primary;

	return (
		<box border borderColor={borderColor()}>
			<box paddingLeft={1} paddingRight={1} backgroundColor={bgColor()}>
				<input
					focused={props.focused ?? true}
					placeholder={props.placeholder ?? ""}
					value={props.value ?? ""}
					onInput={props.onInput}
					width={props.width ?? 30}
				/>
			</box>
		</box>
	);
}
