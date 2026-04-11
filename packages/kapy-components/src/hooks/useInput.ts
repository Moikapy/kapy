/**
 * useInput — keyboard input hook for TUI screens.
 *
 * Provides a reactive interface for handling keyboard events in
 * OpenTUI screen components.
 */
import type { Key } from "../types.js";

export interface UseInputOptions {
	/** Whether the hook is active (defaults to true) */
	isActive?: boolean;
	/** Whether to prevent default browser behavior */
	preventDefault?: boolean;
}

export type InputHandler = (key: Key, input: string) => void;

/**
 * Hook for handling keyboard input in TUI screens.
 * Returns an object compatible with OpenTUI's hook system.
 */
export function useInput(handler: InputHandler, options: UseInputOptions = {}) {
	return {
		type: "useInput" as const,
		handler,
		isActive: options.isActive ?? true,
		preventDefault: options.preventDefault ?? true,
	};
}
