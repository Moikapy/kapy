import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { grepTool } from "../../../../src/tool/builtin/grep.js";
import type { ToolExecutionContext } from "../../../../src/tool/types.js";

const TMP = join(import.meta.dir, "__tmp_grep__");
const ctx: ToolExecutionContext = { cwd: TMP, signal: undefined };

beforeEach(() => {
	mkdirSync(TMP, { recursive: true });
	mkdirSync(join(TMP, "src"), { recursive: true });
	writeFileSync(join(TMP, "hello.ts"), "export const hello = () => 'hello';\nexport default hello;\n");
	writeFileSync(join(TMP, "src", "world.ts"), "export const world = () => 'world';\nexport const greeting = 'hi';\n");
});
afterEach(() => {
	try {
		rmSync(TMP, { recursive: true });
	} catch {}
});

test("searches for text pattern", async () => {
	const result = await grepTool.execute("t1", { pattern: "hello" }, undefined, () => {}, ctx);
	const text = (result.content[0] as any).text as string;
	expect(text).toContain("hello.ts");
	expect(text).toContain("hello");
});

test("searches with regex pattern", async () => {
	const result = await grepTool.execute("t2", { pattern: "export const \\w+" }, undefined, () => {}, ctx);
	const text = (result.content[0] as any).text as string;
	expect(text).toContain("export const hello");
	expect(text).toContain("export const world");
});

test("case-insensitive search", async () => {
	const result = await grepTool.execute("t3", { pattern: "HELLO", ignoreCase: true }, undefined, () => {}, ctx);
	const text = (result.content[0] as any).text as string;
	expect(text).toContain("hello");
});

test("no matches returns message", async () => {
	const result = await grepTool.execute("t4", { pattern: "xyznonexistent" }, undefined, () => {}, ctx);
	const text = (result.content[0] as any).text as string;
	expect(text).toContain("No matches");
});

test("file pattern filter", async () => {
	const result = await grepTool.execute("t5", { pattern: "export", filePattern: "*.ts" }, undefined, () => {}, ctx);
	const text = (result.content[0] as any).text as string;
	expect(text).toContain("hello.ts");
});

test("isReadOnly returns true", () => {
	expect(grepTool.isReadOnly?.({})).toBe(true);
});
