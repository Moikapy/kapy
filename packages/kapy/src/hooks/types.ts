/**
 * Hook system types and execution.
 */

import type { CommandContext } from "../command/context.js";

/** Hook handler function */
export type HookHandler = (ctx: CommandContext) => Promise<void> | void;

/** Registered hook entry */
export interface HookEntry {
	event: string;
	handler: HookHandler;
	extensionName?: string;
}

/** Hook execution order */
export enum HookPhase {
	Before = "before",
	After = "after",
}

/** Resolve a hook event name (e.g., "before:deploy") into phase and command */
export function parseHookEvent(event: string): { phase: HookPhase; command?: string } | null {
	if (event.startsWith("before:")) {
		return { phase: HookPhase.Before, command: event.slice(7) };
	}
	if (event.startsWith("after:")) {
		return { phase: HookPhase.After, command: event.slice(6) };
	}
	if (event === "before:command" || event === "after:command") {
		return { phase: event.startsWith("before") ? HookPhase.Before : HookPhase.After };
	}
	return null;
}
