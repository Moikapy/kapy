/**
 * Slash command composable for the TUI chat.
 *
 * Takes chat reactive state, returns a bound handler function.
 * Keeps command routing logic separate from presentation.
 */

import type { Msg } from "../types.js";

/** Reactive setters from createChat() that slash commands need. */
export interface ChatActions {
	setMsgs: (fn: (prev: Msg[]) => Msg[]) => void;
	setModel: (model: string) => void;
	setSidebar: (fn: (v: boolean) => boolean) => void;
	fetchModels: () => void;
}

const HELP_TEXT = `Commands:
  /help     Show this help
  /model X   Switch to model X
  /models    List available models
  /tools     List registered tools
  /sidebar   Toggle sidebar
  /clear     Clear chat
  exit       Quit kapy`;

const TOOLS_TEXT = "Available tools: read_file, write_file, bash, glob, grep";

/**
 * Returns a slash command handler bound to the given chat actions.
 * Call as: `const handleSlash = useSlashCommands(chat)`
 */
export function useSlashCommands(actions: ChatActions) {
	return (text: string): boolean => {
		const cmd = text.trim().toLowerCase();

		if (cmd === "/sidebar" || cmd === "/sb") {
			actions.setSidebar((v) => !v);
			return true;
		}
		if (cmd === "/clear") {
			actions.setMsgs(() => []);
			return true;
		}
		if (cmd === "/models") {
			actions.fetchModels();
			return true;
		}
		if (cmd === "/help") {
			actions.setMsgs((prev) => [
				...prev,
				{
					id: `h-${Date.now()}`,
					role: "system" as const,
					content: HELP_TEXT,
				},
			]);
			return true;
		}
		if (cmd === "/tools") {
			actions.setMsgs((prev) => [
				...prev,
				{
					id: `t-${Date.now()}`,
					role: "system" as const,
					content: TOOLS_TEXT,
				},
			]);
			return true;
		}

		const modelMatch = text.trim().match(/^\/model\s+(.+)$/i);
		if (modelMatch) {
			actions.setModel(modelMatch[1].trim());
			return true;
		}

		return false;
	};
}
