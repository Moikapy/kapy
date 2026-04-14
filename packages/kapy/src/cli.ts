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

	// Load extensions from project config
	if (effectiveProjectConfig.extensions?.length) {
		await extensionLoader.loadFromConfig(effectiveProjectConfig);
	}

	// Load extensions from global config
	// mergedConfig._extensions is populated by loadConfig from ~/.kapy/config.json
	const globalExtensions = (mergedConfig as Record<string, unknown>)._extensions as string[] | undefined;
	if (globalExtensions?.length) {
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

	// Register built-in commands (with universal flags and agentHints)
	registry.register({
		name: "init",
		options: withUniversalFlags({
			description: "Scaffold a new kapy-powered CLI project",
			args: [{ name: "name", required: true }],
			flags: { template: { type: "boolean", alias: "t", description: "Include example commands and extension" } },
		}),
		handler: initCommand,
		agentHints: {
			purpose: "Scaffold a new kapy-powered CLI project",
			when: "Starting a new kapy project",
			output: "New project directory",
			sideEffects: "Creates directory and files",
		},
	});
	registry.register({
		name: "install",
		options: withUniversalFlags({
			description: "Install an extension (npm:, git:, or local path)",
			args: [{ name: "source", required: true }],
			flags: { trust: { type: "boolean", description: "Skip trust prompt" } },
		}),
		handler: installCommand,
		agentHints: {
			purpose: "Install a kapy extension from npm, git, or local path",
			when: "Adding new functionality to the CLI",
			output: "Extension installed and registered",
			sideEffects: "Modifies ~/.kapy/extensions.json and config.json",
			requires: ["Valid source string"],
		},
	});
	registry.register({
		name: "list",
		options: withUniversalFlags({ description: "Show installed extensions" }),
		handler: listCommand,
		agentHints: {
			purpose: "Show all installed extensions",
			when: "Checking what extensions are available",
			output: "List of extension names, versions, sources",
		},
	});
	registry.register({
		name: "update",
		options: withUniversalFlags({
			description: "Update all or a specific extension",
			args: [{ name: "name" }],
		}),
		handler: updateCommand,
		agentHints: {
			purpose: "Update all or a specific extension to latest version",
			when: "Keeping extensions up to date",
			output: "Updated extension versions",
			sideEffects: "Modifies installed extension files",
		},
	});
	registry.register({
		name: "remove",
		options: withUniversalFlags({
			description: "Uninstall an extension",
			args: [{ name: "name", required: true }],
		}),
		handler: removeCommand,
		agentHints: {
			purpose: "Uninstall a kapy extension",
			when: "Removing unwanted extensions",
			output: "Extension removed from manifest",
			sideEffects: "Deletes extension files and updates config",
			requires: ["Extension name"],
		},
	});
	registry.register({
		name: "search",
		options: withUniversalFlags({
			description: "Search for extensions (coming soon)",
			args: [{ name: "query", description: "Search query" }],
		}),
		handler: searchCommand,
		agentHints: {
			purpose: "Search npm for kapy extensions (coming soon)",
			when: "Looking for new extensions to install",
			output: "Search results with extension names",
		},
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
		agentHints: {
			purpose: "Upgrade kapy itself to the latest version",
			when: "Updating the kapy runtime",
			output: "Updated kapy version",
			sideEffects: "Modifies global kapy installation",
		},
	});
	registry.register({
		name: "config",
		options: withUniversalFlags({
			description: "View/edit configuration",
			args: [{ name: "key" }, { name: "value" }],
			flags: { global: { type: "boolean", alias: "g", description: "Edit global config" } },
		}),
		handler: configCommand,
		agentHints: {
			purpose: "View or edit kapy configuration",
			when: "Reading or modifying config values",
			output: "Config key-value pairs",
		},
	});
	registry.register({
		name: "dev",
		options: withUniversalFlags({
			description: "Run CLI in dev mode with hot reload",
			flags: { debug: { type: "boolean", alias: "d", description: "Verbose logging" } },
		}),
		handler: devCommand,
		agentHints: {
			purpose: "Run CLI in dev mode with hot reload on file changes",
			when: "Developing extensions locally",
			output: "Running CLI process with auto-restart",
			sideEffects: "Watches files and restarts process",
		},
	});
	registry.register({
		name: "commands",
		options: withUniversalFlags({
			description: "List all registered commands",
		}),
		handler: createCommandsCommand(registry),
		agentHints: {
			purpose: "List all registered commands with metadata",
			when: "Discovering available commands",
			output: "Structured list of commands with args, flags, descriptions",
		},
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
		agentHints: {
			purpose: "Dump full kapy state including extensions, config, hooks, and middleware",
			when: "Debugging or auditing the CLI state",
			output: "Full state dump as JSON or styled text",
		},
	});
	registry.register({
		name: "tui",
		options: withUniversalFlags({
			description: "Launch interactive terminal UI",
			flags: { screen: { type: "string", alias: "s", description: "Open directly to a specific screen" } },
		}),
		handler: async (ctx) => {
			await launchTUI({ screens: extensionLoader.getScreens(), initialScreen: ctx.args.screen as string }, ctx);
		},
		agentHints: {
			purpose: "Launch interactive terminal UI",
			when: "Using kapy interactively",
			output: "Interactive TUI session",
			requires: ["Interactive terminal (TTY)"],
		},
	});
	registry.register({
		name: "help",
		options: withUniversalFlags({
			description: "Show help for a command",
			args: [{ name: "command", description: "Command to get help for" }],
		}),
		handler: createHelpCommand(registry),
		agentHints: {
			purpose: "Show detailed help for a specific command",
			when: "Learning about a command or its flags",
			output: "Command description, args, flags, and agent hints",
		},
	});

	// Load user commands (from project config middleware)
	if (effectiveProjectConfig.middleware) {
		for (const mw of effectiveProjectConfig.middleware) {
			userMiddlewares.push(mw);
		}
	}

	// Register user commands from builder
	// (already registered via .command() calls)

	// Resolve command from argv
	const resolved = registry.resolve(commandParts);
	if (!resolved || commandParts.length === 0) {
		// ADR-007: No command specified → agent-first default mode
		// In JSON mode, still output the error structure
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

		// No-input mode: can't launch TUI, show help instead
		if (noInput) {
			console.log("");
			console.log("  🐹 kapy — the agent-first CLI framework");
			console.log("");
			console.log("Usage: kapy <command> [flags]");
			console.log("");
			console.log("Available commands:");
			for (const cmd of registry.visible()) {
				console.log(`  ${cmd.name.padEnd(20)} ${cmd.options.description}`);
			}
			process.exit(2);
		}

		// Agent-first: launch the chat TUI
		if (process.stdout.isTTY) {
			// ADR-007: kapy with no args → interactive agent TUI
			// ADR-007: kapy with unknown text → single-shot agent (non-interactive)
			if (commandParts.length === 0) {
				const { launchChatTUI } = await import("./tui/app.js");
				await launchChatTUI();
				return;
			}
			// Single-shot: text that isn't a command → agent prompt
			// For now, fall through to help. Full single-shot in Phase 9.
		}

		// Non-TTY fallback: show help
		console.log("");
		console.log("  🐹 kapy — the agent-first CLI framework");
		console.log("");
		console.log("Usage: kapy <command> [flags]");
		console.log("");
		console.log("Available commands:");
		for (const cmd of registry.visible()) {
			console.log(`  ${cmd.name.padEnd(20)} ${cmd.options.description}`);
		}
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
		.catch((err) => {
			if (err instanceof AbortError) {
				process.exit(err.exitCode);
			}
			handleKapyError(err, process.argv.includes("--json"));
		});
}
