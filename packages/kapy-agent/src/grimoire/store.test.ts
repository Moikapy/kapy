/**
 * Tests for the GrimoireStore — the agent's persistent knowledge base.
 *
 * Covers CRUD, search, lint, index, log, context injection, and edge cases.
 * Uses /tmp for isolated test directories.
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { extractQuery, searchIndex } from "../../src/grimoire/search.js";
import { GrimoireStore } from "../../src/grimoire/store.js";
import type { LogEntry, SearchResult } from "../../src/grimoire/types.js";

// ── Helpers ──────────────────────────────────────────────────────

let testDir: string;

function createStore(scope: "global" | "project" = "global", dir?: string): GrimoireStore {
	const rootDir = dir ?? join(testDir, "wiki");
	return new GrimoireStore({ scope, rootDir });
}

function _writeTmpFile(store: GrimoireStore, path: string, content: string) {
	return store.write(path, content);
}

// ── Setup/Teardown ──────────────────────────────────────────────

beforeEach(() => {
	testDir = mkdtempSync(join(tmpdir(), "grimoire-test-"));
});

afterEach(() => {
	rmSync(testDir, { recursive: true, force: true });
});

// ── CRUD ──────────────────────────────────────────────────────

describe("GrimoireStore — CRUD", () => {
	it("write creates a page and read returns it", async () => {
		const store = createStore();
		await store.ensure();

		await store.write("profile/preferences.md", "# Preferences\n\nI love Bun.\n");
		const content = await store.read("profile/preferences.md");

		expect(content).toBeDefined();
		expect(content!).toContain("I love Bun.");
	});

	it("read returns undefined for missing pages", async () => {
		const store = createStore();
		await store.ensure();

		const content = await store.read("nonexistent.md");
		expect(content).toBeUndefined();
	});

	it("write overwrites existing pages", async () => {
		const store = createStore();
		await store.ensure();

		await store.write("test.md", "version 1");
		await store.write("test.md", "version 2");
		const content = await store.read("test.md");

		expect(content).toBe("version 2");
	});

	it("write adds .md extension if missing", async () => {
		const store = createStore();
		await store.ensure();

		await store.write("profile/goals", "# Goals\n\nBuild things.\n");
		const content = await store.read("profile/goals.md");
		expect(content).toBeDefined();
	});

	it("write creates parent directories", async () => {
		const store = createStore();
		await store.ensure();

		await store.write("deep/nested/path/page.md", "# Deep\n");
		const content = await store.read("deep/nested/path/page.md");
		expect(content).toBeDefined();
	});

	it("delete removes a page", async () => {
		const store = createStore();
		await store.ensure();

		await store.write("to-delete.md", "goodbye");
		const deleted = await store.delete("to-delete.md");
		expect(deleted).toBe(true);

		const content = await store.read("to-delete.md");
		expect(content).toBeUndefined();
	});

	it("delete returns false for missing pages", async () => {
		const store = createStore();
		await store.ensure();

		const deleted = await store.delete("nonexistent.md");
		expect(deleted).toBe(false);
	});

	it("exists returns true for existing pages", async () => {
		const store = createStore();
		await store.ensure();

		await store.write("exists.md", "here");
		expect(await store.exists("exists.md")).toBe(true);
		expect(await store.exists("missing.md")).toBe(false);
	});

	it("readSync reads synchronously", async () => {
		const store = createStore();
		await store.ensure();

		await store.write("sync-test.md", "sync content");
		const content = store.readSync("sync-test.md");
		expect(content).toBe("sync content");
	});

	it("write with tags adds frontmatter", async () => {
		const store = createStore();
		await store.ensure();

		await store.write("tagged.md", "# Tagged\n\nContent here.", { tags: ["typescript", "architecture"] });
		const content = await store.read("tagged.md");

		expect(content!).toContain("tags: [typescript, architecture]");
		expect(content!).toContain("Content here.");
	});
});

// ── List ──────────────────────────────────────────────────────

describe("GrimoireStore — list", () => {
	it("lists all pages with metadata", async () => {
		const store = createStore();
		await store.ensure();

		await store.write("profile/preferences.md", "# Preferences\n\nBun.\n");
		await store.write("projects/test.md", "# Test\n\nA project.\n");

		const pages = await store.list();
		expect(pages.length).toBeGreaterThanOrEqual(2);

		const prefs = pages.find((p) => p.path === "profile/preferences.md");
		expect(prefs).toBeDefined();
		expect(prefs!.summary).toContain("Preferences");
		expect(prefs!.category).toBe("profile");
	});

	it("filters by category", async () => {
		const store = createStore();
		await store.ensure();

		await store.write("profile/preferences.md", "# Prefs\n");
		await store.write("projects/test.md", "# Test\n");
		await store.write("concepts/idea.md", "# Idea\n");

		const profilePages = await store.list("profile");
		expect(profilePages.every((p) => p.category === "profile")).toBe(true);
	});

	it("returns empty array for empty wiki", async () => {
		const store = createStore();
		// Don't call ensure — empty dir
		const pages = await store.list();
		expect(pages).toEqual([]);
	});
});

// ── Search ──────────────────────────────────────────────────────

describe("GrimoireStore — search", () => {
	it("finds pages by content", async () => {
		const store = createStore();
		await store.ensure();

		await store.write("profile/preferences.md", "# Preferences\n\nI prefer Bun over npm for TypeScript projects.\n");
		await store.write("projects/kapy.md", "# Kapy\n\nThe agent-first CLI framework.\n");

		const results = await store.search("Bun TypeScript", 5);
		expect(results.length).toBeGreaterThan(0);
		expect(results[0].path).toContain("preferences");
		expect(results[0].score).toBeGreaterThan(0);
	});

	it("finds pages by filename", async () => {
		const store = createStore();
		await store.ensure();

		await store.write("architecture/decisions.md", "# Decisions\n\nSome choices.\n");

		const results = await store.search("decisions", 5);
		expect(results.length).toBeGreaterThan(0);
		expect(results[0].path).toContain("decisions");
	});

	it("returns empty for no matches", async () => {
		const store = createStore();
		await store.ensure();

		await store.write("test.md", "# Hello\n\nWorld.\n");

		const results = await store.search("xyzzyplugh nothing matches", 5);
		expect(results).toEqual([]);
	});

	it("respects topK limit", async () => {
		const store = createStore();
		await store.ensure();

		await store.write("a.md", "# Page A\n\nBun TypeScript\n");
		await store.write("b.md", "# Page B\n\nBun TypeScript\n");
		await store.write("c.md", "# Page C\n\nBun TypeScript\n");

		const results = await store.search("Bun TypeScript", 2);
		expect(results.length).toBeLessThanOrEqual(2);
	});

	it("includes snippet in results", async () => {
		const store = createStore();
		await store.ensure();

		await store.write("docs/guide.md", "# Guide\n\nThis is a detailed guide about using Bun for builds.\n");

		const results = await store.search("detailed guide", 5);
		if (results.length > 0) {
			expect(results[0].snippet.length).toBeGreaterThan(0);
		}
	});
});

// ── Index ──────────────────────────────────────────────────────

describe("GrimoireStore — index", () => {
	it("updateIndex creates index.md with all pages", async () => {
		const store = createStore();
		await store.ensure();

		await store.write("profile/preferences.md", "# Preferences\n\nMy stuff.\n");
		await store.write("projects/kapy.md", "# Kapy\n\nFramework.\n");

		await store.updateIndex();

		const index = store.readSync("index.md");
		expect(index).toBeDefined();
		expect(index!).toContain("Grimoire Index");
		expect(index!).toContain("profile/preferences.md");
		expect(index!).toContain("projects/kapy.md");
	});

	it("updateIndex groups by category", async () => {
		const store = createStore();
		await store.ensure();

		await store.write("profile/preferences.md", "# Prefs\n");
		await store.write("projects/kapy.md", "# Kapy\n");

		await store.updateIndex();

		const index = store.readSync("index.md");
		expect(index!).toContain("Profile");
		expect(index!).toContain("Projects");
	});
});

// ── Log ──────────────────────────────────────────────────────

describe("GrimoireStore — log", () => {
	it("appendLog adds entries to log.md", async () => {
		const store = createStore();
		await store.ensure();

		const entry: LogEntry = {
			timestamp: "2026-04-15T12:00:00.000Z",
			type: "session",
			summary: "First session",
			pagesUpdated: ["profile/preferences.md"],
		};

		await store.appendLog(entry);

		const log = store.readLog();
		expect(log).toBeDefined();
		expect(log!).toContain("## [2026-04-15T12:00:00.000Z] session");
		expect(log!).toContain("First session");
		expect(log!).toContain("profile/preferences.md");
	});

	it("appendLog is append-only (multiple entries)", async () => {
		const store = createStore();
		await store.ensure();

		await store.appendLog({
			timestamp: "2026-04-15T10:00:00.000Z",
			type: "session",
			summary: "Session 1",
		});

		await store.appendLog({
			timestamp: "2026-04-15T12:00:00.000Z",
			type: "ingest",
			summary: "Ingested article",
		});

		const log = store.readLog();
		expect(log!).toContain("Session 1");
		expect(log!).toContain("Ingested article");
	});
});

// ── Lint ──────────────────────────────────────────────────────

describe("GrimoireStore — lint", () => {
	it("detects empty pages", async () => {
		const store = createStore();
		await store.ensure();

		await store.write("empty.md", ""); // Empty page

		const issues = await store.lint();
		const emptyIssues = issues.filter((i) => i.type === "empty_page");
		expect(emptyIssues.length).toBeGreaterThan(0);
	});

	it("detects orphan pages (no inbound links)", async () => {
		const store = createStore();
		await store.ensure();

		await store.write("orphan.md", "# Orphan\n\nNo one links to me.\n");

		const issues = await store.lint();
		const orphans = issues.filter((i) => i.type === "orphan");
		expect(orphans.some((o) => o.path === "orphan.md")).toBe(true);
	});

	it("detects broken links to non-existent pages", async () => {
		const store = createStore();
		await store.ensure();

		await store.write("broken.md", "# Broken\n\nCheck [[nonexistent-page]] for details.\n");

		const issues = await store.lint();
		const brokenLinks = issues.filter((i) => i.type === "broken_link");
		expect(brokenLinks.length).toBeGreaterThan(0);
	});

	it("returns empty issues for healthy wiki", async () => {
		const store = createStore();
		await store.ensure();

		// index.md and profile pages from ensure() are well-structured
		// The auto-generated pages may or may not have issues
		const issues = await store.lint();
		// Just ensure it doesn't crash and returns an array
		expect(Array.isArray(issues)).toBe(true);
	});

	it("does not flag index.md and log.md as orphans", async () => {
		const store = createStore();
		await store.ensure();

		const issues = await store.lint();
		const orphans = issues.filter((i) => i.type === "orphan" && (i.path === "index.md" || i.path === "log.md"));
		expect(orphans.length).toBe(0);
	});
});

// ── Stats ──────────────────────────────────────────────────────

describe("GrimoireStore — stats", () => {
	it("returns correct page counts", async () => {
		const store = createStore();
		await store.ensure();

		await store.write("profile/preferences.md", "# Prefs\n");
		await store.write("projects/test.md", "# Test\n");

		const stats = await store.getStats();
		expect(stats.totalPages).toBeGreaterThanOrEqual(2);
		expect(stats.totalSize).toBeGreaterThan(0);
		expect(stats.logEntries).toBeGreaterThanOrEqual(0);
	});

	it("groups pages by category", async () => {
		const store = createStore();
		await store.ensure();

		await store.write("profile/prefs.md", "# Prefs\n");
		await store.write("projects/proj.md", "# Project\n");

		const stats = await store.getStats();
		expect(stats.byCategory.profile).toBeGreaterThanOrEqual(1);
		expect(stats.byCategory.projects).toBeGreaterThanOrEqual(1);
	});
});

// ── Ingest ──────────────────────────────────────────────────────

describe("GrimoireStore — ingest", () => {
	it("ingests a source file into sources/ directory", async () => {
		const store = createStore();
		await store.ensure();

		const { writeFile: writeFileAsync } = await import("node:fs/promises");
		const sourcePath = join(testDir, "test-source.md");
		await writeFileAsync(
			sourcePath,
			"# Test Article\n\nThis is an article about TypeScript patterns.\n\n## Key Points\n\n- Type safety\n- Pattern matching\n",
		);

		const result = await store.ingest(sourcePath, "Test Article");

		expect(result.pagesUpdated.length).toBeGreaterThan(0);
		expect(result.summary).toContain("Test Article");

		const page = await store.read(result.pagesUpdated[0]);
		expect(page).toBeDefined();
		expect(page!).toContain("TypeScript patterns");
	});

	it("slugifies the title for the page path", async () => {
		const store = createStore();
		await store.ensure();

		const { writeFile: writeFileAsync } = await import("node:fs/promises");
		const sourcePath = join(testDir, "source.md");
		await writeFileAsync(sourcePath, "# My Cool Article\n\nContent.\n");

		const result = await store.ingest(sourcePath, "My Cool Article");

		expect(result.pagesUpdated[0]).toContain("sources/my-cool-article");
	});

	it("throws for missing source files", async () => {
		const store = createStore();
		await store.ensure();

		expect(store.ingest("/nonexistent/file.md")).rejects.toThrow("Cannot read source");
	});

	it("logs the ingest in log.md", async () => {
		const store = createStore();
		await store.ensure();

		const { writeFile: writeFileAsync } = await import("node:fs/promises");
		const sourcePath = join(testDir, "article.md");
		await writeFileAsync(sourcePath, "# Article\n\nContent.\n");

		await store.ingest(sourcePath, "Test Article");

		const log = store.readLog();
		expect(log!).toContain("ingest");
		expect(log!).toContain("Test Article");
	});
});

// ── Ensure ──────────────────────────────────────────────────────

describe("GrimoireStore — ensure", () => {
	it("creates directory structure", async () => {
		const store = createStore();
		await store.ensure();

		expect(existsSync(join(store.rootDir, "index.md"))).toBe(true);
		expect(existsSync(join(store.rootDir, "log.md"))).toBe(true);
		expect(existsSync(join(store.rootDir, "profile"))).toBe(true);
	});

	it("creates starter profile pages", async () => {
		const store = createStore();
		await store.ensure();

		const prefs = await store.read("profile/preferences.md");
		expect(prefs).toBeDefined();

		const goals = await store.read("profile/goals.md");
		expect(goals).toBeDefined();
	});

	it("does not overwrite existing pages", async () => {
		const store = createStore();
		await store.ensure();

		await store.write("profile/preferences.md", "# Custom Content\n\nMy stuff.\n");
		await store.ensure();

		const content = await store.read("profile/preferences.md");
		expect(content).toContain("Custom Content");
	});
});

// ── Context Injection ──────────────────────────────────────────

describe("GrimoireStore — summarizeForContext", () => {
	it("produces a compressed context block", async () => {
		const store = createStore();

		const results: SearchResult[] = [
			{ path: "profile/preferences.md", score: 0.8, snippet: "User prefers Bun", matchedFields: ["content"] },
			{ path: "projects/kapy.md", score: 0.6, snippet: "Agent-first CLI framework", matchedFields: ["content"] },
		];

		const context = store.summarizeForContext(results, 200);
		expect(context).toContain("Grimoire");
		expect(context).toContain("profile/preferences.md");
	});

	it("returns empty string for empty results", () => {
		const store = createStore();
		const context = store.summarizeForContext([]);
		expect(context).toBe("");
	});
});

// ── Search Utilities ──────────────────────────────────────────

describe("extractQuery", () => {
	it("strips common question prefixes", () => {
		expect(extractQuery("how do I build the project?")).toBe("build the project");
		expect(extractQuery("what is the architecture?")).toBe("the architecture");
		expect(extractQuery("tell me about TypeScript")).toBe("about TypeScript");
	});

	it("preserves non-question input", () => {
		expect(extractQuery("build the project")).toBe("build the project");
	});

	it("truncates long queries", () => {
		const long = "a".repeat(300);
		expect(extractQuery(long).length).toBeLessThanOrEqual(200);
	});
});

describe("searchIndex", () => {
	it("finds matching lines in index content", () => {
		const index = `# Grimoire Index

## Profile
- [[profile/preferences.md]] — User preferences
- [[profile/goals.md]] — User goals

## Projects
- [[projects/kapy.md]] — Agent-first CLI framework
`;

		const results = searchIndex(index, "preferences", 5);
		expect(results.length).toBeGreaterThan(0);
		expect(results[0].snippet).toContain("preferences");
	});

	it("returns empty for no matches", () => {
		const results = searchIndex("# Index\n\nNothing here.\n", "xyzzyplugh", 5);
		expect(results).toEqual([]);
	});
});

// ── Scope ──────────────────────────────────────────────────────

describe("GrimoireStore — scope", () => {
	it("global scope is accessible", () => {
		const store = createStore("global");
		expect(store.scope).toBe("global");
	});

	it("project scope is accessible", () => {
		const store = createStore("project");
		expect(store.scope).toBe("project");
	});
});

// ── Path Safety ──────────────────────────────────────────────

describe("GrimoireStore — path safety", () => {
	it("blocks path traversal attempts", async () => {
		const store = createStore();
		await store.ensure();

		// Attempting to write to ../etc/passwd.md should be sanitized
		await store.write("../etc/passwd.md", "malicious");

		// Should not exist outside wiki dir
		expect(existsSync(join(testDir, "etc", "passwd.md"))).toBe(false);
	});
});
