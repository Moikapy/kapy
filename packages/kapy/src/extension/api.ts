/**
 * Extension API — the surface extensions use to register commands, hooks,
 * middleware, config, and events.
 */

import type { AgentHints, CommandDefinition, CommandHandler, CommandOptions } from "../command/parser.js";
import { validateHookEvent } from "../command/parser.js";
import type { CommandRegistry } from "../command/registry.js";
import type { ConfigSchema } from "../config/schema.js";
import type { ExtensionEmitter } from "../hooks/emitter.js";
import type { HookHandler } from "../hooks/types.js";
import type { Middleware } from "../middleware/pipeline.js";
import type { KapyExtensionAPI } from "./types.js";

export class ExtensionAPI implements KapyExtensionAPI {
	private registry: CommandRegistry;
	private hooks: Map<string, HookHandler[]>;
	private middlewares: Middleware[];
	private configSchemas: Map<string, ConfigSchema>;
	private emitter: ExtensionEmitter;
	private extensionName: string;

	constructor(options: {
		registry: CommandRegistry;
		hooks: Map<string, HookHandler[]>;
		middlewares: Middleware[];
		configSchemas: Map<string, ConfigSchema>;
		emitter: ExtensionEmitter;
		extensionName: string;
	}) {
		this.registry = options.registry;
		this.hooks = options.hooks;
		this.middlewares = options.middlewares;
		this.configSchemas = options.configSchemas;
		this.emitter = options.emitter;
		this.extensionName = options.extensionName;
	}

	addCommand(definition: CommandDefinition): void;
	addCommand(name: string, options: CommandOptions & { agentHints?: AgentHints }, handler: CommandHandler): void;
	addCommand(
		nameOrDef: string | CommandDefinition,
		options?: CommandOptions & { agentHints?: AgentHints },
		handler?: CommandHandler,
	): void {
		if (typeof nameOrDef === "string") {
			if (!options || !handler) throw new Error("Command name requires options and handler");
			const { agentHints, ...cmdOptions } = options;
			this.registry.register({ name: nameOrDef, options: cmdOptions, handler, agentHints });
		} else {
			this.registry.register(nameOrDef);
		}
	}

	addHook(event: string, handler: HookHandler): void {
		const eventError = validateHookEvent(event);
		if (eventError) {
			console.warn(`[kapy] ${eventError}. Registering anyway.`);
		}
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

	emit(event: string, data?: unknown): void {
		this.emitter.emit(event, data);
	}

	on(event: string, handler: (data?: unknown) => Promise<void> | void): void {
		this.emitter.on(event, handler);
	}
}
