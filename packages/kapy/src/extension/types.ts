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

/** Extension register function */
export type ExtensionRegister = (api: KapyExtensionAPI) => Promise<undefined | (() => void)>;

/** Screen definition for TUI */
export interface ScreenDefinition {
	name: string;
	label: string;
	icon?: string;
	render: (ctx: ScreenContext) => unknown | Promise<unknown>;
	keyBindings?: Record<string, string>;
}

/** Screen context passed to render() — includes the OpenTUI renderer */
export interface ScreenContext {
	/** The OpenTUI renderer instance */
	renderer?: unknown;
	/** Current terminal width */
	width?: number;
	/** Current terminal height */
	height?: number;
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
