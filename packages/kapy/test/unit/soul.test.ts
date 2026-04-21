/**
 * Tests for SOUL.md — the agent's identity layer.
 *
 * Covers loading, template initialization, and system prompt building.
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildSystemPrompt, DEFAULT_SOUL_TEMPLATE, ensureSoulMd, loadSoulMd } from "../../src/ai/soul.js";

let testDir: string;

beforeEach(() => {
	testDir = mkdtempSync(join(tmpdir(), "soul-test-"));
});

afterEach(() => {
	rmSync(testDir, { recursive: true, force: true });
});

describe("SOUL.md", () => {
	it("ensureSoulMd creates SOUL.md if missing", () => {
		const soulPath = join(testDir, "SOUL.md");
		ensureSoulMd(soulPath);

		expect(existsSync(soulPath)).toBe(true);
		const content = readFileSync(soulPath, "utf-8");
		expect(content).toContain("Identity");
		expect(content).toContain("Communication");
	});

	it("ensureSoulMd does not overwrite existing SOUL.md", () => {
		const soulPath = join(testDir, "SOUL.md");

		// Write custom content
		const { writeFileSync } = require("node:fs");
		writeFileSync(soulPath, "# Custom Soul\n\nMy identity.", "utf-8");

		ensureSoulMd(soulPath);

		const content = readFileSync(soulPath, "utf-8");
		expect(content).toContain("Custom Soul");
		expect(content).not.toContain(DEFAULT_SOUL_TEMPLATE.slice(0, 30));
	});

	it("loadSoulMd reads existing file", () => {
		const soulPath = join(testDir, "SOUL.md");
		ensureSoulMd(soulPath);

		const content = loadSoulMd(soulPath);
		expect(content.length).toBeGreaterThan(0);
		expect(content).toContain("SOUL.md");
	});

	it("loadSoulMd returns template for missing file", () => {
		const content = loadSoulMd(join(testDir, "nonexistent.md"));
		expect(content).toBe(DEFAULT_SOUL_TEMPLATE);
	});

	it("buildSystemPrompt combines soul + grimoire context", () => {
		const prompt = buildSystemPrompt("I am Atlas.", "📖 Grimoire (2 pages)\n\n### Projects\nInfo here.");
		expect(prompt).toContain("I am Atlas.");
		expect(prompt).toContain("Grimoire");
		expect(prompt).toContain("Projects");
	});

	it("buildSystemPrompt works without grimoire context", () => {
		const prompt = buildSystemPrompt("I am Atlas.");
		expect(prompt).toBe("I am Atlas.");
	});

	it("DEFAULT_SOUL_TEMPLATE contains all required sections", () => {
		expect(DEFAULT_SOUL_TEMPLATE).toContain("Identity");
		expect(DEFAULT_SOUL_TEMPLATE).toContain("Communication");
		expect(DEFAULT_SOUL_TEMPLATE).toContain("Core Truths");
		expect(DEFAULT_SOUL_TEMPLATE).toContain("Boundaries");
		expect(DEFAULT_SOUL_TEMPLATE).toContain("Domain");
		expect(DEFAULT_SOUL_TEMPLATE).toContain("Vibe");
		expect(DEFAULT_SOUL_TEMPLATE).toContain("Continuity");
	});
});
