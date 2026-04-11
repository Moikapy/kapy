#!/usr/bin/env bun
import {
	configCommand,
	createCommandsCommand,
	createInspectCommand,
	devCommand,
	initCommand,
	installCommand,
	listCommand,
	removeCommand,
	updateCommand,
	upgradeCommand,
} from "./builtins/index.js";
import { CommandContext } from "./command/context.js";
/**
 * kapy — Extensible CLI framework.
 *
 * Usage:
 *   kapy                    Show help
 *   kapy <command>          Run a command
 *   kapy tui                Launch interactive TUI
 *   kapy init <name>        Scaffold a new project
 *   kapy install <pkg>      Install an extension
 *   kapy list               Show installed extensions
 *   kapy upgrade            Upgrade kapy itself
 *   kapy commands [--json]  List all commands
 *   kapy inspect [--json]   Dump full state
 */
import { CommandRegistry, parseArgs } from "./command/index.js";
import type { CommandHandler, CommandOptions } from "./command/parser.js";
import { loadConfig } from "./config/index.js";
import type { ProjectConfig } from "./config/schema.js";
import { ExtensionLoader } from "./extension/index.js";
import { errorHandler, KapyError } from "./middleware/error-handler.js";
import type { Middleware } from "./middleware/pipeline.js";
import { composeMiddleware } from "./middleware/pipeline.js";
import { launchTUI } from "./tui/index.js";

// ─── Builder API ───────────────────────────────────────────────

export interface KapyBuilder {
	/** Register a command */
	command(name: string, options: CommandOptions, handler: CommandHandler): KapyBuilder;
	/** Add middleware */
	use(middleware: Middleware): KapyBuilder;
	/** Run the CLI */
	run(): Promise<void>;
}

/** Define project config (for kapy.config.ts) */
export function defineConfig(config: ProjectConfig): ProjectConfig {
	return config;
}

/** Create a kapy CLI instance */
export function kapy(): KapyBuilder {
	const registry = new CommandRegistry();
	const userMiddlewares: Middleware[] = [];
	const projectConfig: ProjectConfig = {};

	const builder: KapyBuilder = {
		command(name: string, options: CommandOptions, handler: CommandHandler): KapyBuilder {
			registry.register({ name, options, handler });
			return builder;
		},

		use(middleware: Middleware): KapyBuilder {
			userMiddlewares.push(middleware);
			return builder;
		},

		async run(): Promise<void> {
			await runCLI(registry, userMiddlewares, projectConfig);
		},
	};

	return builder;
}

// ─── CLI Runner ────────────────────────────────────────────────

