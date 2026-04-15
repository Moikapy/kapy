/**
 * Grimoire types — the agent's persistent knowledge base.
 *
 * The Grimoire is a directory of markdown files the agent reads and writes.
 * It accumulates knowledge over sessions — user preferences, project architecture,
 * decisions, concepts, and ingested sources.
 *
 * Two scopes:
 * - Global: ~/.kapy/wiki/ — about the user, cross-project knowledge
 * - Project: .kapy/wiki/ — codebase-specific knowledge
 */

/** Which scope the grimoire operates on */
export type GrimoireScope = "global" | "project";

/** Metadata for a wiki page */
export interface PageMeta {
	/** Relative path within the wiki (e.g., "profile/preferences.md") */
	path: string;
	/** One-line summary (extracted from first heading or frontmatter) */
	summary?: string;
	/** Category inferred from directory (profile, projects, concepts, sources, etc.) */
	category?: string;
	/** Tags from frontmatter */
	tags?: string[];
	/** Last modified timestamp */
	updatedAt: number;
	/** Created timestamp */
	createdAt?: number;
	/** Size in bytes */
	size: number;
}

/** Search result from grimoire query */
export interface SearchResult {
	/** Relative path within the wiki */
	path: string;
	/** Relevance score 0-1 */
	score: number;
	/** Matched snippet or summary */
	snippet: string;
	/** Which fields matched */
	matchedFields: ("title" | "content" | "tags" | "path")[];
}

/** Lint result — issues found in the grimoire */
export interface LintResult {
	/** Issue type */
	type: "orphan" | "stale" | "broken_link" | "missing_crossref" | "empty_page" | "missing_page";
	/** Page with the issue */
	path: string;
	/** Human-readable description */
	message: string;
	/** Suggested fix */
	suggestion?: string;
	/** Severity */
	severity: "info" | "warn" | "error";
}

/** Log entry appended to grimoire log.md */
export interface LogEntry {
	/** ISO timestamp */
	timestamp: string;
	/** Type of event */
	type: "session" | "ingest" | "query" | "lint" | "manual";
	/** One-line summary */
	summary: string;
	/** Pages created or updated */
	pagesUpdated?: string[];
	/** Pages read */
	pagesRead?: string[];
}

/** Result of ingesting a source into the grimoire */
export interface IngestResult {
	/** Pages created or updated */
	pagesUpdated: string[];
	/** Summary of what was ingested */
	summary: string;
}

/** Grimoire statistics */
export interface GrimoireStats {
	/** Total pages */
	totalPages: number;
	/** Total size in bytes */
	totalSize: number;
	/** Pages by category */
	byCategory: Record<string, number>;
	/** Last log entry timestamp */
	lastActivity?: string;
	/** Number of log entries */
	logEntries: number;
}