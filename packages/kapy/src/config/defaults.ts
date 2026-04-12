/**
 * Default kapy configuration values.
 */
import { homedir } from "node:os";
import { join } from "node:path";
import type { MergedConfig } from "./schema.js";

/** Path to the kapy global directory */
export const KAPY_HOME = join(homedir(), ".kapy");

/** Path to the kapy extensions directory */
export const EXTENSIONS_DIR = join(KAPY_HOME, "extensions");

/** Path to the kapy cache directory */
export const CACHE_DIR = join(KAPY_HOME, "cache");

/** Built-in default config values */
export const defaults: MergedConfig = {};

/** Get the default env prefix for standalone mode */
export const DEFAULT_ENV_PREFIX = "KAPY";

/** Built-in default config for a fresh kapy instance */
export function getDefaultConfig(): MergedConfig {
	return { ...defaults };
}

/** Ensure the ~/.kapy/ directory structure exists */
export async function ensureKapyDirs(): Promise<void> {
	const { mkdir } = await import("node:fs/promises");
	await mkdir(KAPY_HOME, { recursive: true });
	await mkdir(EXTENSIONS_DIR, { recursive: true });
	await mkdir(CACHE_DIR, { recursive: true });
}
