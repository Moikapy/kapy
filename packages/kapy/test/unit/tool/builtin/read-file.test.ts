import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readFileTool } from "../../../../src/tool/builtin/read-file.js";
import type { ToolExecutionContext } from "../../../../src/tool/types.js";

const TMP = join(import.meta.dir, "__tmp_read_file__");
const ctx: ToolExecutionContext = { cwd: TMP, signal: undefined };

beforeEach(() => {
	mkdirSync(TMP, { recursive: true });
});
afterEach(() => {
	try {
		rmSync(TMP, { recursive: true });
	} catch {}
});

test("reads a file and adds line numbers", async () => {
	writeFileSync(join(TMP, "test.txt"), "hello\nworld\n");
	const result = await readFileTool.execute("t1", { path: "test.txt" }, undefined, () => {}, ctx);
	expect(result.content[0].type).toBe("text");
	const text = (result.content[0] as any).text as string;
	expect(text).toContain("1: hello");
	expect(text).toContain("2: world");
});

test("reads with offset and limit", async () => {
	writeFileSync(join(TMP, "multi.txt"), "line1\nline2\nline3\nline4\nline5\n");
	const result = await readFileTool.execute("t2", { path: "multi.txt", offset: 2, limit: 2 }, undefined, () => {}, ctx);
	const text = (result.content[0] as any).text as string;
	expect(text).toContain("2: line2");
	expect(text).toContain("3: line3");
	expect(text).not.toContain("line1");
	expect(text).not.toContain("line4");
});

test("returns error for directory", async () => {
	mkdirSync(join(TMP, "dirr"), { recursive: true });
	const result = await readFileTool.execute("t3", { path: "dirr" }, undefined, () => {}, ctx);
	const text = (result.content[0] as any).text as string;
	expect(text).toContain("is a directory");
});

test("returns error for missing file", async () => {
	const result = await readFileTool.execute("t4", { path: "nope.txt" }, undefined, () => {}, ctx);
	const text = (result.content[0] as any).text as string;
	expect(text).toContain("not found");
});

test("isReadOnly returns true", () => {
	expect(readFileTool.isReadOnly?.({})).toBe(true);
});
