import type { CommandEntry } from "@moikapy/kapy-components";
import { setTheme } from "@moikapy/kapy-components";
import type { SessionInfo } from "../../ai/session/types.js";
import type { ModalView } from "../components/modal.js";
import type { Msg } from "../types.js";
import { useTuiSettings } from "./use-tui-settings.js";

export interface ChatActions {
	setMsgs: (fn: (prev: Msg[]) => Msg[]) => void;
	setModel: (model: string) => void;
	fetchModels: () => void;
	openModal: (view: ModalView) => void;
	loadSession: (path: string) => Promise<void>;
	listSessions: () => Promise<SessionInfo[]>;
	listAllSessions: () => Promise<SessionInfo[]>;
	setThinkingLevel: (level: string) => void;
	model: () => string;
	models: () => string[];
	compact: () => void;
	getSessionTree: () => { id: string; parentId: string | null; type: string; role?: string; content?: string }[];
}

export type SlashCommand = CommandEntry;

const THINK_LEVELS: SlashCommand[] = [
	{ name: "/think off", description: "No thinking tokens (fastest)" },
	{ name: "/think low", description: "Light reasoning" },
	{ name: "/think medium", description: "Balanced thinking (recommended)" },
	{ name: "/think high", description: "Deep reasoning" },
	{ name: "/think xhigh", description: "Maximum thinking budget" },
];

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
		name: "/think",
		description: "Set thinking level",
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
	{
		name: "/details",
		description: "Toggle tool result details",
	},
	{
		name: "/compact",
		description: "Compact conversation context",
	},
	{
		name: "/tree",
		description: "View session branching tree",
	},
	{
		name: "/theme",
		description: "Switch color theme",
	},
];

export const ALL_PALETTE_COMMANDS: SlashCommand[] = [...SLASH_COMMANDS, ...THINK_LEVELS];

export function useSlashCommands(actions: ChatActions) {
	const settings = useTuiSettings();

	return (text: string): boolean => {
		const cmd = text.trim().toLowerCase();

		if (cmd === "/clear") {
			actions.setMsgs(() => []);
			return true;
		}
		if (cmd === "/models") {
			actions.fetchModels();
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
			actions.setMsgs((prev) => [
				...prev,
				{
					id: `sys-${Date.now()}`,
					role: "system" as const,
					content: "Slash commands working! Try /models, /tools, /keys, /clear, /details, /compact, /tree, /theme",
				},
			]);
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
			actions.openModal({ type: "sessions", onLoad: actions.loadSession });
			return true;
		}

		const modelMatch = text.trim().match(/^\/model\s+(.+)$/i);
		if (modelMatch) {
			actions.setModel(modelMatch[1].trim());
			return true;
		}

		const thinkMatch = text.trim().match(/^\/think\s+(off|low|medium|high|xhigh)$/i);
		if (thinkMatch) {
			actions.setThinkingLevel(thinkMatch[1].toLowerCase());
			return true;
		}

		if (cmd === "/details") {
			settings.toggleDetails();
			return true;
		}

		if (cmd === "/compact") {
			actions.compact();
			return true;
		}

		if (cmd === "/tree") {
			const entries = actions.getSessionTree();
			actions.openModal({ type: "tree", entries });
			return true;
		}

		const themeMatch = text.trim().match(/^\/theme\s+(\S+)$/i);
		if (themeMatch) {
			const name = themeMatch[1].toLowerCase();
			const ok = setTheme(name, settings.setTheme);
			if (!ok) {
				actions.openModal({ type: "themes" });
			}
			return true;
		}

		if (cmd === "/theme") {
			actions.openModal({ type: "themes" });
			return true;
		}

		return false;
	};
}
