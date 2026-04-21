/**
 * Slash command handler — processes /commands in the agent prompt.
 *
 * Commands: /help, /model, /agent, /compact, /tree, /fork, /clear, /quit
 */

import type { Agent } from "@moikapy/kapy-agent";
import type { ToolRegistry } from "../tool/registry.js";
import type { ChatSession } from "./chat-session.js";
import type { SessionManager } from "./session/manager.js";

/** Provider interface — implemented by ChatSession */
export interface SlashCommandProvider {
	getAllModels(): Array<{ id: string; label?: string; provider: string; supportsReasoning?: boolean }>;
}

export interface SlashCommandContext {
	agent: Agent;
	providers: SlashCommandProvider;
	tools: ToolRegistry;
	sessions: SessionManager;
	output: (text: string) => void;
	openDialog?: (type: string) => void;
	chatSession?: ChatSession;
}

export interface SlashCommandDefinition {
	name: string;
	description: string;
	handler: (args: string, ctx: SlashCommandContext) => Promise<void> | void;
}

/** Built-in slash commands */
export function createBuiltinSlashCommands(): SlashCommandDefinition[] {
	return [
		{
			name: "help",
			description: "Show available commands",
			handler(_args, ctx) {
				ctx.output("Available commands:");
				ctx.output("  /help     Show this help");
				ctx.output("  /model    Change LLM model");
				ctx.output("  /agent    Switch agent");
				ctx.output("  /compact  Compact session context");
				ctx.output("  /tree     Show session tree");
				ctx.output("  /fork     Fork current session");
				ctx.output("  /clear    Clear conversation");
				ctx.output("  /wiki     Browse the grimoire");
				ctx.output("  /soul     View SOUL.md info");
				ctx.output("  /telemetry  Telemetry settings");
				ctx.output("  /quit     Exit kapy");
			},
		},
		{
			name: "model",
			description: "Change LLM model",
			handler(_args, ctx) {
				const models = ctx.providers.getAllModels();
				if (models.length === 0) {
					ctx.output("No models available. Connect a provider first.");
					return;
				}
				ctx.output("Available models:");
				for (const model of models) {
					const current = ctx.agent.state.model?.id === model.id ? " ← current" : "";
					ctx.output(`  ${model.id} (${model.provider})${current}`);
				}
				ctx.openDialog?.("model");
			},
		},
		{
			name: "agent",
			description: "Switch agent",
			handler(_args, ctx) {
				ctx.output("Agent switching coming soon. Current: build");
				ctx.openDialog?.("agent");
			},
		},
		{
			name: "compact",
			description: "Compact session context",
			async handler(_args, ctx) {
				if (!ctx.chatSession) {
					ctx.output("Compaction requires an active session.");
					return;
				}
				try {
					await ctx.chatSession.forceCompact();
				} catch (err) {
					ctx.output(`Compaction failed: ${err instanceof Error ? err.message : String(err)}`);
				}
			},
		},
		{
			name: "tree",
			description: "Show session tree",
			handler(_args, ctx) {
				const entries = ctx.sessions.getEntries();
				if (entries.length === 0) {
					ctx.output("No session entries.");
					return;
				}
				for (const entry of entries) {
					const marker = !entry.parentId ? " (root)" : "";
					ctx.output(`├─ ${entry.id} [${entry.role}]${marker}`);
				}
			},
		},
		{
			name: "fork",
			description: "Fork current session",
			handler(_args, ctx) {
				const entries = ctx.sessions.getEntries();
				if (entries.length === 0) {
					ctx.output("No entries to fork from.");
					return;
				}
				ctx.output("Fork: use /branch <entry-id> to branch from an entry.");
			},
		},
		{
			name: "clear",
			description: "Clear conversation",
			handler(_args, ctx) {
				ctx.agent.reset();
				ctx.output("Conversation cleared.");
			},
		},
		{
			name: "quit",
			description: "Exit kapy",
			handler(_args, _ctx) {
				process.exit(0);
			},
		},
		{
			name: "wiki",
			description: "Browse the grimoire (agent knowledge base)",
			async handler(args, ctx) {
				const sub = args.trim();
				if (!sub) {
					ctx.output("📖 Grimoire commands:");
					ctx.output("  /wiki list    List wiki pages");
					ctx.output("  /wiki search  Search the grimoire");
					ctx.output("  /wiki stats   Show grimoire stats");
					ctx.output("  /wiki lint    Health-check the grimoire");
					return;
				}
				ctx.output("📖 Use 'kapy wiki' CLI for full grimoire operations");
			},
		},
		{
			name: "soul",
			description: "View info about SOUL.md (agent identity)",
			handler(_args, ctx) {
				ctx.output("📖 SOUL.md: ~/.kapy/SOUL.md");
				ctx.output("   Edit this file to shape your agent's identity.");
				ctx.output("   The agent can also evolve it during sessions.");
			},
		},
		{
			name: "telemetry",
			description: "View or toggle telemetry settings",
			handler(args, ctx) {
				const sub = args.trim();
				const { telemetry } = require("../telemetry/index.js");
				if (sub === "enable" || sub === "on") {
					void telemetry.enable();
					ctx.output("Telemetry: enabled");
					ctx.output("Anonymized bug/perf data will be sent. No content, no file paths, no personal data.");
					ctx.output("Edit ~/.kapy/config.json to change settings.");
				} else if (sub === "disable" || sub === "off") {
					void telemetry.disable();
					ctx.output("Telemetry: disabled");
					ctx.output("Edit ~/.kapy/config.json or /telemetry enable to re-enable.");
				} else {
					const status = telemetry.isEnabled() ? "enabled" : "disabled";
					ctx.output(`Telemetry: ${status} (opt-in)`);
					ctx.output("  /telemetry enable  — opt in to anonymized bug/perf tracking");
					ctx.output("  /telemetry disable — opt out");
					ctx.output("");
					ctx.output("What we track (if enabled):");
					ctx.output("  - Error types (no content, no stack)");
					ctx.output("  - Tool names + durations (no args, no results)");
					ctx.output("  - Model used + response time");
					ctx.output("  - Session counts/durations");
					ctx.output("We NEVER track: messages, file contents, personal data");
				}
			},
		},
	];
}

/** Process a slash command from user input */
export async function processSlashCommand(
	input: string,
	ctx: SlashCommandContext,
	commands?: SlashCommandDefinition[],
): Promise<boolean> {
	const trimmed = input.trim();
	if (!trimmed.startsWith("/")) return false;

	const parts = trimmed.slice(1).split(/\s+/);
	const name = parts[0];
	const args = parts.slice(1).join(" ");

	const allCommands = commands ?? createBuiltinSlashCommands();
	const cmd = allCommands.find((c) => c.name === name);

	if (!cmd) {
		ctx.output(`Unknown command: /${name}. Type /help for available commands.`);
		return true; // consume even if unknown
	}

	await cmd.handler(args, ctx);
	return true;
}
