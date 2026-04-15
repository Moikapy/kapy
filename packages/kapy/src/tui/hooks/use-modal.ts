/**
 * useModal — reactive modal state for the kapy TUI.
 *
 * Manages which modal view is active. Escape closes the modal.
 * Slash commands that show information (help, models, tools) set
 * the modal view instead of appending system messages.
 */

import { createSignal } from "solid-js";
import type { ModalView } from "../components/modal.js";

export function useModal() {
	const [view, setView] = createSignal<ModalView | null>(null);

	return {
		view,
		open: (v: ModalView) => setView(v),
		close: () => setView(null),
		isOpen: () => view() !== null,
	};
}
