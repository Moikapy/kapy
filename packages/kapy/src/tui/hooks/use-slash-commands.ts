/**
 * Slash command handler for the kapy TUI.
 *
 * Commands that display information (help, models, tools, keys, sessions)
 * open a modal instead of appending system messages.
 * Commands that mutate state (clear, model) act directly.
 */

import type { CommandEntry } from "@moikapy/kapy-components";
import type { ModalView } from "../components/modal.js";
import type { Msg } from "../types.js";
import type { SessionInfo } from "../../ai/session/types.js";

/** Actions slash commands can trigger. */
export interface ChatActions {
	setMsgs: (fn: (prev: Msg[]) => Msg[]) => void;
	setModel: (model: string) => void;
	fetchModels: () => void;
	openModal: (view: ModalView) => void;
	/** Load a session by file path */
	loadSession: (path: string) => Promise<void>;
	/** List available sessions for current cwd */
	listSessions: () => Promise<SessionInfo[]>;
	/** List all sessions across all projects */
	listAllSessions: () => Promise<SessionInfo[]>;
	/** Current model string for highlighting in /models */
	model: () => string;
	/** Available model list (populated after fetchModels) */
	models: () => string[];
}

/** A slash command definition for the command palette. */
export type SlashCommand = CommandEntry;

/** Built-in slash commands available in the TUI. */
export const SLASH_COMMANDS: SlashCommand[] = [
	{
		name: "/help",
		description: "Show available commands",
		aliases: [],
	},
	{
		name: "/model",
		description: "Switch to a different model",
		takesArg: true,
		argLabel: "model-id",
	},
	{
		name: "/models",
		description: "List available models",
	},
	{
		name: "/tools",
		description: "List registered tools",
	},
	{
		name: "/keys",
		description: "Show keyboard shortcuts",
	},
	{
		name: "/clear",
		description: "Clear chat history",
	},
	{
		name: "/sessions",
		description: "List and resume previous sessions",
		aliases: ["/history"],
	},
];

const _TOOLS_TEXT = "Available tools: read_file, write_file, bash, glob, grep";

/**
 * Returns a slash command handler bound to the given chat actions.
 * Call as: `const handleSlash = useSlashCommands(chat)`
 */
export function useSlashCommands(actions: ChatActions) {
	return (text: string): boolean => {
		const cmd = text.trim().toLowerCase();

		if (cmd === "/clear") {
			actions.setMsgs(() => []);
			return true;
		}
		if (cmd === "/models") {
			actions.fetchModels();
			// Small delay to let fetchModels populate, then open modal
			setTimeout(() => {
				actions.openModal({
					type: "models",
					models: actions.models(),
					current: actions.model(),
				});
			}, 100);
			return true;
		}
		if (cmd === "/help") {
			actions.openModal({ type: "help" });
			return true;
		}
		if (cmd === "/tools") {
			actions.openModal({ type: "tools", tools: ["read_file", "write_file", "bash", "glob", "grep"] });
			return true;
		}
		if (cmd === "/keys") {
			actions.openModal({ type: "keys" });
			return true;
		}
		if (cmd === "/sessions" || cmd === "/history") {
			actions.openModal({ type: "sessions" });
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