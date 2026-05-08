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

/** Valid command name pattern: lowercase letters, numbers, hyphens, and colon separators */
export const COMMAND_NAME_PATTERN = /^[a-z0-9][a-z0-9:-]*$/;

/** Validate a command name follows kapy conventions */
export function validateCommandName(name: string): string | null {
	if (!name) return "Command name cannot be empty";
	if (name.includes(" ")) return `Command name "${name}" cannot contain spaces`;
	if (name.includes("::")) return `Command name "${name}" cannot contain double colons`;
	if (name.startsWith(":") || name.endsWith(":")) return `Command name "${name}" cannot start or end with a colon`;
	if (!COMMAND_NAME_PATTERN.test(name))
		return `Command name "${name}" must match ${COMMAND_NAME_PATTERN.toString()} (lowercase, numbers, hyphens, colons)`;
	return null;
}

/** Valid hook event pattern: before:*, after:*, on:* */
const HOOK_EVENT_PATTERN = /^(before|after|on):[a-z][a-z0-9:-]*$/;

/** Validate a hook event name follows kapy conventions */
export function validateHookEvent(event: string): string | null {
	if (!event) return "Hook event cannot be empty";
	if (!HOOK_EVENT_PATTERN.test(event))
		return `Hook event "${event}" must follow pattern: before:*, after:*, or on:* (lowercase, no spaces)`;
	return null;
}

/** Full command definition with handler */
export interface CommandDefinition {
	name: string;
	options: CommandOptions;
	handler: CommandHandler;
	agentHints?: AgentHints;
}
