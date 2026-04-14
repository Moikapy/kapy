/**
 * Memory store — key-value persistence for project and global knowledge.
 *
 * Two scopes:
 * - Project: stored in .kapy/memory.json (gitignored)
 * - Global: stored in ~/.kapy/memory.json
 *
 * Simple CRUD + search. No vector embeddings (MVP).
 * Future: integrate with pi's learning system for semantic search.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";

export type MemoryScope = "project" | "global";

export interface MemoryEntry {
	key: string;
	value: string;
	scope: MemoryScope;
	updatedAt: number;
}

export class MemoryStore {
	private projectDir: string;
	private globalDir: string;
	private projectData = new Map<string, MemoryEntry>();
	private globalData = new Map<string, MemoryEntry>();

	constructor(options?: { projectDir?: string; globalDir?: string }) {
		this.projectDir = options?.projectDir ?? join(process.cwd(), ".kapy");
		this.globalDir = options?.globalDir ?? join(process.env.HOME ?? "~", ".kapy");
	}

	/** Get a value by key */
	get(key: string, scope: MemoryScope = "project"): string | undefined {
		const data = scope === "project" ? this.projectData : this.globalData;
		return data.get(key)?.value;
	}

	/** Set a value */
	set(key: string, value: string, scope: MemoryScope = "project"): void {
		const data = scope === "project" ? this.projectData : this.globalData;
		data.set(key, { key, value, scope, updatedAt: Date.now() });
	}

	/** Delete a key */
	delete(key: string, scope: MemoryScope = "project"): boolean {
		const data = scope === "project" ? this.projectData : this.globalData;
		return data.delete(key);
	}

	/** List all entries in a scope */
	list(scope: MemoryScope = "project"): MemoryEntry[] {
		const data = scope === "project" ? this.projectData : this.globalData;
		return [...data.values()];
	}

	/** List all entries from both scopes */
	listAll(): MemoryEntry[] {
		return [...this.list("project"), ...this.list("global")];
	}

	/** Simple search by key or value substring */
	search(query: string): MemoryEntry[] {
		const lower = query.toLowerCase();
		return this.listAll().filter(
			(entry) =>
				entry.key.toLowerCase().includes(lower) ||
				entry.value.toLowerCase().includes(lower),
		);
	}

	/** Get count of entries */
	get count(): { project: number; global: number } {
		return {
			project: this.projectData.size,
			global: this.globalData.size,
		};
	}

	/** Load from disk */
	load(): void {
		this.loadScope("project");
		this.loadScope("global");
	}

	/** Save to disk */
	save(): void {
		this.saveScope("project");
		this.saveScope("global");
	}

	private loadScope(scope: MemoryScope): void {
		const dir = scope === "project" ? this.projectDir : this.globalDir;
		const file = join(dir, "memory.json");

		if (!existsSync(file)) return;

		try {
			const content = readFileSync(file, "utf-8");
			const entries = JSON.parse(content) as MemoryEntry[];
			const data = scope === "project" ? this.projectData : this.globalData;
			data.clear();
			for (const entry of entries) {
				data.set(entry.key, { ...entry, scope });
			}
		} catch {
			// Corrupted file, skip
		}
	}

	private saveScope(scope: MemoryScope): void {
		const dir = scope === "project" ? this.projectDir : this.globalDir;
		const file = join(dir, "memory.json");

		const data = scope === "project" ? this.projectData : this.globalData;

		try {
			if (!existsSync(dir)) {
				mkdirSync(dir, { recursive: true });
			}
			const entries = [...data.values()];
			writeFileSync(file, JSON.stringify(entries, null, 2), "utf-8");
		} catch {
			// Can't write, skip
		}
	}
}