/**
 * DialogProvider — context-based dialog system for the kapy TUI.
 *
 * Modeled on OpenCode's Dialog pattern:
 * - `position="absolute"` + `zIndex={3000}` overlay rendered at root level
 * - Semi-transparent backdrop (`RGBA 0,0,0,150`)
 * - Stack-based: `replace()` pushes, Escape pops, `clear()` removes all
 * - Focus save/restore on open/close
 * - Click-outside-to-close (dismiss if no text selection)
 * - Works on ALL screens (home + session) because it renders at Provider level
 */

import { useThemeColors } from "@moikapy/kapy-components";
import { type Renderable, RGBA } from "@opentui/core";
import { useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/solid";
import { batch, createContext, createSignal, type JSX, type ParentProps, Show, useContext } from "solid-js";

// ── Dialog overlay component ────────────────────────────────────────

function Dialog(
	props: ParentProps<{
		size?: "medium" | "large" | "xlarge";
		onClose: () => void;
	}>,
) {
	const dimensions = useTerminalDimensions();
	const renderer = useRenderer();
	const c = useThemeColors();

	/** Track whether a text selection is active on mouse-down.
	 *  If so, don't close on mouse-up (user is selecting text, not clicking backdrop). */
	let dismiss = false;

	const width = () => {
		if (props.size === "xlarge") return Math.min(116, dimensions().width - 4);
		if (props.size === "large") return Math.min(88, dimensions().width - 4);
		return Math.min(60, dimensions().width - 4);
	};

	return (
		<box
			// Backdrop: click to close (unless selecting text)
			onMouseDown={() => {
				dismiss = !!renderer.getSelection();
			}}
			onMouseUp={() => {
				if (dismiss) {
					dismiss = false;
					return;
				}
				props.onClose?.();
			}}
			width={dimensions().width}
			height={dimensions().height}
			alignItems="center"
			justifyContent="center"
			position="absolute"
			zIndex={3000}
			left={0}
			top={0}
			backgroundColor={RGBA.fromInts(0, 0, 0, 150)}
		>
			<box
				// Inner content: stop propagation so clicks don't close the dialog
				onMouseUp={(e: any) => {
					dismiss = false;
					e.stopPropagation();
				}}
				width={width()}
				maxWidth={dimensions().width - 2}
				border={["top", "right", "bottom", "left"]}
				borderColor={c().borderDim}
				backgroundColor={c().bgPanel}
				paddingTop={1}
				paddingBottom={1}
				paddingLeft={2}
				paddingRight={2}
			>
				{props.children}
			</box>
		</box>
	);
}

// ── Dialog context + state management ────────────────────────────────

function init() {
	const [stack, setStack] = createSignal<{ element: JSX.Element; onClose?: () => void }[]>([]);
	const [dialogSize, setDialogSize] = createSignal<"medium" | "large" | "xlarge">("medium");

	const renderer = useRenderer();

	/** Save focus before opening a dialog, restore after closing. */
	let savedFocus: Renderable | null = null;

	/** Re-focus the previously focused element after dialog closes. */
	function refocus() {
		setTimeout(() => {
			if (!savedFocus) return;
			if (savedFocus.isDestroyed) return;

			function find(item: Renderable): boolean {
				for (const child of item.getChildren()) {
					if (child === savedFocus) return true;
					if (find(child)) return true;
				}
				return false;
			}

			const found = find(renderer.root);
			if (found) savedFocus.focus();
		}, 1);
	}

	/** Global keyboard handler: Escape / Ctrl+C closes top dialog. */
	useKeyboard((evt: any) => {
		if (stack().length === 0) return;
		if (evt.defaultPrevented) return;

		// Don't close if user is releasing a text selection
		if ((evt.name === "escape" || (evt.ctrl && evt.name === "c")) && renderer.getSelection()?.getSelectedText()) {
			return;
		}

		if (evt.name === "escape" || (evt.ctrl && evt.name === "c")) {
			// Clear text selection first, then close dialog on next press
			if (renderer.getSelection()) {
				renderer.clearSelection();
				evt.preventDefault();
				evt.stopPropagation();
				return;
			}

			const current = stack().at(-1)!;
			current.onClose?.();
			batch(() => {
				setStack(stack().slice(0, -1));
			});
			evt.preventDefault();
			evt.stopPropagation();
			refocus();
		}
	});

	return {
		/** Remove all dialogs from the stack. */
		clear() {
			for (const item of stack()) {
				item.onClose?.();
			}
			batch(() => {
				setDialogSize("medium");
				setStack([]);
			});
			refocus();
		},

		/** Replace the dialog stack with a new dialog. Saves focus first. */
		replace(element: JSX.Element | (() => JSX.Element), onClose?: () => void) {
			if (stack().length === 0) {
				savedFocus = renderer.currentFocusedRenderable;
				savedFocus?.blur();
			}
			// Close any existing dialogs
			for (const item of stack()) {
				item.onClose?.();
			}
			setDialogSize("medium");
			const el = typeof element === "function" ? element() : element;
			setStack([{ element: el, onClose }]);
		},

		/** Push a new dialog on top of the stack (for future nested dialogs). */
		push(element: JSX.Element | (() => JSX.Element), onClose?: () => void) {
			if (stack().length === 0) {
				savedFocus = renderer.currentFocusedRenderable;
				savedFocus?.blur();
			}
			const el = typeof element === "function" ? element() : element;
			setStack([...stack(), { element: el, onClose }]);
		},

		/** Pop the top dialog. */
		pop() {
			const current = stack().at(-1);
			current?.onClose?.();
			setStack(stack().slice(0, -1));
			if (stack().length === 0) refocus();
		},

		get stack() {
			return stack();
		},
		get size() {
			return dialogSize();
		},
		setSize(s: "medium" | "large" | "xlarge") {
			setDialogSize(s);
		},
	};
}

export type DialogContext = ReturnType<typeof init>;

const ctx = createContext<DialogContext>();

/** Provider that wraps the app and renders dialogs at the root level. */
export function DialogProvider(props: ParentProps) {
	const value = init();

	return (
		<ctx.Provider value={value}>
			<box position="relative" width="100%" height="100%">
				{props.children}
				<DialogStackOverlay value={value} />
			</box>
		</ctx.Provider>
	);
}

/** Renders the dialog overlay. Separate component so signals are tracked in its own scope. */
function DialogStackOverlay(props: { value: DialogContext }) {
	const stack = () => props.value.stack;

	return (
		<Show when={stack().length > 0}>
			<Dialog onClose={() => props.value.clear()} size={props.value.size}>
				{stack().at(-1)?.element}
			</Dialog>
		</Show>
	);
}

/** Access the dialog context from any component inside DialogProvider. */
export function useDialog() {
	const value = useContext(ctx);
	if (!value) {
		throw new Error("useDialog must be used within a DialogProvider");
	}
	return value;
}