async function runCLI(
	registry: CommandRegistry,
	userMiddlewares: Middleware[],
	projectConfig: ProjectConfig,
): Promise<void> {
	const argv = process.argv.slice(2);

	// Parse global flags
	const { args: globalArgs, rest: commandParts } = parseArgs(argv);
	const jsonMode = globalArgs.json === true;
	const noInput = globalArgs["no-input"] === true;

	// Load config
	const { config: mergedConfig } = await loadConfig({
		projectDir: process.cwd(),
		envPrefix: projectConfig.envPrefix,
		cliFlags: globalArgs as Record<string, unknown>,
	});

	// Set up extension system
	const extensionLoader = new ExtensionLoader(registry);

	// Load extensions from project config
	if (projectConfig.extensions?.length) {
		await extensionLoader.loadFromConfig(projectConfig);
	}

	// Load extensions from global config (mergedConfig has extension settings)
	const globalExtensions = (mergedConfig as Record<string, unknown>)._extensions as string[] | undefined;
	if (globalExtensions?.length) {
		await extensionLoader.loadFromConfig({ extensions: globalExtensions });
	}

	// Add extension middleware to pipeline
	for (const mw of extensionLoader.getMiddlewares()) {
		userMiddlewares.push(mw);
	}

	// Register built-in commands
	registry.register({
		name: "init",
		options: {
			description: "Scaffold a new kapy-powered CLI project",
			args: [{ name: "name", required: true }],
			flags: { template: { type: "boolean", alias: "t", description: "Include example commands and extension" } },
		},
		handler: initCommand,
	});
	registry.register({
		name: "install",
		options: {
			description: "Install an extension (npm:, git:, or local path)",
			args: [{ name: "source", required: true }],
			flags: { trust: { type: "boolean", description: "Skip trust prompt" } },
		},
		handler: installCommand,
	});
	registry.register({ name: "list", options: { description: "Show installed extensions" }, handler: listCommand });
	registry.register({
		name: "update",
		options: { description: "Update all or a specific extension", args: [{ name: "name" }] },
		handler: updateCommand,
	});
	registry.register({
		name: "remove",
		options: { description: "Uninstall an extension", args: [{ name: "name", required: true }] },
		handler: removeCommand,
	});
	registry.register({
		name: "upgrade",
		options: { description: "Upgrade kapy itself to the latest version" },
		handler: upgradeCommand,
	});
	registry.register({
		name: "config",
		options: {
			description: "View/edit configuration",
			args: [{ name: "key" }, { name: "value" }],
			flags: { global: { type: "boolean", alias: "g", description: "Edit global config" } },
		},
		handler: configCommand,
	});
	registry.register({
		name: "dev",
		options: {
			description: "Run CLI in dev mode with hot reload",
			flags: { debug: { type: "boolean", alias: "d", description: "Verbose logging" } },
		},
		handler: devCommand,
	});
	registry.register({
		name: "commands",
		options: {
			description: "List all registered commands",
			flags: { json: { type: "boolean", description: "Output as JSON" } },
		},
		handler: createCommandsCommand(registry),
	});
	registry.register({
		name: "inspect",
		options: {
			description: "Dump full state (extensions, config, hooks, middleware)",
			flags: { json: { type: "boolean", description: "Output as JSON" } },
		},
		handler: createInspectCommand(registry, userMiddlewares, extensionLoader.getHooks()),
	});
	registry.register({
		name: "tui",
		options: {
			description: "Launch interactive terminal UI",
			flags: { screen: { type: "string", alias: "s", description: "Open directly to a specific screen" } },
		},
		handler: async (ctx) => {
			await launchTUI({ screens: extensionLoader.getScreens(), initialScreen: ctx.args.screen as string }, ctx);
		},
	});

	// Load user commands (from project config middleware)
	if (projectConfig.middleware) {
		for (const mw of projectConfig.middleware) {
			userMiddlewares.push(mw);
		}
	}

	// Register user commands from builder
	// (already registered via .command() calls)

	// Resolve command from argv
	const resolved = registry.resolve(commandParts);
	if (!resolved || commandParts.length === 0) {
		// No matching command — show help
		if (jsonMode) {
			console.log(
				JSON.stringify({
					status: "error",
					message: "No command specified",
					commands: registry.visible().map((c) => c.name),
				}),
			);
		} else {
			console.log("");
			console.log("  🐹 kapy — the pi.dev for CLI");
			console.log("");
			console.log("Usage: kapy <command> [flags]");
			console.log("");
			console.log("Available commands:");
			for (const cmd of registry.visible()) {
				console.log(`  ${cmd.name.padEnd(20)} ${cmd.options.description}`);
			}
			console.log("");
			console.log("Use 'kapy <command> --help' for more information about a command.");
		}
		process.exit(jsonMode ? 0 : 2);
	}

	// Parse command-specific flags
	const { args: cmdArgs, rest: cmdPositional } = parseArgs(commandParts.slice(1), resolved.command.options.flags);

	// Merge global args with command args, positional args in rest
	const mergedArgs = { ...globalArgs, ...cmdArgs, rest: cmdPositional };

	// Build command context
	const ctx = new CommandContext({
		args: mergedArgs,
		config: mergedConfig,
		command: resolved.command.name,
		json: jsonMode,
		noInput: noInput,
	});

	// Compose middleware chain (error handler first, then user + extension middleware)
	const allMiddlewares = [errorHandler, ...userMiddlewares];
	const pipeline = composeMiddleware(allMiddlewares);

	// Execute middleware → hooks → command
	await pipeline(ctx, async () => {
		// Execute before:command hooks
		const beforeHooks = extensionLoader.getHooks().get("before:command") ?? [];
		for (const hook of beforeHooks) {
			await hook(ctx);
			if (ctx.aborted) return;
		}

		// Execute before:<name> hooks
		const nameHooks = extensionLoader.getHooks().get(`before:${resolved.command.name}`) ?? [];
		for (const hook of nameHooks) {
			await hook(ctx);
			if (ctx.aborted) return;
		}

		// Execute command handler
		await resolved.command.handler(ctx);

		// Execute after:<name> hooks
		const afterNameHooks = extensionLoader.getHooks().get(`after:${resolved.command.name}`) ?? [];
		for (const hook of afterNameHooks) {
			await hook(ctx);
		}

		// Execute after:command hooks
		const afterHooks = extensionLoader.getHooks().get("after:command") ?? [];
		for (const hook of afterHooks) {
			await hook(ctx);
		}
	});

	ctx._tick();

	// JSON output for successful commands
	if (jsonMode && !ctx.aborted) {
		console.log(JSON.stringify({ status: "success", command: ctx.command, duration: ctx.duration }));
	}
}

/** Handle KapyError at the top level — exit with appropriate code */
function handleKapyError(err: unknown, jsonMode: boolean): never {
	if (err instanceof KapyError) {
		if (jsonMode && err.jsonOutput) {
			console.log(JSON.stringify(err.jsonOutput));
			process.exit(err.exitCode);
		}
		console.error(err.message);
		process.exit(err.exitCode);
	}

	// Unexpected errors
	console.error(err instanceof Error ? err.message : String(err));
	process.exit(1);
}

// Run CLI if this is the main entry point
if (import.meta.main) {
	kapy()
		.run()
		.catch((err) => handleKapyError(err, process.argv.includes("--json")));
}
