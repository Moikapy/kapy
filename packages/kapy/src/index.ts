/**
 * kapy — Extensible CLI framework.
 *
 * Public API: kapy() builder, defineConfig, types, and re-exports.
 */

// Built-in commands
export {
	configCommand,
	devCommand,
	initCommand,
	installCommand,
	listCommand,
	removeCommand,
	updateCommand,
	upgradeCommand,
} from "./builtins/index.js";
export type { KapyBuilder } from "./cli.js";
export { defineConfig, kapy } from "./cli.js";
export { AbortError, CommandContext } from "./command/context.js";
// Command system
export { CommandRegistry, parseArgs } from "./command/index.js";
export type {
	AgentHints,
	ArgDefinition,
	CommandDefinition,
	CommandHandler,
	CommandOptions,
	FlagDefinition,
} from "./command/parser.js";
export type { ConfigField, ConfigSchema, GlobalConfig, MergedConfig, ProjectConfig } from "./config/index.js";
// Config system
export { DEFAULT_ENV_PREFIX, deepMergeConfigs, loadConfig, parseEnvConfig } from "./config/index.js";
export type {
	ExtensionMeta,
	ExtensionRegister,
	KapyExtensionAPI,
	ScreenContext,
	ScreenDefinition,
} from "./extension/index.js";
// Extension system
export { ExtensionAPI, ExtensionLoader } from "./extension/index.js";
export type { HookEntry, HookHandler } from "./hooks/index.js";
// Hooks
export { ExtensionEmitter } from "./hooks/index.js";
export type { Middleware } from "./middleware/index.js";
// Middleware
export { composeMiddleware, EXIT_CODES, errorHandler, logging, timing } from "./middleware/index.js";

// Re-export kapy-components (will resolve once package is built)
// export * from "kapy-components";
