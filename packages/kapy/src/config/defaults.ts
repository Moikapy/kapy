/**
 * Default kapy configuration values.
 */
import type { MergedConfig } from "./schema.js";

/** Built-in default config values */
export const defaults: MergedConfig = {};

/** Get the default env prefix for standalone mode */
export const DEFAULT_ENV_PREFIX = "KAPY";

/** Built-in default config for a fresh kapy instance */
export function getDefaultConfig(): MergedConfig {
	return { ...defaults };
}