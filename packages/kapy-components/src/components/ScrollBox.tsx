/**
 * ScrollBox — styled scrollable container for kapy TUI.
 *
 * Wraps OpenTUI's <scrollbox> primitive with kapy scrollbar styling.
 */
import type { JSX } from "solid-js";

export interface ScrollBoxProps {
	/** Width (number or percentage string like "100%") */
	width?: number | `${number}%`;
	/** Height (number or percentage string like "100%") */
	height?: number | `${number}%`;
	/** Whether the scrollbox has focus */
	focused?: boolean;
	/** Children */
	children?: JSX.Element;
}

/** Styled scrollable container with kapy theme */
export function ScrollBox(props: ScrollBoxProps): JSX.Element {
	return (
		<scrollbox focused={props.focused ?? true} width={props.width ?? "100%"} height={props.height ?? "100%"}>
			{props.children}
		</scrollbox>
	);
}
