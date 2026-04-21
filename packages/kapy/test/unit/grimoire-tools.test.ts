/**
 * Tests for grimoire agent tools — KapyToolRegistration definitions.
 *
 * Tests the tool definitions and their execute() functions
 * against a real GrimoireStore in /tmp.
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GrimoireStore } from "@moikapy/kapy-agent";
import { createGrimoireTools } from "../../src/ai/grimoire-tools.js";
import type { KapyToolRegistration } from "../../src/tool/types.js";

let testDir: string;
let globalStore: GrimoireStore;
let projectStore: GrimoireStore;
let tools: KapyToolRegistration[];

beforeEach(async () => {
	testDir = mkdtempSync(join(tmpdir(), "grimoire-tools-test-"));
	globalStore = new GrimoireStore({ scope: "global", rootDir: join(testDir, "global") });
	projectStore = new GrimoireStore({ scope: "project", rootDir: join(testDir, "project") });
	await globalStore.ensure();
	await projectStore.ensure();

	tools = createGrimoireTools(globalStore, projectStore);
});

afterEach(() => {
	rmSync(testDir, { recursive: true, force: true });
});

function getTool(name: string): KapyToolRegistration {
	const tool = tools.find((t) => t.name === name);
	expect(tool).toBeDefined();
	return tool!;
}

describe("Grimoire Tools", () => {
	it("creates 7 tools (read, write, search, list, lint, ingest, soul_evolve)", () => {
		expect(tools.length).toBe(7);
		expect(tools.map((t) => t.name)).toEqual([
			"grimoire_read",
			"grimoire_write",
			"grimoire_search",
			"grimoire_list",
			"grimoire_ingest",
			"grimoire_lint",
			"soul_evolve",
		]);
	});

	it("all tools have required fields", () => {
		for (const tool of tools) {
			expect(tool.name).toBeTruthy();
			expect(tool.label).toBeTruthy();
			expect(tool.description).toBeTruthy();
			expect(tool.parameters).toBeDefined();
			expect(typeof tool.execute).toBe("function");
		}
	});

	// ── Read ──────────────────────────────────────────────────

	it("grimoire_read reads a page", async () => {
		await globalStore.write("test.md", "# Test\n");
		const tool = getTool("grimoire_read");

		const result = await tool.execute("id1", { path: "test.md", scope: "global" }, undefined, () => {}, {
			cwd: process.cwd(),
			signal: new AbortController().signal,
		});

		expect(result.content[0].type).toBe("text");
		expect((result.content[0] as { type: "text"; text: string }).text).toContain("Test");
	});

	it("grimoire_read returns not-found for missing pages", async () => {
		const tool = getTool("grimoire_read");

		const result = await tool.execute("id1", { path: "missing.md", scope: "global" }, undefined, () => {}, {
			cwd: process.cwd(),
			signal: new AbortController().signal,
		});

		expect(result.content[0].type).toBe("text");
		expect((result.content[0] as { type: "text"; text: string }).text).toContain("not found");
	});

	// ── Write ─────────────────────────────────────────────────

	it("grimoire_write writes a page", async () => {
		const tool = getTool("grimoire_write");

		await tool.execute("id1", { path: "new.md", content: "# New\n", scope: "global" }, undefined, () => {}, {
			cwd: process.cwd(),
			signal: new AbortController().signal,
		});

		// Verify it was actually written
		const content = await globalStore.read("new.md");
		expect(content).toContain("New");
	});

	// ── Search ────────────────────────────────────────────────

	it("grimoire_search finds relevant pages", async () => {
		await globalStore.write("docs/typescript.md", "# TypeScript\n\nTypeScript is a typed superset of JavaScript.\n");
		const tool = getTool("grimoire_search");

		const result = await tool.execute("id1", { query: "TypeScript", scope: "global", topK: 5 }, undefined, () => {}, {
			cwd: process.cwd(),
			signal: new AbortController().signal,
		});

		expect(result.content[0].type).toBe("text");
		const text = (result.content[0] as { type: "text"; text: string }).text;
		expect(text).toContain("typescript.md");
	});

	// ── List ──────────────────────────────────────────────────

	it("grimoire_list returns page listing", async () => {
		await globalStore.write("profile/prefs.md", "# Prefs\n");
		const tool = getTool("grimoire_list");

		const result = await tool.execute("id1", { scope: "global" }, undefined, () => {}, {
			cwd: process.cwd(),
			signal: new AbortController().signal,
		});

		expect(result.content[0].type).toBe("text");
		const text = (result.content[0] as { type: "text"; text: string }).text;
		expect(text).toContain("pages");
	});

	// ── Lint ─────────────────────────────────────────────────

	it("grimoire_lint returns health check", async () => {
		const tool = getTool("grimoire_lint");

		const result = await tool.execute("id1", { scope: "global" }, undefined, () => {}, {
			cwd: process.cwd(),
			signal: new AbortController().signal,
		});

		expect(result.content[0].type).toBe("text");
		// Should return results (even if healthy)
		expect(typeof (result.content[0] as { type: "text"; text: string }).text).toBe("string");
	});

	// ── Ingest ───────────────────────────────────────────────

	it("grimoire_ingest ingests a source file", async () => {
		const { writeFile } = await import("node:fs/promises");
		const sourcePath = join(testDir, "source.md");
		await writeFile(sourcePath, "# Article\n\nContent here.\n");

		const tool = getTool("grimoire_ingest");

		const result = await tool.execute("id1", { sourcePath, scope: "global" }, undefined, () => {}, {
			cwd: process.cwd(),
			signal: new AbortController().signal,
		});

		expect(result.content[0].type).toBe("text");
		const text = (result.content[0] as { type: "text"; text: string }).text;
		expect(text).toContain("Ingested");
	});

	// ── isReadOnly / isConcurrencySafe ────────────────────────

	it("read-only tools are marked correctly", () => {
		const readOnlyTools = ["grimoire_read", "grimoire_search", "grimoire_list", "grimoire_lint"];
		for (const name of readOnlyTools) {
			const tool = getTool(name);
			expect(tool.isReadOnly?.({})).toBe(true);
		}
	});

	it("write tools are not read-only", () => {
		const writeTools = ["grimoire_write", "grimoire_ingest", "soul_evolve"];
		for (const name of writeTools) {
			const tool = getTool(name);
			expect(tool.isReadOnly?.({})).toBe(false);
		}
	});
});
