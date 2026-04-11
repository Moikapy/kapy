/**
 * Command definitions and types.
 */

/** Positional argument definition */
export interface ArgDefinition {
	name: string;
	description?: string;
	default?: unknown;
	required?: boolean;
	variadic?: boolean;
}

/** Named flag definition */
export interface FlagDefinition {
	type: "string" | "boolean" | "number";
	alias?: string;
	description?: string;
	default?: unknown;
	required?: boolean;
}

/** Command handler function — uses import type to avoid circular deps */
export type CommandHandler = (ctx: import("./context.js").CommandContext) => Promise<void> | void;

/** Command options */
export interface CommandOptions {
	description: string;
	args?: ArgDefinition[];
	flags?: Record<string, FlagDefinition>;
	hidden?: boolean;
	middleware?: import("../middleware/pipeline.js").Middleware[];
}

/** Agent-readable hints for AI compatibility */
export interface AgentHints {
	purpose?: string;
	when?: string;
	output?: string;
	sideEffects?: string;
	requires?: string[];
}

/** Full command definition with handler */
export interface CommandDefinition {
	name: string;
	options: CommandOptions;
	handler: CommandHandler;
	agentHints?: AgentHints;
}
