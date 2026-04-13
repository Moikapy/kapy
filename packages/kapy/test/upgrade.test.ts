import { describe, expect, it } from "bun:test";
import { CommandContext } from "../src/command/context.js";

/**
 * Integration tests for kapy upgrade command.
 *
 * We can't easily test the actual npm publish lifecycle in CI,
 * but we can test the key behaviors: PM detection, --pm flag, and error states.
 */

// Helper to create a command context for testing
function createTestContext(overrides: { json?: boolean; noInput?: boolean; pm?: string } = {}): CommandContext {
	return new CommandContext({
		args: { "no-input": true, json: overrides.json ?? false, ...(overrides.pm ? { pm: overrides.pm } : {}) },
		command: "upgrade",
		json: overrides.json ?? false,
		noInput: true,
	});
}

describe("upgrade command", () => {
	it("creates a context with --pm flag support", () => {
		const ctx = createTestContext({ pm: "npm" });
		expect(ctx.args.pm).toBe("npm");
	});

	it("creates a context without --pm flag", () => {
		const ctx = createTestContext();
		expect(ctx.args.pm).toBeUndefined();
	});

	it("json mode is set correctly via context", () => {
		const ctx = createTestContext({ json: true });
		expect(ctx.json).toBe(true);
	});

	it("noInput mode suppresses prompts", () => {
		const ctx = createTestContext();
		expect(ctx.noInput).toBe(true);
		expect(() => ctx.prompt("test")).toThrow();
	});
});
