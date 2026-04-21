import type { SyntaxStyle } from "@opentui/core";
import type { JSX } from "solid-js";
import { useThemeColors } from "../theme.js";

export interface DiffProps {
	diff?: string;
	original?: string;
	modified?: string;
	language?: string;
	mode?: "unified" | "split";
	syntaxStyle?: SyntaxStyle;
	showLineNumbers?: boolean;
	wrapMode?: "word" | "char" | "none";
	fg?: string;
	addedBg?: string;
	removedBg?: string;
	contextBg?: string;
	addedSignColor?: string;
	removedSignColor?: string;
	lineNumberFg?: string;
	addedLineNumberBg?: string;
	removedLineNumberBg?: string;
	conceal?: boolean;
}

export function Diff(props: DiffProps): JSX.Element {
	const c = useThemeColors();
	return (
		<diff
			diff={props.diff}
			oldCode={props.original}
			newCode={props.modified}
			filetype={props.language}
			view={props.mode ?? "unified"}
			syntaxStyle={props.syntaxStyle}
			showLineNumbers={props.showLineNumbers ?? true}
			wrapMode={props.wrapMode ?? "word"}
			fg={props.fg ?? c().text}
			addedBg={props.addedBg ?? c().diffAddedBg}
			removedBg={props.removedBg ?? c().diffRemovedBg}
			contextBg={props.contextBg ?? c().diffContextBg}
			addedSignColor={props.addedSignColor ?? c().diffHighlightAdded}
			removedSignColor={props.removedSignColor ?? c().diffHighlightRemoved}
			lineNumberFg={props.lineNumberFg ?? c().diffLineNumber}
			addedLineNumberBg={props.addedLineNumberBg ?? c().diffAddedLineNumberBg}
			removedLineNumberBg={props.removedLineNumberBg ?? c().diffRemovedLineNumberBg}
			conceal={props.conceal ?? false}
		/>
	);
}
