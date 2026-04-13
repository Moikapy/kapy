/**
 * Tests for the homebrew validator — validate(), describe(), format().
 *
 * Works against kapy's existing ConfigField/ConfigSchema types.
 * No external dependencies. Validates runtime data at config load,
 * extension meta, and command definition boundaries.
 */
import { describe, expect, it } from "bun:test";
import {
	type ConfigSchema,
	describeSchema,
	formatErrors,
	validate,
	validateExtensionMeta,
	validateProjectConfig,
} from "../../src/config/validator.js";

// ─── validate() ─────────────────────────────────────────────

describe("validate", () => {
	const schema: ConfigSchema = {
		region: { type: "string", required: true, description: "AWS region" },
		verbose: { type: "boolean", default: false },
		timeout: { type: "number", default: 30 },
		tags: { type: "array", description: "Resource tags" },
		metadata: { type: "object", description: "Extra metadata" },
		environment: { type: "string", enum: ["staging", "production"], required: true },
	};

	it("returns no errors for valid data", () => {
		const errors = validate(
			schema,
			{
				region: "us-east-1",
				environment: "staging",
			},
			"deploy",
		);
		expect(errors).toEqual([]);
	});

	it("reports missing required fields", () => {
		const errors = validate(schema, {}, "deploy");
		expect(errors).toContain("deploy.region: required but missing");
		expect(errors).toContain("deploy.environment: required but missing");
	});

	it("reports wrong types", () => {
		const errors = validate(
			schema,
			{
				region: 42,
				verbose: "yes",
				timeout: "30",
				tags: "not-array",
				metadata: "not-object",
			},
			"deploy",
		);
		expect(errors).toContain("deploy.region: expected string, got number");
		expect(errors).toContain("deploy.verbose: expected boolean, got string");
		expect(errors).toContain("deploy.timeout: expected number, got string");
		expect(errors).toContain("deploy.tags: expected array, got string");
		expect(errors).toContain("deploy.metadata: expected object, got string");
	});

	it("reports enum violations", () => {
		const errors = validate(
			schema,
			{
				region: "us-east-1",
				environment: "dev",
			},
			"deploy",
		);
		expect(errors).toContain('deploy.environment: expected one of staging, production, got "dev"');
	});

	it("allows enum values that match", () => {
		const errors = validate(
			schema,
			{
				region: "us-east-1",
				environment: "production",
			},
			"deploy",
		);
		expect(errors).toEqual([]);
	});

	it("ignores optional fields that are missing", () => {
		const errors = validate(
			schema,
			{
				region: "us-east-1",
				environment: "staging",
				// verbose, timeout, tags, metadata all missing but optional
			},
			"deploy",
		);
		expect(errors).toEqual([]);
	});

	it("treats null as missing", () => {
		const errors = validate(
			schema,
			{
				region: null,
				environment: "staging",
			},
			"deploy",
		);
		expect(errors).toContain("deploy.region: required but missing");
	});

	it("treats undefined as missing", () => {
		const errors = validate(
			schema,
			{
				region: undefined,
				environment: "staging",
			},
			"deploy",
		);
		expect(errors).toContain("deploy.region: required but missing");
	});

	it("allows arrays for array type", () => {
		const errors = validate(
			schema,
			{
				region: "us-east-1",
				environment: "staging",
				tags: ["web", "prod"],
			},
			"deploy",
		);
		expect(errors).toEqual([]);
	});

	it("allows plain objects for object type", () => {
		const errors = validate(
			schema,
			{
				region: "us-east-1",
				environment: "staging",
				metadata: { owner: "team" },
			},
			"deploy",
		);
		expect(errors).toEqual([]);
	});

	it("rejects arrays for object type", () => {
		const errors = validate(
			schema,
			{
				region: "us-east-1",
				environment: "staging",
				metadata: ["not", "an", "object"],
			},
			"deploy",
		);
		expect(errors).toContain("deploy.metadata: expected object, got array");
	});

	it("works with empty schema (no constraints)", () => {
		const errors = validate({}, { anything: "goes" }, "ns");
		expect(errors).toEqual([]);
	});

	it("collects all errors, not just the first", () => {
		const errors = validate(
			schema,
			{
				verbose: 123,
				timeout: "not-a-number",
			},
			"deploy",
		);
		expect(errors.length).toBeGreaterThanOrEqual(4); // 2 required + 2 type
	});
});

