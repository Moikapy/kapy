/**
 * Config loader — loads and merges config from all sources.
 *
 * Hierarchy: kapy defaults → project kapy.config.ts → ~/.kapy/config.json → env vars → CLI flags
 */
import type { MergedConfig, ProjectConfig, ConfigSource } from "./schema.js";
import { getDefaultConfig } from "./defaults.js";
import { DEFAULT_ENV_PREFIX } from "./defaults.js";

/** Load and merge all config sources */
export async function loadConfig(options?: {
	projectDir?: string;
	envPrefix?: string;
	cliFlags?: Record<string, unknown>;
}): Promise<{ config: MergedConfig; sources: Map<ConfigSource, MergedConfig | ProjectConfig> }> {
	const envPrefix = options?.envPrefix ?? DEFAULT_ENV_PREFIX;

	// Start with defaults
	const config = getDefaultConfig();
	const sources = new Map<ConfigSource, MergedConfig | ProjectConfig>();

	// TODO: Load project config from kapy.config.ts
	// TODO: Load global config from ~/.kapy/config.json
	// TODO: Parse environment variables with envPrefix
	// TODO: Merge CLI flags

	return { config, sources };
}

/** Parse environment variables with the given prefix into a flat config object */
export function parseEnvConfig(prefix: string): Record<string, unknown> {
	const config: Record<string, unknown> = {};
	const prefixLen = prefix.length + 1; // prefix + "_"

	for (const [key, value] of Object.entries(process.env)) {
		if (key.startsWith(`${prefix}_`)) {
			const configKey = key.slice(prefixLen).toLowerCase();
			// TODO: deep merge dot-notation keys (KAPY_EXT_REGION => ext.region)
			config[configKey] = value;
		}
	}

	return config;
}

/** Deep merge multiple config objects (later values override earlier) */
export function deepMergeConfigs(...configs: MergedConfig[]): MergedConfig {
	const result: MergedConfig = {};
	for (const config of configs) {
		for (const [key, value] of Object.entries(config)) {
			if (typeof value === "object" && value !== null && !Array.isArray(value)) {
				result[key] = deepMergeConfigs((result[key] as MergedConfig | undefined) ?? {}, value as MergedConfig);
			} else {
				result[key] = value;
			}
		}
	}
	return result;
}

export { getDefaultConfig, DEFAULT_ENV_PREFIX };