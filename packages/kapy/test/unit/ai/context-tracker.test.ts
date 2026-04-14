/**
 * Tests for ContextTracker — token estimation, usage tracking, compaction.
 */

import { describe, test, expect } from "bun:test";
import { ContextTracker, type ContextUsage } from "../../../src/ai/context-tracker.js";
import type { AgentMessage } from "../../../src/ai/agent/types.js";

describe("ContextTracker", () => {
	test("empty messages → 0 tokens", () => {
		const tracker = new ContextTracker();
		const usage = tracker.getUsage([], 8192);
		expect(usage.usedTokens).toBe(0);
		expect(usage.fraction).toBe(0);
		expect(usage.shouldCompact).toBe(false);
	});

	test("estimates tokens from message content", () => {
		const tracker = new ContextTracker();
		const messages: AgentMessage[] = [
			{ role: "user", content: "Hello world!", timestamp: Date.now() },
		];
		const usage = tracker.getUsage(messages, 8192);
		expect(usage.usedTokens).toBeGreaterThan(0);
		expect(usage.usedTokens).toBeLessThan(100);
	});

	test("fraction increases with more messages", () => {
		const tracker = new ContextTracker();
		const short: AgentMessage[] = [
			{ role: "user", content: "Hi", timestamp: Date.now() },
		];
		const long: AgentMessage[] = [
			{ role: "user", content: "Hi", timestamp: Date.now() },
			{ role: "assistant", content: "A".repeat(1000), timestamp: Date.now() },
		];
		const shortUsage = tracker.getUsage(short, 8192);
		const longUsage = tracker.getUsage(long, 8192);
		expect(longUsage.fraction).toBeGreaterThan(shortUsage.fraction);
	});

	test("shouldCompact triggers at threshold", () => {
		const tracker = new ContextTracker({ compactThreshold: 0.8 });
		// Fill up past 80%
		const messages: AgentMessage[] = Array.from({ length: 100 }, (_, i) => ({
			role: "user" as const,
			content: "A".repeat(300),
			timestamp: Date.now() + i,
		}));
		const usage = tracker.getUsage(messages, 8192);
		expect(usage.shouldCompact).toBe(true);
	});

	test("shouldCompact not triggered under threshold", () => {
		const tracker = new ContextTracker({ compactThreshold: 0.8 });
		const messages: AgentMessage[] = [
			{ role: "user", content: "Short", timestamp: Date.now() },
		];
		const usage = tracker.getUsage(messages, 8192);
		expect(usage.shouldCompact).toBe(false);
	});

	test("compact preserves recent messages", () => {
		const tracker = new ContextTracker();
		const messages: AgentMessage[] = Array.from({ length: 10 }, (_, i) => ({
			role: "user" as const,
			content: `Message ${i}`,
			timestamp: Date.now() + i,
		}));
		const compacted = tracker.compact(messages);
		// Should keep some messages
		expect(compacted.length).toBeLessThan(messages.length);
		expect(compacted.length).toBeGreaterThan(0);
		// Should contain a compaction summary
		const hasSummary = compacted.some((m) => m.content.includes("compacted"));
		expect(hasSummary).toBe(true);
	});

	test("compact preserves system messages", () => {
		const tracker = new ContextTracker();
		const messages: AgentMessage[] = [
			{ role: "system", content: "You are a helpful assistant.", timestamp: Date.now() },
			{ role: "user", content: "Hello", timestamp: Date.now() },
			{ role: "assistant", content: "Hi there!", timestamp: Date.now() },
			{ role: "user", content: "How are you?", timestamp: Date.now() },
		];
		const compacted = tracker.compact(messages);
		const hasSystem = compacted.some((m) => m.role === "system" && m.content.includes("helpful assistant"));
		expect(hasSystem).toBe(true);
	});

	test("compact on 2 or fewer messages returns as-is", () => {
		const tracker = new ContextTracker();
		const messages: AgentMessage[] = [
			{ role: "user", content: "Hello", timestamp: Date.now() },
		];
		const compacted = tracker.compact(messages);
		expect(compacted).toEqual(messages);
	});

	test("shouldCompact delegates to getUsage", () => {
		const tracker = new ContextTracker({ compactThreshold: 0.5 });
		const messages: AgentMessage[] = Array.from({ length: 100 }, (_, i) => ({
			role: "user" as const,
			content: "X".repeat(200),
			timestamp: Date.now() + i,
		}));
		expect(tracker.shouldCompact(messages, 8192)).toBe(true);
		expect(tracker.shouldCompact(messages.slice(0, 2), 8192)).toBe(false);
	});

	test("custom thresholds", () => {
		const tracker = new ContextTracker({ compactThreshold: 0.5, warnThreshold: 0.3 });
		const messages: AgentMessage[] = Array.from({ length: 100 }, (_, i) => ({
			role: "user" as const,
			content: "X".repeat(200),
			timestamp: Date.now() + i,
		}));
		const usage = tracker.getUsage(messages, 8192);
		// Should be past 50% threshold
		expect(usage.shouldCompact).toBe(true);
	});

	test("setThresholds updates thresholds", () => {
		const tracker = new ContextTracker({ compactThreshold: 0.8 });
		tracker.setThresholds(0.5);
		const messages: AgentMessage[] = Array.from({ length: 100 }, (_, i) => ({
			role: "user" as const,
			content: "X".repeat(200),
			timestamp: Date.now() + i,
		}));
		// With lower threshold, should compact
		const usage = tracker.getUsage(messages, 8192);
		expect(usage.shouldCompact).toBe(true);
	});
});