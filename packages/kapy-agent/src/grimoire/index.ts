/**
 * Grimoire — the agent's persistent knowledge base.
 *
 * A compounding wiki that grows with every session.
 * The agent writes it, the user curates it.
 * Future sessions start with accumulated knowledge instead of a blank slate.
 */

export { extractQuery, searchIndex, searchPages } from "./search.js";
export type { GrimoireStoreOptions } from "./store.js";
export { GrimoireStore } from "./store.js";
export type {
	GrimoireScope,
	GrimoireStats,
	IngestResult,
	LintResult,
	LogEntry,
	PageMeta,
	SearchResult,
} from "./types.js";
