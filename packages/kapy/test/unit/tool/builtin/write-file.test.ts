import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { writeFileTool } from "../../../../src/tool/builtin/write-file.js";
import type { ToolExecutionContext } from "../../../../src/tool/types.js";

const TMP = join(import.meta.dir, "__tmp_write_file__");
const ctx: ToolExecutionContext = { cwd: TMP, signal: undefined };

beforeEach(() => {
	mkdirSync(TMP, { recursive: true });
});
afterEach(() => {
	try {
		rmSync(TMP, { recursive: true });
	} catch {}
});

test("writes a new file", async () => {
	await writeFileTool.execute("t1", { path: "new.txt", content: "hello world" }, undefined, () => {}, ctx);
	const content = readFileSync(join(TMP, "new.txt"), "utf-8");
	expect(content).toBe("hello world");
});

test("overwrites an existing file", async () => {
	writeFileSync(join(TMP, "existing.txt"), "old", "utf-8");
	await writeFileTool.execute("t2", { path: "existing.txt", content: "new" }, undefined, () => {}, ctx);
	const content = readFileSync(join(TMP, "existing.txt"), "utf-8");
	expect(content).toBe("new");
});

test("creates parent directories", async () => {
	await writeFileTool.execute("t3", { path: "deep/nested/file.txt", content: "deep" }, undefined, () => {}, ctx);
	expect(existsSync(join(TMP, "deep/nested/file.txt"))).toBe(true);
});

test("isReadOnly returns false", () => {
	expect(writeFileTool.isReadOnly?.({})).toBe(false);
});
