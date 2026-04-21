import type { JSX } from "solid-js";
import { useThemeColors } from "../theme.js";

export interface InputProps {
	placeholder?: string;
	value?: string;
	onInput?: (value: string) => void;
	onSubmit?: (value: string) => void;
	focused?: boolean;
	width?: number;
	fg?: string;
	bg?: string;
	borderColor?: string;
}

export function Input(props: InputProps): JSX.Element {
	const c = useThemeColors();
	const bgColor = () => props.bg ?? c().bgInput;
	const borderColor = () => props.borderColor ?? c().primary;

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
