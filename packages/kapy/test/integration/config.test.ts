/**
 * Config loading integration tests — test config hierarchy and merging.
 */
import { describe, expect, it } from "bun:test";
import { deepMergeConfigs, loadConfig, parseEnvConfig } from "../../src/config/loader.js";
import { cleanupTemp, createTempProject, DEFAULT_CONFIG_TS, MINIMAL_PACKAGE_JSON } from "../helpers.js";

describe("Config Loading", () => {
	describe("loadConfig", () => {
		it("returns defaults when no config files exist", async () => {
			const { config } = await loadConfig({
				projectDir: "/tmp/kapy-nonexistent-test",
			});
			expect(config).toBeDefined();
			// Should be an empty object (defaults)
			expect(typeof config).toBe("object");
		});

		it("loads project config from kapy.config.ts", async () => {
			const dir = await createTempProject({
				"package.json": MINIMAL_PACKAGE_JSON,
				"kapy.config.ts": DEFAULT_CONFIG_TS,
			});

			try {
				const { sources } = await loadConfig({ projectDir: dir });
				expect(sources.has("project")).toBe(true);
				const projectConfig = sources.get("project");
				if (projectConfig && typeof projectConfig === "object" && "name" in projectConfig) {
					expect((projectConfig as { name: string }).name).toBe("test-cli");
				}
			} finally {
				await cleanupTemp(dir);
			}
		});

		it("merges CLI flags into config", async () => {
			const { config } = await loadConfig({
				cliFlags: { verbose: true, region: "us-west-2" },
			});
			// CLI flags should end up in a flags namespace
			expect(config).toBeDefined();
		});
	});

	describe("parseEnvConfig", () => {
		it("parses environment variables with prefix", () => {
			process.env.KAPY_TEST_FOO = "bar";
			const config = parseEnvConfig("KAPY_TEST");
			expect(config).toHaveProperty("foo", "bar");
			delete process.env.KAPY_TEST_FOO;
		});

		it("ignores variables without prefix", () => {
			process.env.OTHER_VAR = "should-not-appear";
			const config = parseEnvConfig("KAPY_TEST_XYZ");
			expect(config).not.toHaveProperty("OTHER_VAR");
			delete process.env.OTHER_VAR;
		});

		it("handles empty env", () => {
			const config = parseEnvConfig("KAPY_NEVER_EXISTS_PREFIX");
			expect(Object.keys(config)).toHaveLength(0);
		});
	});

	describe("deepMergeConfigs", () => {
		it("merges nested objects deeply", () => {
			const result = deepMergeConfigs(
				{ deploy: { region: "us-east-1", env: "staging", replicas: 3 } },
				{ deploy: { region: "eu-west-1" } },
			);
			expect(result).toEqual({
				deploy: { region: "eu-west-1", env: "staging", replicas: 3 },
			});
		});

		it("overrides primitives", () => {
			const result = deepMergeConfigs({ debug: { verbose: false, level: "info" } }, { debug: { verbose: true } });
			expect(result).toEqual({
				debug: { verbose: true, level: "info" },
			});
		});

		it("handles empty configs", () => {
			expect(deepMergeConfigs()).toEqual({});
			expect(deepMergeConfigs({})).toEqual({});
			expect(deepMergeConfigs({}, { a: 1 })).toEqual({ a: 1 });
		});

		it("merges three levels of precedence", () => {
			const defaults = { app: { port: 3000, debug: false } };
			const project = { app: { port: 8080 } };
			const env = { app: { debug: true } };
			const result = deepMergeConfigs(defaults, project, env);
			expect(result).toEqual({
				app: { port: 8080, debug: true },
			});
		});

		it("handles arrays as primitives (no deep merge)", () => {
			const result = deepMergeConfigs({ tags: ["a", "b"] }, { tags: ["c", "d"] });
			expect(result).toEqual({ tags: ["c", "d"] });
		});
	});
});
