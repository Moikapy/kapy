import type { SelectOption as CoreSelectOption } from "@opentui/core";
import type { JSX } from "solid-js";
import { useThemeColors } from "../theme.js";

export interface SelectOption {
	name: string;
	description?: string;
	value: string;
}

export interface SelectProps {
	options: SelectOption[];
	onChange?: (index: number, option: SelectOption) => void;
	selectedIndex?: number;
	focused?: boolean;
	width?: number;
	height?: number;
	bg?: string;
}

function toCoreOptions(options: SelectOption[]): CoreSelectOption[] {
	return options.map((o) => ({
		name: o.name,
		value: o.value,
		description: o.description ?? "",
	}));
}

export function Select(props: SelectProps): JSX.Element {
	const c = useThemeColors();
	const bgColor = () => props.bg ?? c().bgAlt;

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
