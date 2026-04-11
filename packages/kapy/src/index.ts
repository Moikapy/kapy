/**
 * kapy — Extensible CLI framework.
 *
 * Public API: kapy() builder, defineConfig, types, and re-exports.
 */
export { kapy, defineConfig } from "./cli.js";
export type { KapyBuilder } from "./cli.js";

// Command system
export { CommandRegistry, parseArgs } from "./command/index.js";
export { CommandContext, AbortError } from "./command/context.js";
export type {
	CommandDefinition,
	CommandOptions,
	ArgDefinition,
	FlagDefinition,
	CommandHandler,
	AgentHints,
} from "./command/parser.js";

// Config system
export { loadConfig, parseEnvConfig, deepMergeConfigs, DEFAULT_ENV_PREFIX } from "./config/index.js";
export type { ConfigField, ConfigSchema, MergedConfig, ProjectConfig, GlobalConfig } from "./config/index.js";

// Hooks
export { ExtensionEmitter } from "./hooks/index.js";
export type { HookHandler, HookEntry } from "./hooks/index.js";

// Middleware
export { composeMiddleware, logging, timing, errorHandler, EXIT_CODES } from "./middleware/index.js";
export type { Middleware } from "./middleware/index.js";

// Extension system
export { ExtensionAPI, ExtensionLoader } from "./extension/index.js";
export type {
	KapyExtensionAPI,
	ExtensionMeta,
	ExtensionRegister,
	ScreenDefinition,
	ScreenContext,
} from "./extension/index.js";

// Built-in commands
export {
	initCommand,
	installCommand,
	listCommand,
	updateCommand,
	removeCommand,
	upgradeCommand,
	configCommand,
	devCommand,
} from "./builtins/index.js";

// Re-export kapy-components (will resolve once package is built)
// export * from "kapy-components";