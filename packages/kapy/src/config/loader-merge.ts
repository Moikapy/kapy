/**
 * Deep merge utility for config objects (later values override earlier).
 */
import type { MergedConfig } from "./schema.js";

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