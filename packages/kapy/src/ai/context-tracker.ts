/**
 * Context Window Tracker — pi-compatible context usage estimation and compaction checks.
 *
 * Pi pattern: uses real token usage data from the last AssistantMessage when available,
 * falls back to heuristic estimation (chars/4) for trailing messages.
 * Compaction triggers when contextTokens > contextWindow - reserveTokens.
 */

import type { AgentMessage } from "@moikapy/kapy-agent";

export interface ContextMessage {
	role: string;
	content: string;
	timestamp?: number;
}

export interface ContextUsage {
	usedTokens: number;
	maxTokens: number;
	fraction: number;
	shouldCompact: boolean;
}

export const DEFAULT_COMPACTION_SETTINGS = {
	enabled: true,
	reserveTokens: 16384,
	keepRecentTokens: 20000,
	PRUNE_MINIMUM: 20000,
	PRUNE_PROTECTED: 40000,
};

function estimateTokens(text: string): number {
	return Math.max(1, Math.ceil(text.length / 4));
}

export function estimateContextTokens(messages: AgentMessage[]): number {
	let foundUsage = false;
	let totalFromUsage = 0;
	let heuristicTokens = 0;

	for (let i = messages.length - 1; i >= 0; i--) {
		const msg = messages[i];
		if (msg.role === "assistant" && !foundUsage) {
			const usage = (
				msg as {
					usage?: { totalTokens?: number; input?: number; output?: number; cacheRead?: number; cacheWrite?: number };
				}
			).usage;
			if (usage) {
				const u =
					usage.totalTokens ??
					(usage.input ?? 0) + (usage.output ?? 0) + (usage.cacheRead ?? 0) + (usage.cacheWrite ?? 0);
				if (u > 0) {
					totalFromUsage = u;
					foundUsage = true;
					break;
				}
			}
		}
	}

	if (foundUsage) {
		heuristicTokens = 0;
		for (let i = messages.length - 1; i >= 0; i--) {
			const msg = messages[i];
			if (msg.role === "assistant") {
				const usage = (
					msg as {
						usage?: { totalTokens?: number; input?: number; output?: number; cacheRead?: number; cacheWrite?: number };
					}
				).usage;
				if (usage) {
					const u =
						usage.totalTokens ??
						(usage.input ?? 0) + (usage.output ?? 0) + (usage.cacheRead ?? 0) + (usage.cacheWrite ?? 0);
					if (u > 0) break;
				}
			}
			const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
			heuristicTokens += estimateTokens(content) + 4;
		}
		return totalFromUsage + heuristicTokens;
	}

	for (const msg of messages) {
		const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
		heuristicTokens += estimateTokens(content) + 4;
	}
	return heuristicTokens;
}

export function shouldCompact(
	contextTokens: number,
	contextWindow: number,
	settings = DEFAULT_COMPACTION_SETTINGS,
): boolean {
	if (!settings.enabled) return false;
	const threshold = contextWindow - settings.reserveTokens;
	if (threshold <= 0) return false;
	return contextTokens > threshold;
}

export class ContextTracker {
	private reserveTokens: number;
	private keepRecentTokens: number;
	private enabled: boolean;

	constructor(options?: {
		enabled?: boolean;
		reserveTokens?: number;
		keepRecentTokens?: number;
	}) {
		this.enabled = options?.enabled ?? DEFAULT_COMPACTION_SETTINGS.enabled;
		this.reserveTokens = options?.reserveTokens ?? DEFAULT_COMPACTION_SETTINGS.reserveTokens;
		this.keepRecentTokens = options?.keepRecentTokens ?? DEFAULT_COMPACTION_SETTINGS.keepRecentTokens;
	}

	getUsage(messages: ContextMessage[], maxContextTokens: number): ContextUsage {
		let usedTokens = 0;
		for (const msg of messages) {
			usedTokens += estimateTokens(msg.content) + 4;
		}
		const fraction = maxContextTokens > 0 ? usedTokens / maxContextTokens : 0;
		return {
			usedTokens,
			maxTokens: maxContextTokens,
			fraction,
			shouldCompact: this.shouldCompactFromTokens(usedTokens, maxContextTokens),
		};
	}

