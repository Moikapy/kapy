/**
 * Session types — pi-compatible JSONL entry format.
 *
 * Each session is a JSONL file where line 1 is a SessionHeader
 * and subsequent lines are SessionEntry objects forming a tree
 * via id/parentId links.
 *
 * Compatible with pi's session format for cross-tool session sharing.
 */

/** Current session file format version */
export const CURRENT_SESSION_VERSION = 1;

/** Session header entry (first line of JSONL file) */
export interface SessionHeader {
	type: "session";
	version?: number;
	id: string;
	timestamp: string;
	cwd: string;
	/** Path to parent session if this was forked */
	parentSession?: string;
}

/** A single entry in the session tree */
export interface SessionEntry {
	/** Unique entry ID (8-char hex) */
	id: string;
	/** Parent entry ID (null for root) */
	parentId: string | null;
	/** ISO timestamp */
	timestamp: string;
	/** Entry type discriminator */
	type: "message" | "model_change" | "compaction" | "custom" | "label" | "session_info";
	/** Message role (for type=message) */
	role?: "user" | "assistant" | "tool" | "system" | "custom";
	/** Message content (for type=message) */
	content?: string;
	/** Tool calls (for type=message, role=assistant) */
	toolCalls?: unknown[];
	/** Model change info (for type=model_change) */
	provider?: string;
	modelId?: string;
	/** Compaction info (for type=compaction) */
	summary?: string;
	firstKeptEntryId?: string;
	tokensBefore?: number;
	/** Custom type (for type=custom) */
	customType?: string;
	data?: unknown;
	/** Display flag */
	display?: boolean;
	/** Additional metadata */
	metadata?: Record<string, unknown>;
	/** Label text (for type=label) */
	label?: string;
	targetId?: string;
	/** Session name (for type=session_info) */
	name?: string;
}

/** Union type for file entries (header + entries) */
export type FileEntry = SessionHeader | SessionEntry;

/** Session metadata for listing */
export interface SessionInfo {
	/** Full path to session JSONL file */
	path: string;
	/** Session ID from header */
	id: string;
	/** Working directory where session was started */
	cwd: string;
	/** User-defined display name from session_info entries */
	name?: string;
	/** Session creation time */
	created: Date;
	/** Last modification time (file mtime) */
	modified: Date;
	/** Number of message entries */
	messageCount: number;
	/** First user message preview */
	firstMessage: string;
}

/** Options for creating a new session */
export interface NewSessionOptions {
	/** Custom session ID (auto-generated if omitted) */
	id?: string;
	/** Path to parent session if forking */
	parentSession?: string;
}

/** Options for appending a message */
export interface AppendMessageOptions {
	role: "user" | "assistant" | "tool" | "system" | "custom";
	content: string;
	parentId?: string | null;
	toolCalls?: unknown[];
	customType?: string;
	display?: boolean;
	metadata?: Record<string, unknown>;
}
