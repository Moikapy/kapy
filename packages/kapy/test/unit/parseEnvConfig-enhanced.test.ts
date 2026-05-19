/**
 * Tests for parseEnvConfig type coercion and consistent casing.
 */
import { describe, expect, it } from "bun:test";
import { parseEnvConfig } from "../../src/config/loader.js";

describe("parseEnvConfig type coercion", () => {
	it("coerces boolean true values", () => {
		process.env.KAPY_DEBUG = "true";
		process.env.KAPY_VERBOSE = "1";
		process.env.KAPY_ENABLED = "yes";
		const config = parseEnvConfig("KAPY");
		expect(config.debug).toBe(true);
		expect(config.verbose).toBe(true);
		expect(config.enabled).toBe(true);
		delete process.env.KAPY_DEBUG;
		delete process.env.KAPY_VERBOSE;
		delete process.env.KAPY_ENABLED;
	});

	it("coerces boolean false values", () => {
		process.env.KAPY_DEBUG = "false";
		process.env.KAPY_VERBOSE = "0";
		process.env.KAPY_ENABLED = "no";
		const config = parseEnvConfig("KAPY");
		expect(config.debug).toBe(false);
		expect(config.verbose).toBe(false);
		expect(config.enabled).toBe(false);
		delete process.env.KAPY_DEBUG;
		delete process.env.KAPY_VERBOSE;
		delete process.env.KAPY_ENABLED;
	});

	it("coerces numeric values", () => {
		process.env.KAPY_PORT = "3000";
		process.env.KAPY_TIMEOUT = "30.5";
		const config = parseEnvConfig("KAPY");
		expect(config.port).toBe(3000);
		expect(config.timeout).toBe(30.5);
		delete process.env.KAPY_PORT;
		delete process.env.KAPY_TIMEOUT;
	});

	it("leaves string values as strings", () => {
		process.env.KAPY_NAME = "my-project";
		const config = parseEnvConfig("KAPY");
		expect(config.name).toBe("my-project");
		expect(typeof config.name).toBe("string");
		delete process.env.KAPY_NAME;
	});

	it("does not coerce empty string to number 0", () => {
		process.env.KAPY_EMPTY = "";
		const config = parseEnvConfig("KAPY");
		expect(config.empty).toBe("");
		delete process.env.KAPY_EMPTY;
	});
});

describe("parseEnvConfig casing consistency", () => {
	it("consistently lowercases single-segment keys", () => {
		process.env.KAPY_DEBUG = "true";
		const config = parseEnvConfig("KAPY");
		expect(config.debug).toBe(true);
		delete process.env.KAPY_DEBUG;
	});

	it("consistently lowercases multi-segment keys into namespace.field", () => {
		process.env.KAPY_EXT_REGION = "us-east-1";
		const config = parseEnvConfig("KAPY");
		expect(config.ext).toBeDefined();
		expect((config.ext as Record<string, unknown>).region).toBe("us-east-1");
		delete process.env.KAPY_EXT_REGION;
	});

	it("handles deeply nested multi-segment keys", () => {
		process.env.KAPY_EXT_DB_HOST = "localhost";
		const config = parseEnvConfig("KAPY");
		expect(config.ext).toBeDefined();
		expect((config.ext as Record<string, unknown>).db_host).toBe("localhost");
		delete process.env.KAPY_EXT_DB_HOST;
	});
});
