/**
 * Diff — diff viewer component.
 *
 * Renders a side-by-side or unified diff view for comparing text.
 */
import type { Component } from "../types.js";

export interface DiffProps {
	/** Original content */
	original: string;
	/** Modified content */
	modified: string;
	/** Diff display mode */
	mode?: "unified" | "split";
	/** Language for syntax highlighting */
	language?: string;
	/** Context lines around changes */
	contextLines?: number;
	/** Max height before scrolling */
	maxHeight?: number;
}

/** Render a diff view */
export const Diff: Component<DiffProps> = (props: DiffProps) => {
	return {
		type: "Diff",
		props: {
			original: props.original,
			modified: props.modified,
			mode: props.mode ?? "unified",
			language: props.language,
			contextLines: props.contextLines ?? 3,
			maxHeight: props.maxHeight,
		},
	};
};