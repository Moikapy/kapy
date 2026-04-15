/**
 * Select — styled selection list component for kapy TUI.
 *
 * Wraps OpenTUI's <select> primitive with kapy brand styling.
 */
import type { SelectOption as CoreSelectOption } from "@opentui/core";
import type { JSX } from "solid-js";
import { colors } from "../theme.js";

export interface SelectOption {
	/** Display label */
	name: string;
	/** Description text */
	description?: string;
	/** Option value */
	value: string;
}

export interface SelectProps {
	/** Available options */
	options: SelectOption[];
	/** Selection change handler — receives index and option */
	onChange?: (index: number, option: SelectOption) => void;
	/** Initial selected index */
	selectedIndex?: number;
	/** Whether the select has focus */
	focused?: boolean;
	/** Width */
	width?: number;
	/** Height */
	height?: number;
	/** Background color */
	bg?: string;
}

/** Convert our SelectOption to OpenTUI's format (description is required there) */
function toCoreOptions(options: SelectOption[]): CoreSelectOption[] {
	return options.map((o) => ({
		name: o.name,
		value: o.value,
		description: o.description ?? "",
	}));
}

/** Styled selection list with kapy branding */
export function Select(props: SelectProps): JSX.Element {
	const bgColor = () => props.bg ?? colors.bgAlt;

	return (
		<box backgroundColor={bgColor()}>
			<select
				options={toCoreOptions(props.options)}
				onChange={(index: number, _option: CoreSelectOption | null) => {
					if (props.onChange) {
						props.onChange(index, props.options[index]);
					}
				}}
				selectedIndex={props.selectedIndex ?? 0}
				focused={props.focused ?? true}
				width={props.width ?? 30}
				height={props.height ?? 10}
			/>
		</box>
	);
}
