/**
 * Code — code display component with syntax highlighting.
 *
 * Renders code blocks with optional language-specific highlighting.
 */
import type { Component } from "../types.js";

export interface CodeProps {
	/** Code content */
	content: string;
	/** Programming language for syntax highlighting */
	language?: string;
	/** Whether to show line numbers */
	lineNumbers?: boolean;
	/** Highlight specific lines */
	highlightLines?: number[];
	/** Max height before scrolling */
	maxHeight?: number;
	/** Theme */
	theme?: "dark" | "light";
}

/** Render a code block with syntax highlighting */
export const Code: Component<CodeProps> = (props: CodeProps) => {
	return {
		type: "Code",
		props: {
			content: props.content,
			language: props.language ?? "typescript",
			lineNumbers: props.lineNumbers ?? true,
			highlightLines: props.highlightLines ?? [],
			maxHeight: props.maxHeight,
			theme: props.theme ?? "dark",
		},
	};
};
