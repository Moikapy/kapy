/**
 * Config schema types for kapy extensions and projects.
 */

import type { Middleware } from "../middleware/pipeline.js";

/** A single config field definition */
export interface ConfigField {
	type: "string" | "number" | "boolean" | "array" | "object";
	description?: string;
	default?: unknown;
	required?: boolean;
	enum?: string[];
}

/** Config schema declared by an extension — keys are field names */
export type ConfigSchema = Record<string, ConfigField>;

/** Merged config accessible via ctx.config — keys are extension namespaces */
export type MergedConfig = Record<string, Record<string, unknown>>;

/** Config sources in merge order (later overrides earlier) */
export const ConfigSourcePriority = ["defaults", "project", "global", "env", "flags"] as const;

export type ConfigSource = (typeof ConfigSourcePriority)[number];

/** Project config (kapy.config.ts) */
export interface ProjectConfig {
	name?: string;
	extensions?: string[];
	middleware?: Middleware[];
	envPrefix?: string;
	[key: string]: unknown;
}

/** Global config (~/.kapy/config.json) */
export interface GlobalConfig {
	extensions?: Record<string, { version: string; source: string; config?: Record<string, unknown> }>;
	[key: string]: unknown;
}
