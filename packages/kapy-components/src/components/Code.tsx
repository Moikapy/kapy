/**
 * Code — syntax-highlighted code display component.
 *
 * Wraps OpenTUI's <code> primitive with kapy styling defaults.
 */
import type { JSX } from "solid-js";

export interface CodeProps {
	/** Code content */
	code: string;
	/** Programming language for syntax highlighting */
	language?: string;
}

/** Render a code block with syntax highlighting */
export function Code(props: CodeProps): JSX.Element {
	return (
		// @ts-expect-error — syntaxStyle has a runtime default but the type marks it required
		<code content={props.code} filetype={props.language ?? "typescript"} />
	);
}
