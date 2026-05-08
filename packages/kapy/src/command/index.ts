export type { SpawnOptions, SpawnResult, TeardownCallback } from "./context.js";
export { AbortError, CommandContext, Spinner } from "./context.js";
export type {
	AgentHints,
	ArgDefinition,
	CommandDefinition,
	CommandHandler,
	CommandOptions,
	FlagDefinition,
} from "./parser.js";
export { COMMAND_NAME_PATTERN, validateCommandName, validateHookEvent } from "./parser.js";
export { CommandRegistry, parseArgs } from "./registry.js";
