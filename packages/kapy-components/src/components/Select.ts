/**
 * Select — selection list component.
 *
 * Renders a list of selectable options with keyboard navigation.
 */
import type { Component } from "../types.js";

export interface SelectOption<T = string> {
	/** Display label */
	label: string;
	/** Option value */
	value: T;
	/** Whether the option is disabled */
	disabled?: boolean;
	/** Description text */
	description?: string;
}

export interface SelectProps<T = string> {
	/** Available options */
	options: SelectOption<T>[];
	/** Currently selected value */
	value?: T;
	/** Selection change handler */
	onChange?: (value: T) => void;
	/** Placeholder text */
	placeholder?: string;
	/** Whether multiple selection is allowed */
	multiple?: boolean;
	/** Label */
	label?: string;
	/** Border style */
	border?: "single" | "double" | "none";
	/** Max visible items */
	maxVisible?: number;
}

/** Render a selection list */
export const Select: Component<SelectProps> = <T>(props: SelectProps<T>) => {
	return {
		type: "Select",
		props: {
			options: props.options,
			value: props.value,
			onChange: props.onChange,
			placeholder: props.placeholder ?? "Select...",
			multiple: props.multiple ?? false,
			label: props.label,
			border: props.border ?? "single",
			maxVisible: props.maxVisible ?? 10,
		},
	};
};
