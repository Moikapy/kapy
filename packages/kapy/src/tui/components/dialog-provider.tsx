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

import { useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/solid";
import { batch, createContext, Show, useContext, type JSX, type ParentProps } from "solid-js";
import { createStore } from "solid-js/store";
import { RGBA, type Renderable } from "@opentui/core";

// ── Dialog overlay component ────────────────────────────────────────

function Dialog(
	props: ParentProps<{
		size?: "medium" | "large" | "xlarge";
		onClose: () => void;
	}>,
) {
	const dimensions = useTerminalDimensions();
	const renderer = useRenderer();

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
				borderColor="#00AAFF"
				backgroundColor="#1a1b26"
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
	const [store, setStore] = createStore({
		stack: [] as {
			element: JSX.Element;
			onClose?: () => void;
		}[],
		size: "medium" as "medium" | "large" | "xlarge",
	});

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
		if (store.stack.length === 0) return;
		if (evt.defaultPrevented) return;

		// Don't close if user is releasing a text selection
		if (
			(evt.name === "escape" || (evt.ctrl && evt.name === "c")) &&
			renderer.getSelection()?.getSelectedText()
		) {
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

			const current = store.stack.at(-1)!;
			current.onClose?.();
			batch(() => {
				setStore("stack", store.stack.slice(0, -1));
			});
			evt.preventDefault();
			evt.stopPropagation();
			refocus();
		}
	});

	return {
		/** Remove all dialogs from the stack. */
		clear() {
			for (const item of store.stack) {
				item.onClose?.();
			}
			batch(() => {
				setStore("size", "medium");
				setStore("stack", []);
			});
			refocus();
		},

		/** Replace the dialog stack with a new dialog. Saves focus first. */
		replace(element: JSX.Element | (() => JSX.Element), onClose?: () => void) {
			// Save focus on first dialog open
			if (store.stack.length === 0) {
				savedFocus = renderer.currentFocusedRenderable;
				savedFocus?.blur();
			}
			// Close any existing dialogs
			for (const item of store.stack) {
				item.onClose?.();
			}
			setStore("size", "medium");
			const el = typeof element === "function" ? element() : element;
			setStore("stack", [{ element: el, onClose }]);
		},

		/** Push a new dialog on top of the stack (for future nested dialogs). */
		push(element: JSX.Element | (() => JSX.Element), onClose?: () => void) {
			if (store.stack.length === 0) {
				savedFocus = renderer.currentFocusedRenderable;
				savedFocus?.blur();
			}
			const el = typeof element === "function" ? element() : element;
			setStore("stack", [...store.stack, { element: el, onClose }]);
		},

		/** Pop the top dialog. */
		pop() {
			const current = store.stack.at(-1);
			current?.onClose?.();
			setStore("stack", store.stack.slice(0, -1));
			if (store.stack.length === 0) refocus();
		},

		get stack() {
			return store.stack;
		},
		get size() {
			return store.size;
		},
		setSize(size: "medium" | "large" | "xlarge") {
			setStore("size", size);
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
			{props.children}
			{/* Dialog overlay renders here — outside the route switch, works on all screens */}
			<Show when={value.stack.length > 0}>
				<Dialog onClose={() => value.clear()} size={value.size}>
					{value.stack.at(-1)!.element}
				</Dialog>
			</Show>
		</ctx.Provider>
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