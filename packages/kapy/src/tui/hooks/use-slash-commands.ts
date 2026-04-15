/**
 * Slash command registry and handler for the TUI chat.
 *
 * Defines the available commands, provides a registry for UI discovery,
 * and returns a bound handler function for execution.
 */

import type { Msg } from "../types.js";

/** Reactive setters from createChat() that slash commands need. */
export interface ChatActions {
	setMsgs: (fn: (prev: Msg[]) => Msg[]) => void;
	setModel: (model: string) => void;
	setSidebar: (fn: (v: boolean) => boolean) => void;
	fetchModels: () => void;
}

/** A slash command definition for the command palette. */
export interface SlashCommand {
	/** The command trigger (e.g. "/help", "/model") */
	name: string;
	/** Short description for the palette */
	description: string;
	/** Aliases (e.g. "/sb" for "/sidebar") */
	aliases?: string[];
	/** Whether the command takes an argument (e.g. "/model llama3") */
	takesArg?: boolean;
	/** Argument label for the palette (e.g. "model-id") */
	argLabel?: string;
}

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
		name: "/sidebar",
		description: "Toggle sidebar",
		aliases: ["/sb"],
	},
	{
		name: "/clear",
		description: "Clear chat history",
	},
];

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

/**
 * Filter command list by partial input (e.g. "/m" matches "/model", "/models").
 * Returns commands whose name or aliases start with the prefix.
 */
export function filterCommands(prefix: string): SlashCommand[] {
	const lower = prefix.toLowerCase();
	return SLASH_COMMANDS.filter((cmd) => {
		if (cmd.name.startsWith(lower)) return true;
		return cmd.aliases?.some((a) => a.startsWith(lower)) ?? false;
	});
}
