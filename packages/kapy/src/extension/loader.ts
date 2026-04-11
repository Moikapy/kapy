/**
 * Extension loader — discovers, loads, and initializes extensions.
 *
 * Extensions are npm packages (or git repos / local paths) with the
 * `kapy-extension` keyword. They export a `register()` function and
 * a `meta` object.
 */
import type { ExtensionRegister, ExtensionMeta, KapyExtensionAPI } from "./types.js";
import type { CommandRegistry } from "../command/registry.js";
import type { Middleware } from "../middleware/pipeline.js";
import type { HookHandler } from "../hooks/types.js";
import type { ScreenDefinition } from "./types.js";
import type { ConfigSchema } from "../config/schema.js";
import { ExtensionAPI } from "./api.js";
import { ExtensionEmitter } from "../hooks/emitter.js";

interface LoadedExtension {
	meta: ExtensionMeta;
	dispose?: () => void;
}

export class ExtensionLoader {
	private registry: CommandRegistry;
	private hooks: Map<string, HookHandler[]>;
	private middlewares: Middleware[];
	private screens: ScreenDefinition[];
	private configSchemas: Map<string, ConfigSchema>;
	private emitter: ExtensionEmitter;
	private loaded: LoadedExtension[] = [];

	constructor(registry: CommandRegistry) {
		this.registry = registry;
		this.hooks = new Map();
		this.middlewares = [];
		this.screens = [];
		this.configSchemas = new Map();
		this.emitter = new ExtensionEmitter();
	}

	/** Load an extension by module path or name */
	async load(name: string, source: string): Promise<LoadedExtension | null> {
		try {
			// TODO: resolve extension source (npm, git, local)
			const mod = await import(source);

			const register: ExtensionRegister = mod.register ?? mod.default?.register;
			const meta: ExtensionMeta = mod.meta ?? mod.default?.meta ?? {
				name,
				version: "0.0.0",
			};

			if (!register) {
				console.warn(`[kapy] Extension "${name}" has no register() export. Skipping.`);
				return null;
			}

			const api = new ExtensionAPI({
				registry: this.registry,
				hooks: this.hooks,
				middlewares: this.middlewares,
				screens: this.screens,
				configSchemas: this.configSchemas,
				emitter: this.emitter,
				extensionName: meta.name,
			});

			const dispose = await register(api);
			const loaded: LoadedExtension = { meta, dispose: dispose ?? undefined };
			this.loaded.push(loaded);

			return loaded;
		} catch (err) {
			console.warn(`[kapy] Extension "${name}" failed to load: ${err}`);
			return null;
		}
	}

	/** Load all extensions from config in dependency order */
	async loadAll(extensions: string[]): Promise<void> {
		// TODO: resolve dependency order from meta.dependencies
		for (const ext of extensions) {
			await this.load(ext, ext);
		}
	}

	/** Dispose all loaded extensions */
	async disposeAll(): Promise<void> {
		for (const ext of this.loaded) {
			try {
				ext.dispose?.();
			} catch (err) {
				console.warn(`[kapy] Error disposing extension "${ext.meta.name}": ${err}`);
			}
		}
		this.loaded = [];
	}

	/** Get all registered hooks */
	getHooks(): Map<string, HookHandler[]> {
		return this.hooks;
	}

	/** Get all registered middleware */
	getMiddlewares(): Middleware[] {
		return this.middlewares;
	}

	/** Get all registered screens */
	getScreens(): ScreenDefinition[] {
		return this.screens;
	}

	/** Get all config schemas */
	getConfigSchemas(): Map<string, ConfigSchema> {
		return this.configSchemas;
	}
}

export type { LoadedExtension };