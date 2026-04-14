import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { globTool } from "../../../../src/tool/builtin/glob.js";
import type { ToolExecutionContext } from "../../../../src/tool/types.js";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";

const TMP = join(import.meta.dir, "__tmp_glob__");
const ctx: ToolExecutionContext = { cwd: TMP, signal: undefined };

beforeEach(() => {
	mkdirSync(TMP, { recursive: true });
	mkdirSync(join(TMP, "src"), { recursive: true });
	writeFileSync(join(TMP, "a.ts"), "// a");
	writeFileSync(join(TMP, "b.js"), "// b");
	writeFileSync(join(TMP, "src", "c.ts"), "// c");
	writeFileSync(join(TMP, "src", "d.ts"), "// d");
});
afterEach(() => { try { rmSync(TMP, { recursive: true }); } catch {} });

test("finds files matching a glob pattern", async () => {
	const result = await globTool.execute("t1", { pattern: "**/*.ts" }, undefined, () => {}, ctx);
	const text = (result.content[0] as any).text as string;
	expect(text).toContain("a.ts");
	expect(text).toContain("src/c.ts");
});

test("finds js files", async () => {
	const result = await globTool.execute("t2", { pattern: "*.js" }, undefined, () => {}, ctx);
	const text = (result.content[0] as any).text as string;
	expect(text).toContain("b.js");
});

test("returns no matches message", async () => {
	const result = await globTool.execute("t3", { pattern: "*.zig" }, undefined, () => {}, ctx);
	const text = (result.content[0] as any).text as string;
	expect(text).toContain("No files matching");
});

test("isReadOnly returns true", () => {
	expect(globTool.isReadOnly?.({})).toBe(true);
});