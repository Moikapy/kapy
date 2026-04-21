/**
 * TUI shell — kapy tui command. Legacy imperative TUI for extension screens.
 *
 * Uses the ExitProvider pattern: renderer.destroy() + resolve promise,
 * never process.exit(). This prevents borked terminals in tmux.
 *
 * NOTE: The agent-first TUI (kapy with no args) lives in tui/app.tsx
 * and uses Solid components. This is the legacy imperative version for
 * `kapy tui` command which renders extension screens.
 */

import type { CommandContext } from "../command/context.js";
import { launchChatTUI } from "./app.js";

export interface TUIOptions {
	screens: any[];
	initialScreen?: string;
}

/**
 * Launch the TUI.
 *
 * When screens are registered (extension screens), this could launch the
 * imperative TUI. For now, always launches the agent-first chat TUI.
 */
export async function launchTUI(_options: TUIOptions, ctx: CommandContext): Promise<void> {
	if (ctx.noInput || ctx.json) {
		ctx.error("TUI requires an interactive terminal. Use commands without --json or --no-input.");
		return;
	}

	if (!process.stdout.isTTY) {
		ctx.error("TUI requires an interactive terminal (TTY).");
		return;
	}

	// Agent-first: always launch the chat TUI
	await launchChatTUI();
}

// Re-export for convenience
export { launchChatTUI } from "./app.js";
