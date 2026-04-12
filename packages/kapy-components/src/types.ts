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

/** Descriptor for a declarative component tree — materialized by the TUI shell */
export interface ComponentDescriptor {
	/** Component type name (e.g. 'Box', 'Text', 'Input') */
	type: string;
	/** Component-specific props */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	props: any;
	/** Child descriptors (for container components) */
	children?: ComponentDescriptor[];
}

/** Type guard for ComponentDescriptor */
export function isComponentDescriptor(value: unknown): value is ComponentDescriptor {
	return (
		typeof value === "object" &&
		value !== null &&
		"type" in value &&
		"props" in value &&
		typeof (value as ComponentDescriptor).type === "string"
	);
}