// ─── validateProjectConfig() ────────────────────────────────

describe("validateProjectConfig", () => {
	it("accepts valid project config", () => {
		const errors = validateProjectConfig({
			name: "my-cli",
			extensions: ["npm:@foo/ext"],
			envPrefix: "MY_CLI",
		});
		expect(errors).toEqual([]);
	});

	it("accepts empty config", () => {
		const errors = validateProjectConfig({});
		expect(errors).toEqual([]);
	});

	it("reports wrong type for name", () => {
		const errors = validateProjectConfig({ name: 123 });
		expect(errors).toContain("name: expected string, got number");
	});

	it("reports wrong type for extensions", () => {
		const errors = validateProjectConfig({ extensions: "not-array" });
		expect(errors).toContain("extensions: expected array, got string");
	});

	it("reports non-string items in extensions array", () => {
		const errors = validateProjectConfig({ extensions: ["npm:@foo/ext", 123] });
		expect(errors).toContain("extensions[1]: expected string, got number");
	});

	it("reports wrong type for envPrefix", () => {
		const errors = validateProjectConfig({ envPrefix: false });
		expect(errors).toContain("envPrefix: expected string, got boolean");
	});
});

// ─── validateExtensionMeta() ─────────────────────────────────

describe("validateExtensionMeta", () => {
	it("accepts valid extension meta", () => {
		const errors = validateExtensionMeta({
			name: "@foo/kapy-ext",
			version: "1.2.3",
			dependencies: ["@foo/kapy-core"],
			permissions: ["fs:read"],
		});
		expect(errors).toEqual([]);
	});

	it("requires name", () => {
		const errors = validateExtensionMeta({ version: "1.0.0" });
		expect(errors).toContain("name: required but missing");
	});

	it("requires version", () => {
		const errors = validateExtensionMeta({ name: "ext" });
		expect(errors).toContain("version: required but missing");
	});

	it("reports wrong types", () => {
		const errors = validateExtensionMeta({
			name: 42,
			version: 1,
			dependencies: "not-array",
			permissions: "not-array",
		});
		expect(errors).toContain("name: expected string, got number");
		expect(errors).toContain("version: expected string, got number");
		expect(errors).toContain("dependencies: expected array, got string");
		expect(errors).toContain("permissions: expected array, got string");
	});

	it("reports non-string items in dependencies", () => {
		const errors = validateExtensionMeta({
			name: "ext",
			version: "1.0.0",
			dependencies: [123],
		});
		expect(errors).toContain("dependencies[0]: expected string, got number");
	});
});

// ─── describeSchema() ────────────────────────────────────────

describe("describeSchema", () => {
	it("describes a config schema for agent consumption", () => {
		const schema: ConfigSchema = {
			region: { type: "string", required: true, description: "AWS region", enum: ["us-east-1", "eu-west-1"] },
			timeout: { type: "number", default: 30, description: "Request timeout in seconds" },
		};
		const desc = describeSchema(schema);

		expect(desc.region).toEqual({
			type: "string",
			required: true,
			description: "AWS region",
			enum: ["us-east-1", "eu-west-1"],
		});
		expect(desc.timeout).toEqual({
			type: "number",
			required: false,
			description: "Request timeout in seconds",
			default: 30,
		});
	});

	it("defaults required to false when not specified", () => {
		const desc = describeSchema({ verbose: { type: "boolean" } });
		expect(desc.verbose.required).toBe(false);
	});

	it("works with empty schema", () => {
		const desc = describeSchema({});
		expect(Object.keys(desc)).toEqual([]);
	});
});

// ─── formatErrors() ──────────────────────────────────────────

describe("formatErrors", () => {
	it("returns empty string for no errors", () => {
		expect(formatErrors([])).toBe("");
	});

	it("formats a single error", () => {
		expect(formatErrors(["deploy.region: required but missing"])).toBe(
			"Configuration error: deploy.region: required but missing",
		);
	});

	it("formats multiple errors with bullets", () => {
		const result = formatErrors(["deploy.region: required but missing", "deploy.timeout: expected number, got string"]);
		expect(result).toContain("Configuration errors:");
		expect(result).toContain("  • deploy.region: required but missing");
		expect(result).toContain("  • deploy.timeout: expected number, got string");
	});
});
