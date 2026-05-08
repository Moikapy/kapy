/**
 * Extension loader — discovers, loads, and initializes extensions.
 *
 * Extensions are npm packages (or git repos / local paths) with the
 * `kapy-extension` keyword. They export a `register()` function and
 * a `meta` object.
 */

import { readdirSync } from "node:fs";
import { stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CommandContext } from "../command/context.js";
import type { CommandRegistry } from "../command/registry.js";
import type { ConfigSchema } from "../config/schema.js";
import { formatErrors, validateExtensionMeta } from "../config/validator.js";
import { ExtensionEmitter } from "../hooks/emitter.js";
import type { HookHandler } from "../hooks/types.js";
import type { Middleware } from "../middleware/pipeline.js";
import { ExtensionAPI } from "./api.js";
import type { ExtensionMeta, ExtensionRegister } from "./types.js";

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
		const resolved = tryResolvePackage(pkgName);
		if (resolved) return resolved;
		throw new Error(`Cannot resolve npm extension: ${pkgName}. Install it first with 'kapy install ${source}'`);
	}

	// git: repository — resolve from installed location in extensions dir
	if (source.startsWith("git:")) {
		const gitUrl = source.slice(4);
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

	// Bare package name (e.g. @moikapy/kapy-script) — resolve from kapy's node_modules, then cwd
	const resolved = tryResolvePackage(source);
	if (resolved) return resolved;
	throw new Error(`Cannot resolve extension: ${source}. Install it first with 'kapy install ${source}'`);
}

/** Try to resolve a package from kapy's node_modules, then cwd, then global */
function tryResolvePackage(pkgName: string): string | null {
	// Resolution order:
	// 1. Kapy's own installation directory (where kapy CLI is installed)
	// 2. Current working directory
	// 3. Global node_modules
	const kapyDir = findKapyRoot();
	const searchPaths = [kapyDir, process.cwd(), "/usr/local/lib/node_modules", "/usr/lib/node_modules"].filter(
		Boolean,
	) as string[];

	for (const dir of searchPaths) {
		try {
			return _require.resolve(pkgName, { paths: [dir] });
		} catch {
			// try next path
		}
	}
	return null;
}

// createRequire enables require.resolve() in ESM contexts
const _require = typeof require === "function" ? require : createRequire(import.meta.url);

/** Find kapy's installation root (the directory containing node_modules with @moikapy/kapy) */
function findKapyRoot(): string | null {
	// Use import.meta.dirname (Node 21+) with fallback to fileURLToPath
	const thisDir =
		typeof import.meta.dirname === "string" ? import.meta.dirname : dirname(fileURLToPath(import.meta.url));

	// Walk up from this file's location to find a node_modules directory
	// that actually contains packages (not just empty dirs from bun workspaces)
	let dir = thisDir;
	for (let i = 0; i < 10; i++) {
		const nodeModules = join(dir, "node_modules");
		try {
			const entries = readdirSync(nodeModules);
			// Skip empty node_modules (bun workspace stubs)
			if (entries.length > 0) return dir;
		} catch {
			// Not found, walk up
		}
		const parent = resolve(dir, "..");
		if (parent === dir) break; // reached root
		dir = parent;
	}
	return null;
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
				} else {
					console.warn(
						`[kapy] Extension "${name}" depends on "${dep}" which is not installed. Load order may be incorrect.`,
					);
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
	private configSchemas: Map<string, ConfigSchema>;
	private emitter: ExtensionEmitter;
	private loaded: LoadedExtension[] = [];
	private extensionsDir: string;

	constructor(registry: CommandRegistry, extensionsDir?: string) {
		this.registry = registry;
		this.hooks = new Map();
		this.middlewares = [];
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

			// Validate extension metadata
			const metaErrors = validateExtensionMeta(meta as unknown as Record<string, unknown>);
			if (metaErrors.length > 0) {
				console.warn(`[kapy] Extension "${name}" has invalid metadata:\n${formatErrors(metaErrors)}`);
			}

			// Validate extension name (no colons — colons are for command subcommands)
			if (meta.name.includes(":")) {
				console.warn(
					`[kapy] Extension name "${meta.name}" contains a colon. Colons are reserved for command subcommands (e.g. deploy:aws).`,
				);
			}
			if (!meta.name || meta.name.trim() !== meta.name) {
				console.warn(`[kapy] Extension name "${meta.name}" is empty or has leading/trailing whitespace.`);
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
				configSchemas: this.configSchemas,
				emitter: this.emitter,
				extensionName: meta.name,
			});

			const dispose = await register(api);
			const loaded: LoadedExtension = { meta, dispose: dispose ?? undefined, source };
			this.loaded.push(loaded);

			// Fire on:extension:loaded hook
			const extLoadedHooks = this.hooks.get("on:extension:loaded") ?? [];
			if (extLoadedHooks.length > 0) {
				const extCtx = new CommandContext({ command: "on:extension:loaded" });
				(extCtx.args as Record<string, unknown>).extension = meta.name;
				(extCtx.args as Record<string, unknown>).version = meta.version;
				(extCtx.args as Record<string, unknown>).source = source;
				for (const hook of extLoadedHooks) {
					try {
						await hook(extCtx);
					} catch (e) {
						console.warn("[kapy] on:extension:loaded hook error:", e);
					}
				}
			}

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
