/**
 * Extension loader — discovers, loads, and initializes extensions.
 *
 * Extensions are npm packages (or git repos / local paths) with the
 * `kapy-extension` keyword. They export a `register()` function and
 * a `meta` object.
 */

import { stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { CommandRegistry } from "../command/registry.js";
import type { ConfigSchema } from "../config/schema.js";
import { ExtensionEmitter } from "../hooks/emitter.js";
import type { HookHandler } from "../hooks/types.js";
import type { Middleware } from "../middleware/pipeline.js";
import { ExtensionAPI } from "./api.js";
import type { ExtensionMeta, ExtensionRegister, ScreenDefinition } from "./types.js";

interface LoadedExtension {
	meta: ExtensionMeta;
	dispose?: () => void;
	source: string;
}

/** Resolve an extension source string to a loadable module path */
async function resolveExtensionSource(source: string, extensionsDir: string): Promise<string> {
	// npm: package — resolve from node_modules
	if (source.startsWith("npm:")) {
		const pkgName = source.slice(4);
		// Try local node_modules first, then global
		try {
			const resolved = require.resolve(pkgName, { paths: [process.cwd()] });
			return resolved;
		} catch {
			throw new Error(`Cannot resolve npm extension: ${pkgName}. Install it first with 'kapy install ${source}'`);
		}
	}

	// git: repository — resolve from installed location in extensions dir
	if (source.startsWith("git:")) {
		const gitUrl = source.slice(4);
		// Derive local directory from git URL
		const repoName = gitUrl.split("/").pop()?.replace(".git", "") ?? gitUrl;
		const localPath = join(extensionsDir, repoName);
		try {
			await stat(localPath);
			return localPath;
		} catch {
			throw new Error(`Git extension not installed: ${source}. Install it first with 'kapy install ${source}'`);
		}
	}

	// Local path — resolve relative to project dir
	if (source.startsWith("./") || source.startsWith("../") || source.startsWith("/")) {
		const absPath = resolve(process.cwd(), source);
		try {
			await stat(absPath);
			return absPath;
		} catch {
			throw new Error(`Local extension not found: ${source} (resolved to ${absPath})`);
		}
	}

	// Bare package name — try to resolve from node_modules
	try {
		return require.resolve(source, { paths: [process.cwd()] });
	} catch {
		throw new Error(`Cannot resolve extension: ${source}`);
	}
}

/** Topological sort of extensions based on meta.dependencies */
function resolveDependencyOrder(
	extensions: { name: string; source: string; meta?: ExtensionMeta }[],
): { name: string; source: string }[] {
	const sorted: { name: string; source: string }[] = [];
	const visited = new Set<string>();
	const visiting = new Set<string>();

	function visit(name: string, source: string, deps?: string[]) {
		if (visited.has(name)) return;
		if (visiting.has(name)) {
			console.warn(`[kapy] Circular dependency detected involving: ${name}`);
			return;
		}

		visiting.add(name);
		if (deps) {
			for (const dep of deps) {
				const depExt = extensions.find((e) => e.name === dep || e.source === dep);
				if (depExt) {
					visit(depExt.name, depExt.source, depExt.meta?.dependencies);
				}
			}
		}
		visiting.delete(name);
		visited.add(name);
		sorted.push({ name, source });
	}

	for (const ext of extensions) {
		visit(ext.name, ext.source, ext.meta?.dependencies);
	}

	return sorted;
}

export class ExtensionLoader {
	private registry: CommandRegistry;
	private hooks: Map<string, HookHandler[]>;
	private middlewares: Middleware[];
	private screens: ScreenDefinition[];
	private configSchemas: Map<string, ConfigSchema>;
	private emitter: ExtensionEmitter;
	private loaded: LoadedExtension[] = [];
	private extensionsDir: string;

	constructor(registry: CommandRegistry, extensionsDir?: string) {
		this.registry = registry;
		this.hooks = new Map();
		this.middlewares = [];
		this.screens = [];
		this.configSchemas = new Map();
		this.emitter = new ExtensionEmitter();
		this.extensionsDir = extensionsDir ?? join(process.cwd(), ".kapy", "extensions");
	}

	/** Load an extension by source string */
	async load(name: string, source: string): Promise<LoadedExtension | null> {
		try {
			const resolvedPath = await resolveExtensionSource(source, this.extensionsDir);
			const mod = await import(resolvedPath);

			const register: ExtensionRegister = mod.register ?? mod.default?.register;
			const meta: ExtensionMeta = mod.meta ??
				mod.default?.meta ?? {
					name,
					version: "0.0.0",
				};

			if (!register) {
				console.warn(`[kapy] Extension "${name}" has no register() export. Skipping.`);
				return null;
			}

			// Warn about declared permissions (documentation-only for MVP)
			if (meta.permissions?.length) {
				console.warn(
					`[kapy] Extension "${meta.name}" declares permissions: ${meta.permissions.join(", ")} (documentation only — not enforced at runtime)`,
				);
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
			const loaded: LoadedExtension = { meta, dispose: dispose ?? undefined, source };
			this.loaded.push(loaded);

			return loaded;
		} catch (err) {
			console.warn(`[kapy] Extension "${name}" failed to load: ${err}`);
			return null;
		}
	}

	/** Load all extensions from a list, resolving dependency order */
	async loadAll(extensions: string[]): Promise<void> {
		// First pass: load each to get metadata
		const extMeta: { name: string; source: string; meta?: ExtensionMeta }[] = [];

		for (const source of extensions) {
			const name = deriveName(source);
			try {
				const resolvedPath = await resolveExtensionSource(source, this.extensionsDir);
				const mod = await import(resolvedPath);
				const meta: ExtensionMeta = mod.meta ?? mod.default?.meta ?? { name, version: "0.0.0" };
				extMeta.push({ name: meta.name ?? name, source, meta });
			} catch {
				extMeta.push({ name, source });
			}
		}

		// Resolve dependency order via topological sort
		const ordered = resolveDependencyOrder(extMeta);

		// Second pass: register in dependency order
		for (const { name, source } of ordered) {
			await this.load(name, source);
		}
	}

	/** Load extensions from project config */
	async loadFromConfig(config: { extensions?: string[] }): Promise<void> {
		if (!config.extensions?.length) return;
		await this.loadAll(config.extensions);
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

	/** Get all loaded extensions */
	getLoaded(): LoadedExtension[] {
		return [...this.loaded];
	}
}

/** Derive a short name from an extension source string */
function deriveName(source: string): string {
	if (source.startsWith("npm:")) return source.slice(4).split("@")[0];
	if (source.startsWith("git:")) {
		const parts = source.slice(4).split("/");
		return parts[parts.length - 1]?.replace(".git", "") ?? source;
	}
	if (source.startsWith("./") || source.startsWith("../")) {
		return source.split("/").pop()?.replace(".ts", "").replace(".js", "") ?? source;
	}
	return source;
}

export type { LoadedExtension };
export { resolveExtensionSource };
