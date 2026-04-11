/**
 * kapy-components — UI components for kapy TUI, built on @opentui/core.
 *
 * Common types used across components.
 */

/** Component function type */
export type Component<P = Record<string, unknown>> = (props: P) => unknown;

/** Renderable node */
export type Renderable = unknown;

/** Key event from keyboard input */
export interface Key {
	name?: string;
	sequence?: string;
	ctrl?: boolean;
	meta?: boolean;
	shift?: boolean;
}
