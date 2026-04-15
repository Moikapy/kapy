import { describe, expect, test } from "bun:test";
import { bashTool } from "../../../../src/tool/builtin/bash.js";
import type { ToolExecutionContext } from "../../../../src/tool/types.js";

const ctx: ToolExecutionContext = { cwd: process.cwd(), signal: undefined };

test("executes a command and returns output", async () => {
	const result = await bashTool.execute("t1", { command: "echo hello" }, undefined, () => {}, ctx);
	const text = (result.content[0] as any).text as string;
	expect(text).toContain("hello");
});

test("captures stderr", async () => {
	const result = await bashTool.execute("t2", { command: "echo err >&2 && echo out" }, undefined, () => {}, ctx);
	const text = (result.content[0] as any).text as string;
	expect(text).toContain("err");
	expect(text).toContain("out");
});

test("reports non-zero exit code", async () => {
	const result = await bashTool.execute("t3", { command: "exit 42" }, undefined, () => {}, ctx);
	const text = (result.content[0] as any).text as string;
	expect(text).toContain("42");
});

test("respects cwd parameter", async () => {
	const result = await bashTool.execute("t4", { command: "pwd", cwd: "/" }, undefined, () => {}, ctx);
	const text = (result.content[0] as any).text as string;
	expect(text.trim()).toBe("/");
});

test("isReadOnly returns false", () => {
	expect(bashTool.isReadOnly?.({})).toBe(false);
});
