/**
 * Extension types — meta, register, and API surface.
 */
import type { AgentHints, CommandDefinition, CommandHandler, CommandOptions } from "../command/parser.js";
import type { ConfigSchema } from "../config/schema.js";
import type { HookHandler } from "../hooks/types.js";
import type { Middleware } from "../middleware/pipeline.js";

/** Extension metadata */
export interface ExtensionMeta {
	name: string;
	version: string;
	dependencies?: string[];
	permissions?: string[];
}

/** Extension register function — returns undefined or a cleanup function */
export type ExtensionRegister = (api: KapyExtensionAPI) => Promise<undefined | (() => void)>;

/** The extension API surface */
export interface KapyExtensionAPI {
	/** Register a command */
	addCommand(definition: CommandDefinition): void;
	addCommand(name: string, options: CommandOptions & { agentHints?: AgentHints }, handler: CommandHandler): void;

	/** Register a hook (event must follow before:*, after:*, on:* pattern) */
	addHook(event: string, handler: HookHandler): void;

	/** Register middleware */
	addMiddleware(middleware: Middleware): void;

	/** Declare config schema (auto-namespaced) */
	declareConfig(schema: ConfigSchema): void;

	/** Emit a custom event */
	emit(event: string, data?: unknown): void;

	/** Listen for a custom event */
	on(event: string, handler: (data?: unknown) => Promise<void> | void): void;
}
