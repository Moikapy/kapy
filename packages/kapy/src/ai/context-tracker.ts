/**
 * Context Window Tracker — tracks token usage and triggers compaction.
 *
 * Estimates token count from message history.
 * When approaching context limit, compacts by summarizing older messages.
 * Pi pattern: compaction only affects what's sent to LLM, full history stays in JSONL.
 */

import type { AgentMessage } from "./agent/types.js";

export interface ContextUsage {
	/** Estimated tokens used */
	usedTokens: number;
	/** Maximum context tokens for current model */
	maxTokens: number;
	/** Usage as fraction 0-1 */
	fraction: number;
	/** Whether compaction is recommended */
	shouldCompact: boolean;
}

/** Rough token estimation: ~4 chars per token for English, ~2 for code */
function estimateTokens(text: string): number {
	// Simple heuristic: chars / 4, with minimum
	return Math.max(1, Math.ceil(text.length / 4));
}

export class ContextTracker {
	private compactThreshold: number;
	private warnThreshold: number;

	constructor(options?: {
		/** Fraction at which to trigger compaction (default: 0.8) */
		compactThreshold?: number;
		/** Fraction at which to warn (default: 0.6) */
		warnThreshold?: number;
	}) {
		this.compactThreshold = options?.compactThreshold ?? 0.8;
		this.warnThreshold = options?.warnThreshold ?? 0.6;
	}

	/** Calculate context usage from messages and model max tokens */
	getUsage(messages: AgentMessage[], maxContextTokens: number): ContextUsage {
		let usedTokens = 0;
		for (const msg of messages) {
			usedTokens += estimateTokens(msg.content);
			// Role tokens overhead
			usedTokens += 4;
		}

		const fraction = maxContextTokens > 0 ? usedTokens / maxContextTokens : 0;

		return {
			usedTokens,
			maxTokens: maxContextTokens,
			fraction,
			shouldCompact: fraction >= this.compactThreshold,
		};
	}

	/** Compact messages by keeping recent ones and summarizing the rest */
	compact(messages: AgentMessage[], targetFraction: number = 0.4): AgentMessage[] {
		if (messages.length <= 2) return messages;

		// Keep system message (first if role=system) and last N messages
		const systemMessages = messages.filter((m) => m.role === "system");
		const nonSystem = messages.filter((m) => m.role !== "system");

		// Calculate how many messages to keep to reach target fraction
		// Rough: keep last 40% of non-system messages
		const keepCount = Math.max(2, Math.ceil(nonSystem.length * targetFraction));
		const kept = nonSystem.slice(-keepCount);

		// Create compaction summary for removed messages
		const removed = nonSystem.slice(0, nonSystem.length - keepCount);
		if (removed.length === 0) return messages;

		const summary: AgentMessage = {
			role: "system",
			content: `[Context compacted. ${removed.length} earlier messages summarized.]\n` +
				`Summary of removed messages:\n` +
				removed.map((m) => `- ${m.role}: ${m.content.slice(0, 100)}${m.content.length > 100 ? "..." : ""}`).join("\n"),
			timestamp: Date.now(),
		};

		return [...systemMessages, summary, ...kept];
	}

	/** Check if context usage exceeds compact threshold */
	shouldCompact(messages: AgentMessage[], maxContextTokens: number): boolean {
		const usage = this.getUsage(messages, maxContextTokens);
		return usage.shouldCompact;
	}

	/** Update thresholds */
	setThresholds(compact: number, warn?: number): void {
		this.compactThreshold = compact;
		if (warn !== undefined) this.warnThreshold = warn;
	}
}