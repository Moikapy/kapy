/**
 * Config loader — loads and merges config from all sources.
 *
 * Hierarchy: kapy defaults → project kapy.config.ts → ~/.kapy/config.json → env vars → CLI flags
 */
import { readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { DEFAULT_ENV_PREFIX, getDefaultConfig } from "./defaults.js";
import { deepMergeConfigs } from "./loader-merge.js";
import type { ConfigSource, GlobalConfig, MergedConfig, ProjectConfig } from "./schema.js";
import { formatErrors, validateProjectConfig } from "./validator.js";

/** Load and merge all config sources */
export async function loadConfig(options?: {
	projectDir?: string;
	envPrefix?: string;
	cliFlags?: Record<string, unknown>;
}): Promise<{
	config: MergedConfig;
	sources: Map<ConfigSource, MergedConfig | ProjectConfig>;
	projectConfig: ProjectConfig | null;
}> {
	const envPrefix = options?.envPrefix ?? DEFAULT_ENV_PREFIX;
	const cwd = options?.projectDir ?? process.cwd();
	const sources = new Map<ConfigSource, MergedConfig | ProjectConfig>();

	// 1. Defaults
	let config: MergedConfig = getDefaultConfig();
	sources.set("defaults", { ...config });

	// 2. Project config from kapy.config.ts
	const projectConfig = await loadProjectConfig(cwd);
	if (projectConfig) {
		// Validate project config
		const configErrors = validateProjectConfig(projectConfig as Record<string, unknown>);
		if (configErrors.length > 0) {
			console.warn(`[kapy] ${formatErrors(configErrors)}`);
		}

		sources.set("project", projectConfig);
		// Extensions and middleware from project config aren't merged into the runtime config
		// They're used by the extension loader and middleware pipeline
		const projectValues = { ...projectConfig } as Record<string, unknown>;
		delete projectValues.extensions;
		delete projectValues.middleware;
		// Flatten non-special keys into config under their own namespace
		for (const [key, value] of Object.entries(projectValues)) {
			if (key !== "name" && key !== "envPrefix") {
				(config as Record<string, unknown>)[key] = value;
			}
		}
	}

	// 3. Global config from ~/.kapy/config.json
	const globalConfig = await loadGlobalConfig();
	if (globalConfig) {
		sources.set("global", globalConfig as unknown as MergedConfig);
		// Merge extension settings into config under their namespace
		if (globalConfig.extensions) {
			for (const [extName, extConfig] of Object.entries(globalConfig.extensions)) {
				if (extConfig.config) {
					(config as Record<string, Record<string, unknown>>)[extName] = {
						...(config[extName] ?? {}),
						...extConfig.config,
					};
				}
			}
		}
	}

	// 4. Environment variables
	const envConfig = parseEnvConfig(envPrefix);
	if (Object.keys(envConfig).length > 0) {
		const envMerged: MergedConfig = {};
		for (const [key, value] of Object.entries(envConfig)) {
			// KAPY_EXT_REGION => ext: { region: value }
			const parts = key.split("_");
			if (parts.length >= 2) {
				const ns = parts[0].toLowerCase();
				const field = parts.slice(1).join("_").toLowerCase();
				if (!envMerged[ns]) envMerged[ns] = {};
				(envMerged[ns] as Record<string, unknown>)[field] = value;
			}
		}
		sources.set("env", envMerged);
		config = deepMergeConfigs(config, envMerged);
	}

	// 5. CLI flags
	if (options?.cliFlags && Object.keys(options.cliFlags).length > 0) {
		const flagsMerged: MergedConfig = {};
		// CLI flags with __ are namespace separators (e.g., --deploy__region => deploy.region)
		for (const [key, value] of Object.entries(options.cliFlags)) {
			if (
				key === "json" ||
				key === "no-input" ||
				key === "debug" ||
				key === "trust" ||
				key === "template" ||
				key === "screen"
			)
				continue;
			if (key.includes("__")) {
				const [ns, ...fieldParts] = key.split("__");
				if (!flagsMerged[ns]) flagsMerged[ns] = {};
				(flagsMerged[ns] as Record<string, unknown>)[fieldParts.join("__")] = value;
			} else {
				// Top-level flag goes into "flags" namespace
				if (!flagsMerged.flags) flagsMerged.flags = {};
				(flagsMerged.flags as Record<string, unknown>)[key] = value;
			}
		}
		sources.set("flags", flagsMerged);
		config = deepMergeConfigs(config, flagsMerged);
	}

	// Build _extensions array from global config for extension loader
	if (globalConfig?.extensions && typeof globalConfig.extensions === "object") {
		(config as Record<string, unknown>)._extensions = Object.values(globalConfig.extensions).map(
			(e: { source: string }) => e.source,
		);
	}

	return { config, sources, projectConfig };
}

/** Load project config from kapy.config.ts */
async function loadProjectConfig(dir: string): Promise<ProjectConfig | null> {
	const configPath = join(dir, "kapy.config.ts");

	try {
		await stat(configPath);
	} catch {
		return null;
	}

	try {
		const mod = await import(configPath);
		return (mod.default ?? mod) as ProjectConfig;
	} catch (err) {
		console.warn(`[kapy] Failed to load project config: ${err}`);
		return null;
	}
}

/** Load global config from ~/.kapy/config.json */
async function loadGlobalConfig(): Promise<GlobalConfig | null> {
	const configPath = join(homedir(), ".kapy", "config.json");

	try {
		const content = await readFile(configPath, "utf-8");
		return JSON.parse(content) as GlobalConfig;
	} catch {
		return null;
	}
}

/** Parse environment variables with the given prefix into namespaced config */
export function parseEnvConfig(prefix: string): Record<string, unknown> {
	const config: Record<string, unknown> = {};
	const prefixStr = `${prefix}_`;

	for (const [key, value] of Object.entries(process.env)) {
		if (value === undefined) continue;
		if (!key.startsWith(prefixStr)) continue;

		const configKey = key.slice(prefixStr.length);
		// Deep merge dot-notation keys (KAPY_EXT_REGION => ext.region under ext namespace)
		const parts = configKey.split("_");
		if (parts.length >= 2) {
			config[configKey] = value;
		} else {
			config[configKey.toLowerCase()] = value;
		}
	}

	return config;
}

export { DEFAULT_ENV_PREFIX, deepMergeConfigs, getDefaultConfig };