	getUsageFromAgent(messages: AgentMessage[], contextWindow: number): ContextUsage {
		const usedTokens = estimateContextTokens(messages);
		const fraction = contextWindow > 0 ? usedTokens / contextWindow : 0;
		return {
			usedTokens,
			maxTokens: contextWindow,
			fraction,
			shouldCompact: this.shouldCompactFromTokens(usedTokens, contextWindow),
		};
	}

	shouldCompactFromTokens(usedTokens: number, contextWindow: number): boolean {
		if (!this.enabled) return false;
		const threshold = contextWindow - this.reserveTokens;
		if (threshold <= 0) return false; // reserve exceeds window — disable compaction
		return usedTokens > threshold;
	}

	findCutPoint(messages: AgentMessage[]): { cutIndex: number; tokensKept: number } {
		let acc = 0;
		for (let i = messages.length - 1; i >= 0; i--) {
			const msg = messages[i];
			const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
			acc += estimateTokens(content) + 4;
			if (acc >= this.keepRecentTokens) {
				let cutIndex = i;
				while (cutIndex > 0 && messages[cutIndex].role === "toolResult") {
					cutIndex--;
				}
				return { cutIndex, tokensKept: acc };
			}
		}
		return { cutIndex: 0, tokensKept: acc };
	}

	pruneToolOutputs(messages: AgentMessage[]): AgentMessage[] {
		const MINIMUM = DEFAULT_COMPACTION_SETTINGS.PRUNE_MINIMUM;
		const PROTECTED = DEFAULT_COMPACTION_SETTINGS.PRUNE_PROTECTED;

		let prunedTokens = 0;
		let protectedTokens = 0;

		for (let i = messages.length - 1; i >= 0; i--) {
			const msg = messages[i];
			if (msg.role !== "toolResult") continue;
			const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
			const tokens = estimateTokens(content);
			if (protectedTokens < PROTECTED) {
				protectedTokens += tokens;
			} else {
				prunedTokens += tokens;
			}
		}

		if (prunedTokens < MINIMUM) return messages;

		protectedTokens = 0;
		const result = messages.map((msg) => {
			if (msg.role !== "toolResult") return msg;
			const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
			const tokens = estimateTokens(content);
			if (protectedTokens < PROTECTED) {
				protectedTokens += tokens;
				return msg;
			}
			return { ...msg, content: "[Output pruned for context space]" } as unknown as AgentMessage;
		});
		return result;
	}

	setSettings(options: { enabled?: boolean; reserveTokens?: number; keepRecentTokens?: number }): void {
		if (options.enabled !== undefined) this.enabled = options.enabled;
		if (options.reserveTokens !== undefined) this.reserveTokens = options.reserveTokens;
		if (options.keepRecentTokens !== undefined) this.keepRecentTokens = options.keepRecentTokens;
	}

	compact(messages: ContextMessage[], targetFraction: number = 0.4): ContextMessage[] {
		if (messages.length <= 2) return messages;
		const systemMessages = messages.filter((m) => m.role === "system");
		const nonSystem = messages.filter((m) => m.role !== "system");
		const keepCount = Math.max(2, Math.ceil(nonSystem.length * targetFraction));
		const kept = nonSystem.slice(-keepCount);
		const removed = nonSystem.slice(0, nonSystem.length - keepCount);
		if (removed.length === 0) return messages;
		const summary: ContextMessage = {
			role: "system",
			content:
				`[Context compacted. ${removed.length} earlier messages summarized.]\n` +
				`Summary of removed messages:\n` +
				removed.map((m) => `- ${m.role}: ${m.content.slice(0, 100)}${m.content.length > 100 ? "..." : ""}`).join("\n"),
			timestamp: Date.now(),
		};
		return [...systemMessages, summary, ...kept];
	}

	shouldCompact(messages: ContextMessage[], maxContextTokens: number): boolean {
		const usage = this.getUsage(messages, maxContextTokens);
		return usage.shouldCompact;
	}

	setThresholds(_compact: number, _warn?: number): void {}
}
