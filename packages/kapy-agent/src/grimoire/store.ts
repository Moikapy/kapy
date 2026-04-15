/**
 * GrimoireStore — the agent's persistent knowledge base.
 *
 * A directory of markdown files the agent reads and maintains.
 * The grimoire compounds over time — each session enriches it,
 * and future sessions start with accumulated knowledge instead of a blank slate.
 *
 * Two scopes:
 * - Global: ~/.kapy/wiki/ — about the user, cross-project knowledge
 * - Project: .kapy/wiki/ — codebase-specific knowledge
 *
 * Operations:
 * - CRUD: read, write, delete, list pages
 * - Search: substring + index.md matching (MVP), upgradeable to BM25
 * - Lint: orphans, stale pages, broken links, missing cross-refs
 * - Context: compress pages into a system prompt block
 * - Log: append-only chronicle of grimoire activity
 * - Index: regenerate the content catalog
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { appendFile, readdir, stat, readFile, writeFile, mkdir, unlink } from "node:fs/promises";
import { join, dirname, extname, basename } from "node:path";
import type { GrimoireScope, LogEntry, LintResult, PageMeta, SearchResult, GrimoireStats } from "./types.js";
import { searchPages, searchIndex } from "./search.js";

// ── Constants ──────────────────────────────────────────────────────────

const INDEX_FILE = "index.md";
const LOG_FILE = "log.md";
const CATEGORIES = ["profile", "projects", "concepts", "sources", "decisions", "modules", "patterns"] as const;

// ── Helpers ────────────────────────────────────────────────────────────

function nowISO(): string {
	return new Date().toISOString();
}

/** Extract frontmatter and body from markdown */
function parseFrontmatter(content: string): { meta: Record<string, unknown>; body: string } {
	if (!content.startsWith("---")) return { meta: {}, body: content };

	const end = content.indexOf("---", 3);
	if (end === -1) return { meta: {}, body: content };

	const fm = content.slice(3, end).trim();
	const body = content.slice(end + 3).trim();

	const meta: Record<string, unknown> = {};
	for (const line of fm.split("\n")) {
		const colonIdx = line.indexOf(":");
		if (colonIdx === -1) continue;
		const key = line.slice(0, colonIdx).trim();
		let value: unknown = line.slice(colonIdx + 1).trim();

		// Parse YAML-ish arrays: [tag1, tag2]
		if (typeof value === "string" && value.startsWith("[") && value.endsWith("]")) {
			value = value
				.slice(1, -1)
				.split(",")
				.map((s) => s.trim().replace(/['"]/g, ""));
		}

		meta[key] = value;
	}

	return { meta, body };
}

/** Extract summary from markdown content (first heading or first line) */
function extractSummary(content: string): string {
	const { body } = parseFrontmatter(content);

	// First heading
	const headingMatch = body.match(/^#+\s+(.+)/m);
	if (headingMatch) return headingMatch[1].trim();

	// First non-empty line
	for (const line of body.split("\n")) {
		const trimmed = line.trim();
		if (trimmed && !trimmed.startsWith("<!--")) return trimmed.slice(0, 120);
	}

	return "";
}

/** Infer category from path */
function inferCategory(path: string): string {
	const parts = path.split(/[/\\]/);
	if (parts.length > 1) {
		const cat = parts[0].toLowerCase();
		if (CATEGORIES.includes(cat as any)) return cat;
	}
	return "uncategorized";
}

/** Ensure path is safe (no traversal, proper extension) */
function sanitizePath(path: string): string {
	// Prevent path traversal
	const clean = path.replace(/\.\./g, "").replace(/\\/g, "/");
	// Ensure .md extension
	if (!clean.endsWith(".md")) return `${clean}.md`;
	return clean;
}

// ── GrimoireStore ──────────────────────────────────────────────────────

export interface GrimoireStoreOptions {
	/** Scope: global or project */
	scope: GrimoireScope;
	/** Root directory for the wiki */
	rootDir: string;
}

export class GrimoireStore {
	readonly scope: GrimoireScope;
	readonly rootDir: string;
	private pageCache = new Map<string, PageMeta>();
	private cacheLoaded = false;

	constructor(options: GrimoireStoreOptions) {
		this.scope = options.scope;
		this.rootDir = options.rootDir;
	}

	// ── CRUD ──────────────────────────────────────────────────────────

	/** Read a wiki page. Returns undefined if not found. */
	async read(path: string): Promise<string | undefined> {
		const safePath = sanitizePath(path);
		const fullPath = join(this.rootDir, safePath);

		try {
			return await readFile(fullPath, "utf-8");
		} catch {
			return undefined;
		}
	}

	/** Synchronous read for hot paths (e.g., context injection) */
	readSync(path: string): string | undefined {
		const safePath = sanitizePath(path);
		const fullPath = join(this.rootDir, safePath);

		try {
			return readFileSync(fullPath, "utf-8");
		} catch {
			return undefined;
		}
	}

	/** Write a wiki page. Creates parent directories as needed. */
	async write(path: string, content: string, meta?: { tags?: string[] }): Promise<void> {
		const safePath = sanitizePath(path);
		const fullPath = join(this.rootDir, safePath);

		// Ensure parent directories exist
		await mkdir(dirname(fullPath), { recursive: true });

		// Add frontmatter if tags provided
		let output = content;
		if (meta?.tags && meta.tags.length > 0) {
			const { meta: existingMeta, body } = parseFrontmatter(content);
			const merged = { ...existingMeta, tags: meta.tags };
			const fm = Object.entries(merged)
				.map(([k, v]) => {
					if (Array.isArray(v)) return `${k}: [${v.join(", ")}]`;
					return `${k}: ${v}`;
				})
				.join("\n");
			output = `---\n${fm}\n---\n${body}`;
		}

		await writeFile(fullPath, output, "utf-8");

		// Invalidate cache
		this.cacheLoaded = false;
	}

	/** Delete a wiki page. */
	async delete(path: string): Promise<boolean> {
		const safePath = sanitizePath(path);
		const fullPath = join(this.rootDir, safePath);

		try {
			await unlink(fullPath);
			this.cacheLoaded = false;
			return true;
		} catch {
			return false;
		}
	}

	/** Check if a page exists. */
	async exists(path: string): Promise<boolean> {
		const safePath = sanitizePath(path);
		const fullPath = join(this.rootDir, safePath);
		return existsSync(fullPath);
	}

	/** List all pages with metadata. */
	async list(category?: string): Promise<PageMeta[]> {
		await this.loadCache();

		let pages = [...this.pageCache.values()];

		if (category) {
			pages = pages.filter((p) => p.category === category);
		}

		return pages.sort((a, b) => a.path.localeCompare(b.path));
	}

	// ── Search ────────────────────────────────────────────────────────

	/** Search across wiki pages by content and metadata. */
	async search(query: string, topK = 5): Promise<SearchResult[]> {
		const pages = await this.list();

		// Quick check: search index first for fast results
		const indexContent = this.readSync(INDEX_FILE);
		if (indexContent) {
			const indexResults = searchIndex(indexContent, query, topK);
			if (indexResults.length > 0) {
				// If index has good results, combine with full search
				const fullResults = await searchPages(this.rootDir, pages, query, topK);
				// Merge, dedup by path, take top K
				const seen = new Set<string>();
				const merged: SearchResult[] = [];
				for (const r of [...fullResults, ...indexResults]) {
					if (!seen.has(r.path) && r.path) {
						seen.add(r.path);
						merged.push(r);
					}
				}
				merged.sort((a, b) => b.score - a.score);
				return merged.slice(0, topK);
			}
		}

		return searchPages(this.rootDir, pages, query, topK);
	}

	// ── Special Files ────────────────────────────────────────────────

	/** Read the index.md catalog. */
	readIndex(): string | undefined {
		return this.readSync(INDEX_FILE);
	}

	/** Regenerate index.md from current pages. */
	async updateIndex(): Promise<void> {
		const pages = await this.list();
		const lines: string[] = ["# Grimoire Index", "", `> Auto-generated catalog. ${pages.length} pages.`, ""];

		// Group by category
		const byCategory = new Map<string, PageMeta[]>();
		for (const page of pages) {
			const cat = page.category || "uncategorized";
			if (!byCategory.has(cat)) byCategory.set(cat, []);
			byCategory.get(cat)!.push(page);
		}

		for (const [cat, catPages] of byCategory) {
			lines.push(`## ${cat.charAt(0).toUpperCase() + cat.slice(1)}`);
			lines.push("");
			for (const page of catPages) {
				const summary = page.summary ? ` — ${page.summary}` : "";
				lines.push(`- [[${page.path}]]${summary}`);
			}
			lines.push("");
		}

		await this.write(INDEX_FILE, lines.join("\n") + "\n");
	}

	/** Read the log.md chronicle. */
	readLog(): string | undefined {
		return this.readSync(LOG_FILE);
	}

	/** Append an entry to the log. */
	async appendLog(entry: LogEntry): Promise<void> {
		const prefix = `## [${entry.timestamp}] ${entry.type}`;
		const lines: string[] = [prefix + " | " + entry.summary];

		if (entry.pagesUpdated && entry.pagesUpdated.length > 0) {
			lines.push(`- Updated: ${entry.pagesUpdated.join(", ")}`);
		}
		if (entry.pagesRead && entry.pagesRead.length > 0) {
			lines.push(`- Read: ${entry.pagesRead.join(", ")}`);
		}
		lines.push("");

		const logPath = join(this.rootDir, LOG_FILE);

		// Ensure root dir exists
		await mkdir(this.rootDir, { recursive: true });

		await appendFile(logPath, lines.join("\n") + "\n", "utf-8");
	}

	// ── Maintenance ──────────────────────────────────────────────────

	/** Health-check the grimoire for issues. */
	async lint(): Promise<LintResult[]> {
		const pages = await this.list();
		const pagePaths = new Set(pages.map((p) => p.path));
		const issues: LintResult[] = [];

		// 1. Orphan pages — no inbound wikilinks from other pages
		const linkedPages = new Set<string>();
		for (const page of pages) {
			try {
				const content = await this.read(page.path);
				if (!content) continue;
				// Find [[wikilinks]] and [text](path) links
				const wikiLinks = content.matchAll(/\[\[([^\]]+)\]\]/g);
				for (const match of wikiLinks) {
					linkedPages.add(sanitizePath(match[1]));
				}
				const mdLinks = content.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g);
				for (const match of mdLinks) {
					if (!match[2].startsWith("http")) {
						linkedPages.add(sanitizePath(match[2]));
					}
				}
			} catch {
				// Skip unreadable pages
			}
		}

		// Index and log are expected to link to many pages, skip them
		for (const page of pages) {
			if (page.path === INDEX_FILE || page.path === LOG_FILE) continue;
			if (!linkedPages.has(page.path)) {
				issues.push({
					type: "orphan",
					path: page.path,
					message: `Page has no inbound links from other pages`,
					suggestion: `Add a link to this page from index.md or a related page`,
					severity: "info",
				});
			}
		}

		// 2. Broken links — links pointing to non-existent pages
		for (const page of pages) {
			try {
				const content = await this.read(page.path);
				if (!content) continue;

				const wikiLinks = content.matchAll(/\[\[([^\]]+)\]\]/g);
				for (const match of wikiLinks) {
					const target = sanitizePath(match[1]);
					if (!pagePaths.has(target)) {
						issues.push({
							type: "broken_link",
							path: page.path,
							message: `Links to non-existent page: [[${match[1]}]]`,
							suggestion: `Create ${target} or fix the link`,
							severity: "warn",
						});
					}
				}
			} catch {
				// Skip
			}
		}

		// 3. Empty pages
		for (const page of pages) {
			if (page.size < 50 && page.path !== LOG_FILE) {
				issues.push({
					type: "empty_page",
					path: page.path,
					message: `Page appears empty or minimal (${page.size} bytes)`,
					suggestion: `Add content or remove the page`,
					severity: "info",
				});
			}
		}

		// 4. Stale pages — not updated in 30+ days
		const thirtyDays = 30 * 24 * 60 * 60 * 1000;
		for (const page of pages) {
			if (Date.now() - page.updatedAt > thirtyDays && page.path !== LOG_FILE && page.path !== INDEX_FILE) {
				issues.push({
					type: "stale",
					path: page.path,
					message: `Page not updated in 30+ days`,
					suggestion: `Review if content is still accurate`,
					severity: "info",
				});
			}
		}

		return issues;
	}

	/** Get grimoire statistics. */
	async getStats(): Promise<GrimoireStats> {
		const pages = await this.list();
		const byCategory: Record<string, number> = {};
		let totalSize = 0;

		for (const page of pages) {
			byCategory[page.category || "uncategorized"] = (byCategory[page.category || "uncategorized"] ?? 0) + 1;
			totalSize += page.size;
		}

		let lastActivity: string | undefined;
		try {
			const log = this.readLog();
			if (log) {
				const match = log.match(/## \[(\d{4}-\d{2}-\d{2}T[^]]+)\]/);
				if (match) lastActivity = match[1];
			}
		} catch {
			// No log
		}

		return {
			totalPages: pages.length,
			totalSize,
			byCategory,
			lastActivity,
			logEntries: this.countLogEntries(),
		};
	}

	// ── Context Injection ────────────────────────────────────────────

	/** Compress search results into a system prompt block for context injection. */
	summarizeForContext(results: SearchResult[], maxTokens = 500): string {
		if (results.length === 0) return "";

		const estimatedChars = maxTokens * 4; // ~4 chars per token
		let output = `📖 **Grimoire** (${results.length} relevant pages)\n\n`;

		for (const result of results) {
			if (output.length >= estimatedChars) break;

			output += `### ${result.path}\n`;
			if (result.snippet) {
				output += `${result.snippet}\n`;
			}
			output += "\n";
		}

		return output;
	}

	// ── Ingest ────────────────────────────────────────────────────────

	/**
	 * Ingest a raw source into the grimoire.
	 *
	 * Reads the source, generates a summary page in sources/,
	 * and updates the index and log.
	 *
	 * @param sourcePath - Path to the raw source file
	 * @param title - Optional title (defaults to filename)
	 * @returns Pages created or updated
	 */
	async ingest(sourcePath: string, title?: string): Promise<import("./types.js").IngestResult> {
		const { readFile: readFileAsync } = await import("node:fs/promises");
		const { basename: baseName } = await import("node:path");

		// Read source
		let content: string;
		try {
			content = await readFileAsync(sourcePath, "utf-8");
		} catch {
			throw new Error(`Cannot read source: ${sourcePath}`);
		}

		const name = title || baseName(sourcePath, ".md");
		const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
		const pagePath = `sources/${slug}.md`;

		// Extract key info from the source
		const lines = content.split("\n");
		const firstHeading = lines.find((l) => l.startsWith("# "))?.replace(/^#\s+/, "") || name;
		const wordCount = content.split(/\s+/).length;

		// Build the summary page
		const page = `
# ${firstHeading}

> Ingested from \`${baseName(sourcePath)}\` on ${nowISO().split("T")[0]}
>
> ${wordCount} words | ${lines.length} lines

## Summary

${content.slice(0, 2000)}${content.length > 2000 ? "\n\n... (truncated — see raw source for full content)" : ""}
`.trimStart();

		await this.write(pagePath, page, { tags: ["ingested", slug] });

		const pagesUpdated = [pagePath];

		// Update index
		await this.updateIndex();

		// Log the ingest
		await this.appendLog({
			timestamp: nowISO(),
			type: "ingest",
			summary: `Ingested: ${name}`,
			pagesUpdated,
		});

		return {
			pagesUpdated,
			summary: `Ingested ${name} → ${pagePath}`,
		};
	}

	// ── Lifecycle ────────────────────────────────────────────────────

	/** Ensure the wiki directory exists with starter files. */
	async ensure(): Promise<void> {
		await mkdir(this.rootDir, { recursive: true });

		// Create index.md if missing
		if (!(await this.exists(INDEX_FILE))) {
			await this.write(
				INDEX_FILE,
				`# Grimoire Index\n\n> Auto-generated catalog. 0 pages.\n\n*No pages yet. The grimoire grows as the agent learns.*\n`,
			);
		}

		// Create log.md if missing
		if (!(await this.exists(LOG_FILE))) {
			await this.write(LOG_FILE, `# Grimoire Log\n\nChronological record of grimoire activity.\n\n`);
		}

		// Create profile directory with starter template
		const profileDir = join(this.rootDir, "profile");
		await mkdir(profileDir, { recursive: true });

		if (!(await this.exists("profile/preferences.md"))) {
			await this.write(
				"profile/preferences.md",
				`# User Preferences\n\n*The agent will fill this in as it learns about you.*\n\n## Tooling\n\n## Languages\n\n## Workflow\n`,
			);
		}

		if (!(await this.exists("profile/goals.md"))) {
			await this.write(
				"profile/goals.md",
				`# Goals\n\n*What you're building toward.*\n\n## Short-term\n\n## Long-term\n`,
			);
		}

		this.cacheLoaded = false;
	}

	// ── Internal ─────────────────────────────────────────────────────

	/** Load page metadata cache from disk. */
	private async loadCache(): Promise<void> {
		if (this.cacheLoaded) return;
		this.pageCache.clear();

		try {
			await this.walkDir(this.rootDir, "");
		} catch {
			// Directory doesn't exist yet
		}

		this.cacheLoaded = true;
	}

	/** Recursively walk a directory and collect page metadata. */
	private async walkDir(dir: string, prefix: string): Promise<void> {
		let entries;
		try {
			entries = await readdir(dir, { withFileTypes: true });
		} catch {
			return;
		}

		for (const entry of entries) {
			// Skip hidden files and .obsidian, .git, etc.
			if (entry.name.startsWith(".")) continue;

			const fullPath = join(dir, entry.name);
			const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;

			if (entry.isDirectory()) {
				await this.walkDir(fullPath, relPath);
			} else if (entry.name.endsWith(".md")) {
				try {
					const fileStat = await stat(fullPath);
					const content = await readFile(fullPath, "utf-8");
					const { meta } = parseFrontmatter(content);
					const summary = extractSummary(content);

					this.pageCache.set(relPath, {
						path: relPath,
						summary,
						category: inferCategory(relPath),
						tags: Array.isArray(meta.tags) ? meta.tags : undefined,
						updatedAt: fileStat.mtimeMs,
						createdAt: fileStat.birthtimeMs,
						size: fileStat.size,
					});
				} catch {
					// Skip unreadable files
				}
			}
		}
	}

	/** Count entries in log.md */
	private countLogEntries(): number {
		const log = this.readLog();
		if (!log) return 0;
		return (log.match(/^## \[/gm) || []).length;
	}
}