/**
 * Text — text rendering component.
 *
 * Displays text with configurable color, weight, and styling.
 * Delegates to @opentui/core's Text primitive with kapy defaults.
 */
import type { Component } from "../types.js";

export interface TextProps {
	/** Text content */
	content: string;
	/** Foreground color */
	fg?: string;
	/** Background color */
	bg?: string;
	/** Font weight */
	weight?: "normal" | "bold";
	/** Italic style */
	italic?: boolean;
	/** Underline */
	underline?: boolean;
	/** Strikethrough */
	strikethrough?: boolean;
	/** Text alignment */
	align?: "left" | "center" | "right";
	/** Whether text wraps */
	wrap?: boolean;
}

/** Render styled text */
export const Text: Component<TextProps> = (props: TextProps) => {
	return {
		type: "Text",
		props: {
			content: props.content,
			foreground: props.fg,
			background: props.bg,
			weight: props.weight ?? "normal",
			italic: props.italic ?? false,
			underline: props.underline ?? false,
			strikethrough: props.strikethrough ?? false,
			align: props.align ?? "left",
			wrap: props.wrap ?? true,
		},
	};
};