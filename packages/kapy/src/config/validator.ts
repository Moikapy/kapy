/**
 * Homebrew validator — validates runtime data against kapy's existing schema types.
 *
 * No external dependencies. Works with ConfigField/ConfigSchema types
 * that extensions and configs already use. Validates at config load,
 * extension registration, and command definition boundaries.
 *
 * Why not Zod? Kapy's schemas are flat key-value stores with 5 types
 * (string, number, boolean, array, object). A 150-line validator that
 * integrates directly with existing types beats a 13KB dependency
 * that introduces a parallel schema system.
 */

import type { ConfigSchema } from "./schema.js";

// ─── Type guard helpers ──────────────────────────────────────

function getTypeName(value: unknown): string {
	if (value === null || value === undefined) return "undefined";
	if (Array.isArray(value)) return "array";
	return typeof value;
}

// ─── validate() — core validation against ConfigSchema ────────

/**
 * Validate a data object against a ConfigSchema.
 * Returns an array of error strings (empty = valid).
 * Each error is prefixed with `namespace.fieldName`.
 */
export function validate(schema: ConfigSchema, data: Record<string, unknown>, namespace: string): string[] {
	const errors: string[] = [];

	for (const [key, field] of Object.entries(schema)) {
		const value = data[key];
		const qualifiedName = namespace ? `${namespace}.${key}` : key;

		// Missing/null/undefined
		if (value === undefined || value === null) {
			if (field.required) {
				errors.push(`${qualifiedName}: required but missing`);
			}
			continue;
		}

		// Enum check (before type check — more specific error)
		if (field.enum && !field.enum.includes(String(value))) {
			errors.push(`${qualifiedName}: expected one of ${field.enum.join(", ")}, got "${value}"`);
			continue;
		}

		// Type check
		const actualType = getTypeName(value);
		const expectedType = field.type;

		// Special case: arrays are also "object" in typeof, but we distinguish
		if (expectedType === "object" && actualType === "array") {
			errors.push(`${qualifiedName}: expected object, got array`);
			continue;
		}

		if (actualType !== expectedType) {
			errors.push(`${qualifiedName}: expected ${expectedType}, got ${actualType}`);
		}
	}

	return errors;
}

// ─── validateProjectConfig() ─────────────────────────────────

/** Schema for kapy.config.ts project configuration */
const PROJECT_CONFIG_SCHEMA: ConfigSchema = {
	name: { type: "string", description: "CLI project name" },
	extensions: { type: "array", description: "Extension sources to load" },
	envPrefix: { type: "string", description: "Environment variable prefix" },
	middleware: { type: "array", description: "Middleware functions (checked at runtime)" },
};

/**
 * Validate a project config (kapy.config.ts).
 * Returns error strings. Checks top-level types and array item types.
 */
export function validateProjectConfig(config: Record<string, unknown>): string[] {
	const errors = validate(PROJECT_CONFIG_SCHEMA, config, "");

	// Extra checks: array items must be strings
	if (Array.isArray(config.extensions)) {
		for (let i = 0; i < config.extensions.length; i++) {
			if (typeof config.extensions[i] !== "string") {
				errors.push(`extensions[${i}]: expected string, got ${typeof config.extensions[i]}`);
			}
		}
	}

	return errors;
}

// ─── validateExtensionMeta() ──────────────────────────────────

/** Schema for extension metadata */
const EXTENSION_META_SCHEMA: ConfigSchema = {
	name: { type: "string", required: true, description: "Extension package name" },
	version: { type: "string", required: true, description: "Extension version (semver)" },
	dependencies: { type: "array", description: "Extension dependencies" },
	permissions: { type: "array", description: "Declared permissions" },
};

/**
 * Validate extension metadata.
 * Returns error strings. Checks required fields and array item types.
 */
export function validateExtensionMeta(meta: Record<string, unknown>): string[] {
	const errors = validate(EXTENSION_META_SCHEMA, meta, "");

	// Extra checks: array items must be strings
	if (Array.isArray(meta.dependencies)) {
		for (let i = 0; i < meta.dependencies.length; i++) {
			if (typeof meta.dependencies[i] !== "string") {
				errors.push(`dependencies[${i}]: expected string, got ${typeof meta.dependencies[i]}`);
			}
		}
	}

	if (Array.isArray(meta.permissions)) {
		for (let i = 0; i < meta.permissions.length; i++) {
			if (typeof meta.permissions[i] !== "string") {
				errors.push(`permissions[${i}]: expected string, got ${typeof meta.permissions[i]}`);
			}
		}
	}

	return errors;
}

// ─── describeSchema() — introspection for agents ─────────────

/** Described field for agent consumption */
export interface DescribedField {
	type: string;
	required: boolean;
	description?: string;
	default?: unknown;
	enum?: string[];
}

/**
 * Describe a ConfigSchema for agent consumption.
 * Returns a record mapping field names to their descriptions.
 * Used by `kapy commands --json` and `kapy inspect --json` to auto-generate
 * structured documentation from declared schemas.
 */
export function describeSchema(schema: ConfigSchema): Record<string, DescribedField> {
	const result: Record<string, DescribedField> = {};

	for (const [key, field] of Object.entries(schema)) {
		result[key] = {
			type: field.type,
			required: field.required ?? false,
			description: field.description,
			...(field.default !== undefined && { default: field.default }),
			...(field.enum && { enum: field.enum }),
		};
	}

	return result;
}

// ─── formatErrors() ──────────────────────────────────────────

/**
 * Format an array of validation errors into a human-readable string.
 * Returns empty string for no errors.
 */
export function formatErrors(errors: string[]): string {
	if (errors.length === 0) return "";
	if (errors.length === 1) return `Configuration error: ${errors[0]}`;

	return `Configuration errors:\n${errors.map((e) => `  • ${e}`).join("\n")}`;
}
