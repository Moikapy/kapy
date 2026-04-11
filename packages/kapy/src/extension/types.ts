/**
 * Extension types — meta, register, and API surface.
 */
import type { CommandDefinition, CommandHandler, CommandOptions, AgentHints } from "../command/parser.js";
import type { Middleware } from "../middleware/pipeline.js";
import type { HookHandler } from "../hooks/types.js";
import type { ConfigSchema } from "../config/schema.js";

/** Extension metadata */
export interface ExtensionMeta {
	name: string;
	version: string;
	dependencies?: string[];
	permissions?: string[];
}

/** Extension register function */
export type ExtensionRegister = (api: KapyExtensionAPI) => Promise<void | (() => void)>;

/** Screen definition for TUI */
export interface ScreenDefinition {
	name: string;
	label: string;
	icon?: string;
	render: (ctx: ScreenContext) => unknown; // OpenTUI renderable
	keyBindings?: Record<string, string>;
}

/** Screen context (simplified for MVP) */
export interface ScreenContext {
	[key: string]: unknown;
}

/** The extension API surface */
export interface KapyExtensionAPI {
	/** Register a command */
	addCommand(definition: CommandDefinition): void;
	addCommand(name: string, options: CommandOptions, handler: CommandHandler): void;
	addCommand(name: string, options: CommandOptions & { agentHints?: AgentHints }, handler: CommandHandler): void;

	/** Register a hook */
	addHook(event: string, handler: HookHandler): void;

	/** Register middleware */
	addMiddleware(middleware: Middleware): void;

	/** Declare config schema (auto-namespaced) */
	declareConfig(schema: ConfigSchema): void;

	/** Register a TUI screen */
	addScreen(screen: ScreenDefinition): void;

	/** Emit a custom event */
	emit(event: string, data?: unknown): void;

	/** Listen for a custom event */
	on(event: string, handler: (data?: unknown) => Promise<void> | void): void;
}