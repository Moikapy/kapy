/**
 * Diff — diff viewer component.
 *
 * Wraps OpenTUI's <diff> primitive with kapy styling defaults.
 * Note: OpenTUI's diff component accepts a unified diff string via the `diff` prop,
 * or separate old/new code via the `oldCode`/`newCode` props.
 */
import type { JSX } from "solid-js";

export interface DiffProps {
	/** Unified diff string (standard diff format) */
	diff?: string;
	/** Original content (used when not providing diff string) */
	original?: string;
	/** Modified content (used when not providing diff string) */
	modified?: string;
	/** Language for syntax highlighting */
	language?: string;
	/** Diff display mode */
	mode?: "unified" | "split";
}

/** Render a diff view */
export function Diff(props: DiffProps): JSX.Element {
	return (
		<diff
			diff={props.diff}
			oldCode={props.original}
			newCode={props.modified}
			filetype={props.language}
			view={props.mode ?? "unified"}
		/>
	);
}
