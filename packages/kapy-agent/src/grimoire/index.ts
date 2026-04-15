/**
 * Grimoire — the agent's persistent knowledge base.
 *
 * A compounding wiki that grows with every session.
 * The agent writes it, the user curates it.
 * Future sessions start with accumulated knowledge instead of a blank slate.
 */

export type { GrimoireScope, LogEntry, IngestResult, LintResult, PageMeta, SearchResult, GrimoireStats } from "./types.js";
export { GrimoireStore } from "./store.js";
export type { GrimoireStoreOptions } from "./store.js";
export { extractQuery, searchPages, searchIndex } from "./search.js";