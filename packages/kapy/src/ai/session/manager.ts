import type { AppendMessageOptions, SessionEntry } from "./types.js";

/**
 * Session manager — tree-structured message history.
 *
 * Entries link via parentId, forming a tree (pi pattern).
 * Supports branching, forking, and traversal.
 */
export class SessionManager {
	private entries = new Map<string, SessionEntry>();
	private leafId: string | null = null;
	private sessionFile: string | null;

	constructor(options?: { sessionFile?: string }) {
		this.sessionFile = options?.sessionFile ?? null;
	}

	/** Append a message, returning its ID */
	appendMessage(options: AppendMessageOptions | (AppendMessageOptions & { parentId?: string | null })): string {
		const parentId = (options as any).parentId ?? this.leafId;
		const id = crypto.randomUUID();
		const entry: SessionEntry = {
			id,
			parentId: parentId ?? null,
			role: options.role,
			content: options.content,
			timestamp: Date.now(),
			toolCalls: options.toolCalls,
			customType: options.customType,
			display: options.display,
			metadata: options.metadata,
		};
		this.entries.set(id, entry);
		this.leafId = id;
		return id;
	}

	/** Get an entry by ID */
	getEntry(id: string): SessionEntry | undefined {
		return this.entries.get(id);
	}

	/** Get all entries (insertion order) */
	getEntries(): SessionEntry[] {
		return [...this.entries.values()];
	}

	/** Get current leaf ID */
	getLeafId(): string | null {
		return this.leafId;
	}

	/** Get the branch from root to current leaf */
	getBranch(): SessionEntry[] {
		if (!this.leafId) return [];
		const branch: SessionEntry[] = [];
		let current: string | null = this.leafId;
		while (current) {
			const entry = this.entries.get(current);
			if (!entry) break;
			branch.unshift(entry);
			current = entry.parentId;
		}
		return branch;
	}

	/** Fork from a specific entry, creating a new branch point */
	forkFrom(entryId: string): string {
		const entry = this.entries.get(entryId);
		if (!entry) throw new Error(`Cannot fork from unknown entry: ${entryId}`);
		// Fork point is just entryId — next appendMessage with parentId=entryId
		// creates a sibling branch
		this.leafId = entryId;
		return entryId;
	}

	/** Clear all entries */
	clear(): void {
		this.entries.clear();
		this.leafId = null;
	}

	/** Get session file path */
	getSessionFile(): string | null {
		return this.sessionFile;
	}

	/** Count entries by role */
	countByRole(): Record<string, number> {
		const counts: Record<string, number> = {};
		for (const entry of this.entries.values()) {
			counts[entry.role] = (counts[entry.role] ?? 0) + 1;
		}
		return counts;
	}

	/** Number of entries */
	get entryCount(): number {
		return this.entries.size;
	}
}
