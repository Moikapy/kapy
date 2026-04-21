/**
 * SessionManager — pi-compatible JSONL session persistence.
 *
 * Sessions are stored as append-only JSONL files in ~/.kapy/sessions/<encoded-cwd>/.
 * Each line is a JSON object. Line 1 is always a SessionHeader, subsequent lines
 * are SessionEntry objects forming a tree via id/parentId links.
 *
 * Features:
 * - JSONL append-only files (no rewriting for normal operations)
 * - Tree-structured entries with branching support
 * - create/open/continueRecent/list/listAll static factories
 * - Full pi API compatibility for session sharing
 */

import { existsSync } from "node:fs";
import { mkdir, readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { FileEntry, NewSessionOptions, SessionEntry, SessionHeader, SessionInfo } from "./types.js";
import { CURRENT_SESSION_VERSION } from "./types.js";

// ── Helpers ──────────────────────────────────────────────────────────

/** Encode cwd into a safe directory name: /home/user/code → --home-user-code-- */
function encodeCwd(cwd: string): string {
	return `--${cwd.replace(/\//g, "--")}--`;
}

/** Generate 8-char hex ID */
function generateId(): string {
	return Math.random().toString(16).slice(2, 10);
}

/** Current timestamp as ISO string */
function nowISO(): string {
	return new Date().toISOString();
}

/** Compute default session directory for a cwd */
export function getDefaultSessionDir(cwd: string): string {
	return join(homedir(), ".kapy", "sessions", encodeCwd(cwd));
}

/** Parse JSONL content into FileEntry array */
export function parseSessionEntries(content: string): FileEntry[] {
	const entries: FileEntry[] = [];
	for (const line of content.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		try {
			entries.push(JSON.parse(trimmed));
		} catch {
			// Skip malformed lines
		}
	}
	return entries;
}

/** Find the most recent session file in a directory */
export function findMostRecentSession(sessionDir: string): string | null {
	if (!existsSync(sessionDir)) return null;
	// Synchronous check is intentional — we already checked existsSync
	const files = require("node:fs")
		.readdirSync(sessionDir)
		.filter((f: string) => f.endsWith(".jsonl"))
		.sort()
		.reverse();
	return files.length > 0 ? join(sessionDir, files[0]) : null;
}

// ── SessionManager ───────────────────────────────────────────────────

export class SessionManager {
	private sessionId: string;
	private sessionFile: string | undefined;
	private sessionDir: string;
	private cwd: string;
	private doPersist: boolean;
	private entries: SessionEntry[] = [];
	private byId = new Map<string, SessionEntry>();
	private leafId: string | null = null;
	private header: SessionHeader | null = null;

	private constructor(sessionFile: string | undefined, sessionDir: string, cwd: string, persist: boolean) {
		this.sessionFile = sessionFile;
		this.sessionDir = sessionDir;
		this.cwd = cwd;
		this.doPersist = persist;
		this.sessionId = "";
	}

	// ── Static factories ────────────────────────────────────────────

	/** Create a new session with a fresh JSONL file. */
	static create(cwd: string, sessionDir?: string): SessionManager {
		const dir = sessionDir ?? getDefaultSessionDir(cwd);
		mkdir(dir, { recursive: true });

		const id = crypto.randomUUID().slice(0, 8);
		const timestamp = nowISO().replace(/[:.]/g, "-");
		const fileName = `${timestamp}_${id}.jsonl`;
		const filePath = join(dir, fileName);

		const header: SessionHeader = {
			type: "session",
			version: CURRENT_SESSION_VERSION,
			id,
			timestamp: nowISO(),
			cwd,
		};

		writeFileSync(filePath, `${JSON.stringify(header)}\n`);

		const sm = new SessionManager(filePath, dir, cwd, true);
		sm.sessionId = id;
		sm.header = header;
		sm.sessionFile = filePath;
		return sm;
	}

	/** Open an existing session from a JSONL file. */
	static open(path: string, sessionDir?: string, cwdOverride?: string): SessionManager {
		const content = readFileSync(path);
		const fileEntries = parseSessionEntries(content);

		const header = fileEntries.find((e): e is SessionHeader => e.type === "session") ?? null;
		const entries = fileEntries.filter((e): e is SessionEntry => e.type !== "session");

		const cwd = cwdOverride ?? header?.cwd ?? process.cwd();
		const dir = sessionDir ?? getDefaultSessionDir(cwd);

		const sm = new SessionManager(path, dir, cwd, true);
		sm.sessionFile = path;
		sm.sessionId = header?.id ?? "";
		sm.header = header;
		sm.entries = entries;
		sm.byId = new Map(entries.map((e) => [e.id, e]));

		// Find the last entry as leaf (deepest in the tree)
		sm.leafId = entries.length > 0 ? entries[entries.length - 1].id : null;

		return sm;
	}

	/** Continue the most recent session, or create a new one if none exist. */
	static continueRecent(cwd: string, sessionDir?: string): SessionManager {
		const dir = sessionDir ?? getDefaultSessionDir(cwd);
		const recent = findMostRecentSession(dir);
		if (recent) {
			return SessionManager.open(recent, dir, cwd);
		}
		return SessionManager.create(cwd, dir);
	}

	/** Create an in-memory session (no file persistence). */
	static inMemory(cwd?: string): SessionManager {
		const sm = new SessionManager(undefined, "", cwd ?? process.cwd(), false);
		sm.sessionId = generateId();
		sm.header = {
			type: "session",
			version: CURRENT_SESSION_VERSION,
			id: sm.sessionId,
			timestamp: nowISO(),
			cwd: cwd ?? process.cwd(),
		};
		return sm;
	}

	/** List all sessions for a cwd directory. */
	static async list(cwd: string, sessionDir?: string): Promise<SessionInfo[]> {
		const dir = sessionDir ?? getDefaultSessionDir(cwd);
		if (!existsSync(dir)) return [];

		const files = (await readdir(dir))
			.filter((f) => f.endsWith(".jsonl"))
			.sort()
			.reverse();
		const sessions: SessionInfo[] = [];

		for (const file of files) {
			const filePath = join(dir, file);
			try {
				const info = await SessionManager.getSessionInfo(filePath);
				if (info) sessions.push(info);
			} catch {
				// Skip malformed session files
			}
		}
		return sessions;
	}

	/** List all sessions across all project directories. */
	static async listAll(): Promise<SessionInfo[]> {
		const sessionsDir = join(homedir(), ".kapy", "sessions");
		if (!existsSync(sessionsDir)) return [];

		const dirs = await readdir(sessionsDir);
		const allSessions: SessionInfo[] = [];

		for (const dir of dirs) {
			const fullDir = join(sessionsDir, dir);
			const dirStat = await stat(fullDir);
			if (!dirStat.isDirectory()) continue;

			const files = (await readdir(fullDir)).filter((f) => f.endsWith(".jsonl"));
			for (const file of files) {
				const filePath = join(fullDir, file);
				try {
					const info = await SessionManager.getSessionInfo(filePath);
					if (info) allSessions.push(info);
				} catch {
					// Skip
				}
			}
		}

		// Sort by modification time, newest first
		allSessions.sort((a, b) => b.modified.getTime() - a.modified.getTime());
		return allSessions;
	}

	/** Extract session info from a file path. */
	private static async getSessionInfo(filePath: string): Promise<SessionInfo | null> {
		const content = readFileSync(filePath);
		const entries = parseSessionEntries(content);
		const header = entries.find((e): e is SessionHeader => e.type === "session");
		if (!header) return null;

		const messageEntries = entries.filter((e): e is SessionEntry => e.type === "message" && e.role === "user");
		const firstMessage = messageEntries[0];
		const allMessages = entries.filter((e): e is SessionEntry => e.type === "message");

		// Find session name from session_info entries
		const nameEntry = entries.filter((e): e is SessionEntry => e.type === "session_info").reverse()[0];

		const fileStat = await stat(filePath);

		return {
			path: filePath,
			id: header.id,
			cwd: header.cwd,
			name: nameEntry?.name,
			created: new Date(header.timestamp),
			modified: fileStat.mtime,
			messageCount: allMessages.length,
			firstMessage: firstMessage?.content?.slice(0, 100) ?? "(empty)",
		};
	}

	// ── Getters ──────────────────────────────────────────────────────

	getSessionId(): string {
		return this.sessionId;
	}

	getSessionFile(): string | undefined {
		return this.sessionFile;
	}

	getSessionDir(): string {
		return this.sessionDir;
	}

	getCwd(): string {
		return this.cwd;
	}

	isPersisted(): boolean {
		return this.doPersist && !!this.sessionFile;
	}

	getHeader(): SessionHeader | null {
		return this.header;
	}

	getLeafId(): string | null {
		return this.leafId;
	}

	getLeafEntry(): SessionEntry | undefined {
		return this.leafId ? this.byId.get(this.leafId) : undefined;
	}

	getEntry(id: string): SessionEntry | undefined {
		return this.byId.get(id);
	}

	/** Get all entries (shallow copy). */
	getEntries(): SessionEntry[] {
		return [...this.entries];
	}

	/** Get the branch from root to a given entry (or current leaf). */
	getBranch(fromId?: string): SessionEntry[] {
		const startId = fromId ?? this.leafId;
		if (!startId) return [];

		const branch: SessionEntry[] = [];
		let current: string | null = startId;
		while (current) {
			const entry = this.byId.get(current);
			if (!entry) break;
			branch.unshift(entry);
			current = entry.parentId;
		}
		return branch;
	}

	/** Walk from entry to root, returning all entries in path order. */
	getChildren(parentId: string): SessionEntry[] {
		return this.entries.filter((e) => e.parentId === parentId);
	}

	// ── Append methods ──────────────────────────────────────────────

	/** Append a message entry. */
	appendMessage(options: {
		role: string;
		content: string;
		toolCalls?: unknown[];
		display?: boolean;
		metadata?: Record<string, unknown>;
	}): string {
		const entry: SessionEntry = {
			type: "message",
			id: generateId(),
			parentId: this.leafId,
			timestamp: nowISO(),
			role: options.role as SessionEntry["role"],
			content: options.content,
			toolCalls: options.toolCalls,
			display: options.display,
			metadata: options.metadata,
		};
		this._appendEntry(entry);
		return entry.id;
	}

	/** Append a model change entry. */
	appendModelChange(provider: string, modelId: string): string {
		const entry: SessionEntry = {
			type: "model_change",
			id: generateId(),
			parentId: this.leafId,
			timestamp: nowISO(),
			provider,
			modelId,
		};
		this._appendEntry(entry);
		return entry.id;
	}

	/** Append a compaction entry. */
	appendCompaction(summary: string, firstKeptEntryId: string, tokensBefore: number, details?: unknown): string {
		const entry: SessionEntry = {
			type: "compaction",
			id: generateId(),
			parentId: this.leafId,
			timestamp: nowISO(),
			summary,
			firstKeptEntryId,
			tokensBefore,
			data: details,
		};
		this._appendEntry(entry);
		return entry.id;
	}

	/** Append a custom entry (for extensions). */
	appendCustomEntry(customType: string, data?: unknown): string {
		const entry: SessionEntry = {
			type: "custom",
			id: generateId(),
			parentId: this.leafId,
			timestamp: nowISO(),
			customType,
			data,
		};
		this._appendEntry(entry);
		return entry.id;
	}

	/** Append a session_info entry (display name). */
	appendSessionInfo(name: string): string {
		const entry: SessionEntry = {
			type: "session_info",
			id: generateId(),
			parentId: this.leafId,
			timestamp: nowISO(),
			name,
		};
		this._appendEntry(entry);
		return entry.id;
	}

	/** Append a label entry. */
	appendLabel(targetId: string, label: string | undefined): string {
		const entry: SessionEntry = {
			type: "label",
			id: generateId(),
			parentId: this.leafId,
			timestamp: nowISO(),
			targetId,
			label,
		};
		this._appendEntry(entry);
		return entry.id;
	}

	/** Get the current session name from the latest session_info entry, if any. */
	getSessionName(): string | undefined {
		for (let i = this.entries.length - 1; i >= 0; i--) {
			if (this.entries[i].type === "session_info") {
				return this.entries[i].name;
			}
		}
		return undefined;
	}

	// ── Branching ────────────────────────────────────────────────────

	/** Branch from an earlier entry — moves leaf pointer without modifying history. */
	branch(branchFromId: string): void {
		const entry = this.byId.get(branchFromId);
		if (!entry) throw new Error(`Cannot branch from unknown entry: ${branchFromId}`);
		this.leafId = branchFromId;
	}

	/** Start a new branch with a summary of the abandoned path. */
	branchWithSummary(branchFromId: string | null, summary: string, details?: unknown): string {
		const targetId = branchFromId ?? this.leafId;
		if (targetId) {
			this.leafId = targetId;
		}
		const entryId = this.appendCompaction(summary, targetId ?? "", 0, details);
		return entryId;
	}

	/** Reset leaf to null (next append creates a new root). */
	resetLeaf(): void {
		this.leafId = null;
	}

	// ── Persistence ──────────────────────────────────────────────────

	/** Persist an entry to the JSONL file. */
	_persist(entry: SessionEntry): void {
		if (!this.doPersist || !this.sessionFile) {
			return;
		}
		appendFileSync(this.sessionFile, `${JSON.stringify(entry)}\n`);
	}

	/** Internal: append entry to in-memory store and persist. */
	private _appendEntry(entry: SessionEntry): void {
		this.entries.push(entry);
		this.byId.set(entry.id, entry);
		this.leafId = entry.id;
		this._persist(entry);
	}

	/** Rewrite the entire session file (for compaction). */
	private _rewriteFile(): void {
		if (!this.doPersist || !this.sessionFile || !this.header) return;
		const lines = [JSON.stringify(this.header), ...this.entries.map((e) => JSON.stringify(e))];
		writeFileSync(this.sessionFile, `${lines.join("\n")}\n`);
	}

	/** Switch to a different session file (for resume/branch). */
	setSessionFile(sessionFile: string): void {
		this.sessionFile = sessionFile;
	}

	/** Start a new session within the same manager. */
	newSession(options?: NewSessionOptions): string | undefined {
		const id = options?.id ?? crypto.randomUUID().slice(0, 8);
		this.sessionId = id;

		const header: SessionHeader = {
			type: "session",
			version: CURRENT_SESSION_VERSION,
			id,
			timestamp: nowISO(),
			cwd: this.cwd,
			parentSession: options?.parentSession,
		};
		this.header = header;
		this.entries = [];
		this.byId.clear();
		this.leafId = null;

		if (this.doPersist && this.sessionFile) {
			writeFileSync(this.sessionFile, `${JSON.stringify(header)}\n`);
		}

		return this.sessionFile;
	}

	/** Count entries by role. */
	countByRole(): Record<string, number> {
		const counts: Record<string, number> = {};
		for (const entry of this.entries) {
			if (entry.type === "message" && entry.role) {
				counts[entry.role] = (counts[entry.role] ?? 0) + 1;
			}
		}
		return counts;
	}

	/** Number of entries. */
	get entryCount(): number {
		return this.entries.length;
	}
}

// ── Synchronous file helpers (for static factories) ───────────────────

function writeFileSync(path: string, content: string): void {
	const { writeFileSync: ws } = require("node:fs");
	ws(path, content, "utf-8");
}

function readFileSync(path: string): string {
	const { readFileSync: rs } = require("node:fs");
	return rs(path, "utf-8");
}

function appendFileSync(path: string, content: string): void {
	const { appendFileSync: ap } = require("node:fs");
	ap(path, content, "utf-8");
}
