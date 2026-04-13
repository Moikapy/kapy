/**
 * Extension API — the surface extensions use to register commands, hooks,
 * middleware, screens, config, tools, and providers.
 */

import type { CommandDefinition, CommandHandler, CommandOptions } from "../command/parser.js";
import type { CommandRegistry } from "../command/registry.js";
import type { ConfigSchema } from "../config/schema.js";
import type { ExtensionEmitter } from "../hooks/emitter.js";
import type { HookHandler } from "../hooks/types.js";
import type { Middleware } from "../middleware/pipeline.js";
import type { ToolRegistry } from "../tool/registry.js";
import type { KapyToolRegistration, ProviderRegistration, ScreenDefinition } from "./types.js";

export class ExtensionAPI implements KapyExtensionAPI {
	private registry: CommandRegistry;
	private tools: ToolRegistry;
	private hooks: Map<string, HookHandler[]>;
	private middlewares: Middleware[];
	private screens: ScreenDefinition[];
	private configSchemas: Map<string, ConfigSchema>;
	private emitter: ExtensionEmitter;
	private providers: Map<string, ProviderRegistration>;
	private extensionName: string;

	constructor(options: {
		registry: CommandRegistry;
		tools: ToolRegistry;
		hooks: Map<string, HookHandler[]>;
		middlewares: Middleware[];
		screens: ScreenDefinition[];
		configSchemas: Map<string, ConfigSchema>;
		emitter: ExtensionEmitter;
		providers: Map<string, ProviderRegistration>;
		extensionName: string;
	}) {
		this.registry = options.registry;
		this.tools = options.tools;
		this.hooks = options.hooks;
		this.middlewares = options.middlewares;
		this.screens = options.screens;
		this.configSchemas = options.configSchemas;
		this.emitter = options.emitter;
		this.providers = options.providers;
		this.extensionName = options.extensionName;
	}

	addCommand(definition: CommandDefinition): void;
	addCommand(name: string, options: CommandOptions, handler: CommandHandler): void;
	addCommand(nameOrDef: string | CommandDefinition, options?: CommandOptions, handler?: CommandHandler): void {
		if (typeof nameOrDef === "string") {
			if (!options || !handler) throw new Error("Command name requires options and handler");
			this.registry.register({ name: nameOrDef, options, handler });
		} else {
			this.registry.register(nameOrDef);
		}
	}

	addHook(event: string, handler: HookHandler): void {
		if (!this.hooks.has(event)) {
			this.hooks.set(event, []);
		}
		this.hooks.get(event)?.push(handler);
	}

	addMiddleware(middleware: Middleware): void {
		this.middlewares.push(middleware);
	}

	declareConfig(schema: ConfigSchema): void {
		this.configSchemas.set(this.extensionName, schema);
	}

	addScreen(screen: ScreenDefinition): void {
		this.screens.push(screen);
	}

	emit(event: string, data?: unknown): void {
		this.emitter.emit(event, data);
	}

	on(event: string, handler: (data?: unknown) => Promise<void> | void): void {
		this.emitter.on(event, handler);
	}

	/** Register a tool callable by the LLM (pi pattern: pi.registerTool) */
	registerTool(definition: KapyToolRegistration): void {
		this.tools.register(definition);
	}

	/** Register an LLM provider (pi pattern: pi.registerProvider) */
	registerProvider(id: string, config: ProviderRegistration): void {
		this.providers.set(id, config);
	}

	/** Unregister an LLM provider (pi pattern: pi.unregisterProvider) */
	unregisterProvider(id: string): void {
		this.providers.delete(id);
	}
}
