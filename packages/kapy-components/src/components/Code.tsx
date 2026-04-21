import type { SyntaxStyle } from "@opentui/core";
import type { JSX } from "solid-js";
import { useThemeColors } from "../theme.js";

export interface CodeProps {
	code: string;
	language?: string;
	syntaxStyle?: SyntaxStyle;
	streaming?: boolean;
	conceal?: boolean;
	drawUnstyledText?: boolean;
	fg?: string;
	selectable?: boolean;
}

export function Code(props: CodeProps): JSX.Element {
	const c = useThemeColors();
	return (
		<code
			content={props.code}
			filetype={props.language ?? "typescript"}
			syntaxStyle={props.syntaxStyle}
			streaming={props.streaming ?? false}
			conceal={props.conceal ?? true}
			drawUnstyledText={props.drawUnstyledText ?? false}
			fg={props.fg ?? c().text}
			selectable={props.selectable ?? true}
		/>
	);
}
