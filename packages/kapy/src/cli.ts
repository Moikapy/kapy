#!/usr/bin/env bun
import {
	configCommand,
	createCommandsCommand,
	createHelpCommand,
	createInspectCommand,
	devCommand,
	initCommand,
	installCommand,
	listCommand,
	removeCommand,
	searchCommand,
	updateCommand,
	upgradeCommand,
} from "./builtins/index.js";
import { AbortError, CommandContext } from "./command/context.js";
/**
 * kapy — Extensible CLI framework.
 *
 * Usage:
 *   kapy                    Show help
 *   kapy <command>          Run a command
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

// ─── Universal flags ───────────────────────────────────────────

/** Auto-inject --json and --no-input flags into command options per spec §10 */
function withUniversalFlags(options: CommandOptions): CommandOptions {
	return {
		...options,
		flags: {
			...options.flags,
			json: { type: "boolean" as const, description: "Output structured JSON" },
			"no-input": { type: "boolean" as const, description: "Skip interactive prompts, use defaults or fail" },
		},
	};
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
	const { config: mergedConfig, projectConfig: loadedProjectConfig } = await loadConfig({
		projectDir: process.cwd(),
		envPrefix: projectConfig.envPrefix,
		cliFlags: globalArgs as Record<string, unknown>,
	});

	// Use loaded project config if builder didn't specify one
	const effectiveProjectConfig = Object.keys(projectConfig).length > 0 ? projectConfig : (loadedProjectConfig ?? {});

	// Set up extension system
	const extensionLoader = new ExtensionLoader(registry);

	// Skip extension loading when KAPY_NO_EXTENSIONS is set (useful for testing / isolation)
	const noExtensions = process.env.KAPY_NO_EXTENSIONS === "1";

	// Load extensions from project config
	if (!noExtensions && effectiveProjectConfig.extensions?.length) {
		await extensionLoader.loadFromConfig(effectiveProjectConfig);
	}

	// Load extensions from global config
	// mergedConfig._extensions is populated by loadConfig from ~/.kapy/config.json
	const globalExtensions = (mergedConfig as Record<string, unknown>)._extensions as string[] | undefined;
	if (!noExtensions && globalExtensions?.length) {
		await extensionLoader.loadFromConfig({ extensions: globalExtensions });
	}

	// Add extension middleware to pipeline
	for (const mw of extensionLoader.getMiddlewares()) {
		userMiddlewares.push(mw);
	}

	// Fire on:load hooks
	const loadHooks = extensionLoader.getHooks().get("on:load") ?? [];
	if (loadHooks.length > 0) {
		const loadCtx = new CommandContext({ command: "on:load", config: mergedConfig });
		for (const hook of loadHooks) {
			try {
				await hook(loadCtx);
			} catch (e) {
				console.warn("[kapy] on:load hook error:", e);
			}
		}
	}

	// Register built-in commands (with universal flags)
	registry.register({
		name: "init",
		options: withUniversalFlags({
			description: "Scaffold a new kapy-powered CLI project",
			args: [{ name: "name", required: true }],
			flags: { template: { type: "boolean", alias: "t", description: "Include example commands and extension" } },
		}),
		handler: initCommand,
	});
	registry.register({
		name: "install",
		options: withUniversalFlags({
			description: "Install an extension (npm:, git:, or local path)",
			args: [{ name: "source", required: true }],
			flags: { trust: { type: "boolean", description: "Skip trust prompt" } },
		}),
		handler: installCommand,
	});
	registry.register({
		name: "list",
		options: withUniversalFlags({ description: "Show installed extensions" }),
		handler: listCommand,
	});
	registry.register({
		name: "update",
		options: withUniversalFlags({
			description: "Update all or a specific extension",
			args: [{ name: "name" }],
		}),
		handler: updateCommand,
	});
	registry.register({
		name: "remove",
		options: withUniversalFlags({
			description: "Uninstall an extension",
			args: [{ name: "name", required: true }],
		}),
		handler: removeCommand,
	});
	registry.register({
		name: "search",
		options: withUniversalFlags({
			description: "Search for extensions (coming soon)",
			args: [{ name: "query", description: "Search query" }],
			hidden: true,
		}),
		handler: searchCommand,
	});
	registry.register({
		name: "upgrade",
		options: withUniversalFlags({
			description: "Upgrade kapy itself to the latest version",
			flags: {
				pm: { type: "string" as const, description: "Package manager to use (bun, npm, yarn, pnpm)" },
			},
		}),
		handler: upgradeCommand,
	});
	registry.register({
		name: "config",
		options: withUniversalFlags({
			description: "View/edit configuration",
			args: [{ name: "key" }, { name: "value" }],
			flags: { global: { type: "boolean", alias: "g", description: "Edit global config" } },
		}),
		handler: configCommand,
	});
	registry.register({
		name: "dev",
		options: withUniversalFlags({
			description: "Run CLI in dev mode with hot reload",
			flags: { debug: { type: "boolean", alias: "d", description: "Verbose logging" } },
		}),
		handler: devCommand,
	});
	registry.register({
		name: "commands",
		options: withUniversalFlags({
			description: "List all registered commands",
		}),
		handler: createCommandsCommand(registry),
	});
	registry.register({
		name: "inspect",
		options: withUniversalFlags({
			description: "Dump full state (extensions, config, hooks, middleware)",
		}),
		handler: createInspectCommand(
			registry,
			userMiddlewares,
			extensionLoader.getHooks(),
			extensionLoader.getConfigSchemas(),
		),
	});
	registry.register({
		name: "help",
		options: withUniversalFlags({
			description: "Show help for a command",
			args: [{ name: "command", description: "Command to get help for" }],
		}),
		handler: createHelpCommand(registry),
	});

	// Load user commands (from project config middleware)
	if (effectiveProjectConfig.middleware) {
		for (const mw of effectiveProjectConfig.middleware) {
			userMiddlewares.push(mw);
		}
	}

	// Resolve command from argv
	const resolved = registry.resolve(commandParts);
	if (!resolved || commandParts.length === 0) {
		if (jsonMode) {
			console.log(
				JSON.stringify({
					status: "error",
					message: "No command specified",
					commands: registry.visible().map((c) => c.name),
				}),
			);
			process.exit(0);
		}

		console.log("");
		console.log("  🐹 kapy — the extensible CLI framework");
		console.log("");
		console.log("Usage: kapy <command> [flags]");
		console.log("");
		console.log("Available commands:");
		for (const cmd of registry.visible()) {
			console.log(`  ${cmd.name.padEnd(20)} ${cmd.options.description}`);
		}
		console.log("");
		console.log("Use 'kapy help <command>' for more information.");
		process.exit(2);
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
	try {
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
	} catch (err) {
		// Fire on:error hooks
		const errorHooks = extensionLoader.getHooks().get("on:error") ?? [];
		if (errorHooks.length > 0) {
			const errCtx = new CommandContext({ command: "on:error", config: mergedConfig });
			(errCtx.args as Record<string, unknown>).error = err;
			for (const hook of errorHooks) {
				try {
					await hook(errCtx);
				} catch (e) {
					console.warn("[kapy] on:error hook error:", e);
				}
			}
		}

		// Run teardown even on error
		await ctx.runTeardowns();

		throw err;
	}

	// ─── Success path only (no error was thrown) ────────────

	ctx._tick();

	// JSON output for successful commands
	if (jsonMode && !ctx.aborted) {
		console.log(JSON.stringify({ status: "success", command: ctx.command, duration: ctx.duration }));
	}

	// Run teardown callbacks (cleanup processes, temp files, etc.)
	await ctx.runTeardowns();

	// Propagate exit code if non-zero
	if (ctx.exitCode !== 0) {
		process.exit(ctx.exitCode);
	}
}

// Run CLI if this is the main entry point
if (import.meta.main) {
	kapy()
		.run()
		.catch((err) => {
			if (err instanceof AbortError) {
				process.exit(err.exitCode);
			}
			// Top-level error handler — format and exit
			const jsonMode = process.argv.includes("--json");
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
		});
}
