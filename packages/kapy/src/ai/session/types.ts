/**
 * Session types — tree-structured JSONL entries.
 */

/** A single entry in the session tree */
export interface SessionEntry {
	/** Unique entry ID */
	id: string;
	/** Parent entry ID (null for root) */
	parentId: string | null;
	/** Message role */
	role: "user" | "assistant" | "tool" | "system" | "custom";
	/** Message content */
	content: string;
	/** Timestamp */
	timestamp: number;
	/** Tool calls (for assistant messages) */
	toolCalls?: unknown[];
	/** Custom type (for extension entries) */
	customType?: string;
	/** Display flag */
	display?: boolean;
	/** Additional metadata */
	metadata?: Record<string, unknown>;
}

/** Options for appending a message */
export interface AppendMessageOptions {
	role: SessionEntry["role"];
	content: string;
	parentId?: string | null;
	toolCalls?: unknown[];
	customType?: string;
	display?: boolean;
	metadata?: Record<string, unknown>;
}
