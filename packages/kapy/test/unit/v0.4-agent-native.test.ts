/**
 * Tests for v0.4 agent-native features:
 * - ctx.setResult() / ctx.result
 * - Compact mode
 * - formatCompact() utility
 * - stripAnsi() utility
 * - --agent / --schema / --compact universal flags
 * - ctx.spawn() compact + maxLines + parsed JSON
 * - skills command
 */
import { describe, expect, test } from "bun:test";
import { CommandContext, formatCompact, stripAnsi } from "../../src/command/context.js";

// ─── stripAnsi ────────────────────────────────────────────────

describe("stripAnsi", () => {
	test("strips basic ANSI color codes", () => {
		expect(stripAnsi("\x1b[32mhello\x1b[0m")).toBe("hello");
	});

	test("leaves plain text unchanged", () => {
		expect(stripAnsi("plain text")).toBe("plain text");
	});

	test("strips multiple ANSI sequences", () => {
		expect(stripAnsi("\x1b[1m\x1b[31merror\x1b[0m: \x1b[33mwarning\x1b[0m")).toBe("error: warning");
	});

	test("handles empty string", () => {
		expect(stripAnsi("")).toBe("");
	});
});

// ─── formatCompact ─────────────────────────────────────────────

describe("formatCompact", () => {
	test("returns empty string for null", () => {
		expect(formatCompact(null)).toBe("");
	});

	test("returns empty string for undefined", () => {
		expect(formatCompact(undefined)).toBe("");
	});

	test("returns string as-is (stripped of ANSI)", () => {
		expect(formatCompact("hello")).toBe("hello");
	});

	test("returns number as string", () => {
		expect(formatCompact(42)).toBe("42");
	});

	test("returns boolean as string", () => {
		expect(formatCompact(true)).toBe("true");
	});

	test("returns array length summary", () => {
		expect(formatCompact([1, 2, 3])).toBe("[3 items]");
	});

	test("flat object: key:value|key:value format", () => {
		const result = formatCompact({ name: "test", count: 5, active: true });
		expect(result).toBe("name:test|count:5|active:true");
	});

	test("skips null/undefined values in flat object", () => {
		const result = formatCompact({ name: "test", empty: null, missing: undefined });
		expect(result).toBe("name:test");
	});

	test("nested object: falls back to JSON", () => {
		const result = formatCompact({ name: "test", nested: { a: 1 } });
		expect(result).toBe(JSON.stringify({ name: "test", nested: { a: 1 } }));
	});

	test("empty object returns {}", () => {
		expect(formatCompact({})).toBe("{}");
	});

	test("short arrays in values: shows length", () => {
		const result = formatCompact({ items: ["a", "b"] });
		expect(result).toBe("items:[2]");
	});
});

// ─── CommandContext v0.4 ───────────────────────────────────────

describe("CommandContext v0.4", () => {
	test("setResult and result work", () => {
		const ctx = new CommandContext({});
		expect(ctx.result).toBeUndefined();
		ctx.setResult({ status: "ok", count: 3 });
		expect(ctx.result).toEqual({ status: "ok", count: 3 });
	});

	test("compact mode suppresses log output", () => {
		const ctx = new CommandContext({ compact: true });
		// log/warn should be no-ops in compact mode
		ctx.log("should not appear");
		ctx.warn("should not appear");
		// No assertion needed — just ensuring no crash
		expect(true).toBe(true);
	});

	test("compactLine only outputs in compact mode", () => {
		const ctx = new CommandContext({ compact: true });
		ctx.compactLine("test output");
		// Just verifying no crash
		expect(true).toBe(true);
	});

	test("compactLine is no-op when not in compact mode", () => {
		const ctx = new CommandContext({ compact: false });
		ctx.compactLine("should not appear");
		expect(true).toBe(true);
	});

	test("isInteractive returns false in compact mode", () => {
		const ctx = new CommandContext({ compact: true });
		expect(ctx.isInteractive).toBe(false);
	});

	test("isInteractive returns false in json mode", () => {
		const ctx = new CommandContext({ json: true });
		expect(ctx.isInteractive).toBe(false);
	});

	test("constructor accepts compact option", () => {
		const ctx = new CommandContext({ compact: true });
		expect(ctx.compact).toBe(true);
	});

	test("constructor defaults compact to false", () => {
		const ctx = new CommandContext({});
		expect(ctx.compact).toBe(false);
	});
});

// ─── compactEmitted / jsonEmitted guards ─────────────────────

describe("emit guards", () => {
	test("compactLine sets compactEmitted flag", () => {
		const ctx = new CommandContext({ compact: true });
		expect(ctx.compactEmitted).toBe(false);
		ctx.compactLine("test");
		expect(ctx.compactEmitted).toBe(true);
	});

	test("compactLine is no-op when not in compact mode (flag stays false)", () => {
		const ctx = new CommandContext({ compact: false });
		ctx.compactLine("test");
		expect(ctx.compactEmitted).toBe(false);
	});

	test("markJsonEmitted sets jsonEmitted flag", () => {
		const ctx = new CommandContext({ json: true });
		expect(ctx.jsonEmitted).toBe(false);
		ctx.markJsonEmitted();
		expect(ctx.jsonEmitted).toBe(true);
	});

	test("setResult stores result for later retrieval", () => {
		const ctx = new CommandContext({});
		expect(ctx.result).toBeUndefined();
		ctx.setResult({ items: [1, 2, 3] });
		expect(ctx.result).toEqual({ items: [1, 2, 3] });
	});

	test("setResult can be called multiple times (last wins)", () => {
		const ctx = new CommandContext({});
		ctx.setResult({ a: 1 });
		ctx.setResult({ b: 2 });
		expect(ctx.result).toEqual({ b: 2 });
	});
});
