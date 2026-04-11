/**
 * Input — text input component.
 *
 * Renders an editable text field with placeholder, validation, and focus support.
 */
import type { Component } from "../types.js";

export interface InputProps {
	/** Placeholder text */
	placeholder?: string;
	/** Current value */
	value?: string;
	/** Input type */
	type?: "text" | "password" | "number";
	/** Label */
	label?: string;
	/** Whether the input is disabled */
	disabled?: boolean;
	/** Whether the input has focus */
	focused?: boolean;
	/** Change handler */
	onChange?: (value: string) => void;
	/** Submit handler */
	onSubmit?: (value: string) => void;
	/** Border style */
	border?: "single" | "double" | "none";
	/** Width */
	width?: number | string;
}

/** Render a text input field */
export const Input: Component<InputProps> = (props: InputProps) => {
	return {
		type: "Input",
		props: {
			placeholder: props.placeholder ?? "",
			value: props.value ?? "",
			type: props.type ?? "text",
			label: props.label,
			disabled: props.disabled ?? false,
			focused: props.focused ?? false,
			onChange: props.onChange,
			onSubmit: props.onSubmit,
			border: props.border ?? "single",
			width: props.width,
		},
	};
};