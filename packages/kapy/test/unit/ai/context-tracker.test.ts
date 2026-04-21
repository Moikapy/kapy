/**
 * Tests for ContextTracker — token estimation, usage tracking, compaction.
 */

import { describe, expect, test } from "bun:test";
import type { AgentMessage } from "@moikapy/kapy-agent";
import type { ContextMessage } from "../../../src/ai/context-tracker.js";
import {
	ContextTracker,
	DEFAULT_COMPACTION_SETTINGS,
	estimateContextTokens,
	shouldCompact,
} from "../../../src/ai/context-tracker.js";

describe("ContextTracker", () => {
	test("empty messages → 0 tokens", () => {
		const tracker = new ContextTracker();
		// Use context window larger than default reserve (16384)
		const usage = tracker.getUsage([], 128_000);
		expect(usage.usedTokens).toBe(0);
		expect(usage.fraction).toBe(0);
		expect(usage.shouldCompact).toBe(false);
	});

	test("estimates tokens from message content", () => {
		const tracker = new ContextTracker();
		const messages: ContextMessage[] = [{ role: "user", content: "Hello world!", timestamp: Date.now() }];
		const usage = tracker.getUsage(messages, 8192);
		expect(usage.usedTokens).toBeGreaterThan(0);
		expect(usage.usedTokens).toBeLessThan(100);
	});

	test("fraction increases with more messages", () => {
		const tracker = new ContextTracker();
		const short: ContextMessage[] = [{ role: "user", content: "Hi", timestamp: Date.now() }];
		const long: ContextMessage[] = [
			{ role: "user", content: "Hi", timestamp: Date.now() },
			{ role: "assistant", content: "A".repeat(1000), timestamp: Date.now() },
		];
		const shortUsage = tracker.getUsage(short, 8192);
		const longUsage = tracker.getUsage(long, 8192);
		expect(longUsage.fraction).toBeGreaterThan(shortUsage.fraction);
	});

	test("shouldCompact triggers when context exceeds window minus reserve", () => {
		const tracker = new ContextTracker({ reserveTokens: 1000 });
		// 100 msgs × (300 chars / 4 + 4 role overhead) = ~8800 tokens
		// 8192 - 1000 = 7192 threshold → 8800 > 7192 → should compact
		const messages: ContextMessage[] = Array.from({ length: 100 }, (_, i) => ({
			role: "user" as const,
			content: "A".repeat(300),
			timestamp: Date.now() + i,
		}));
		const usage = tracker.getUsage(messages, 8192);
		expect(usage.shouldCompact).toBe(true);
	});

	test("shouldCompact not triggered under threshold", () => {
		const tracker = new ContextTracker();
		const messages: ContextMessage[] = [{ role: "user", content: "Short", timestamp: Date.now() }];
		// Default reserve 16384, window 128000 → threshold 111616
		// Short message is ~7 tokens, way under
		const usage = tracker.getUsage(messages, 128_000);
		expect(usage.shouldCompact).toBe(false);
	});

	test("compact preserves recent messages", () => {
		const tracker = new ContextTracker();
		const messages: ContextMessage[] = Array.from({ length: 10 }, (_, i) => ({
			role: "user" as const,
			content: `Message ${i}`,
			timestamp: Date.now() + i,
		}));
		const compacted = tracker.compact(messages);
		expect(compacted.length).toBeLessThan(messages.length);
		expect(compacted.length).toBeGreaterThan(0);
		const hasSummary = compacted.some((m) => m.content.includes("compacted"));
		expect(hasSummary).toBe(true);
	});

	test("compact preserves system messages", () => {
		const tracker = new ContextTracker();
		const messages: ContextMessage[] = [
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
		const messages: ContextMessage[] = [{ role: "user", content: "Hello", timestamp: Date.now() }];
		const compacted = tracker.compact(messages);
		expect(compacted).toEqual(messages);
	});

	test("shouldCompact delegates to getUsage", () => {
		const tracker = new ContextTracker({ reserveTokens: 1000 });
		// Need enough messages to exceed 8192 - 1000 = 7192 threshold
		// Each msg: 200/4 + 4 = 54 tokens. Need > 133 msgs
		const messages: ContextMessage[] = Array.from({ length: 150 }, (_, i) => ({
			role: "user" as const,
			content: "X".repeat(200),
			timestamp: Date.now() + i,
		}));
		expect(tracker.shouldCompact(messages, 8192)).toBe(true);
		expect(tracker.shouldCompact(messages.slice(0, 2), 8192)).toBe(false);
	});

	test("custom reserveTokens controls compaction threshold", () => {
		const smallReserve = new ContextTracker({ reserveTokens: 1000 });
		const largeReserve = new ContextTracker({ reserveTokens: 16000 });
		// 150 msgs × ~54 tokens each ≈ 8100 tokens
		const messages: ContextMessage[] = Array.from({ length: 150 }, (_, i) => ({
			role: "user" as const,
			content: "X".repeat(200),
			timestamp: Date.now() + i,
		}));
		// 8K window with 1K reserve: 8100 > 7192 → compact
		const usageSmall = smallReserve.getUsage(messages, 8192);
		// 128K window with 16K reserve: 8100 < 111616 → no compact
		const usageLarge = largeReserve.getUsage(messages, 128_000);
		expect(usageSmall.shouldCompact).toBe(true);
		expect(usageLarge.shouldCompact).toBe(false);
	});

	test("setSettings updates reserveTokens", () => {
		const tracker = new ContextTracker({ reserveTokens: 1000 });
		tracker.setSettings({ reserveTokens: 5000 });
		const messages: ContextMessage[] = Array.from({ length: 50 }, (_, i) => ({
			role: "user" as const,
			content: "X".repeat(200),
			timestamp: Date.now() + i,
		}));
		// 50 × (200/4 + 4) = 2700 tokens. 8192 - 5000 = 3192. 2700 < 3192 → no compact
		const usage = tracker.getUsage(messages, 8192);
		expect(usage.shouldCompact).toBe(false);
	});

	test("shouldCompact returns false when reserve exceeds window", () => {
		const tracker = new ContextTracker({ reserveTokens: 20000 });
		const messages: ContextMessage[] = [{ role: "user", content: "Test", timestamp: Date.now() }];
		// 8192 window, 20000 reserve → threshold negative → always false
		const usage = tracker.getUsage(messages, 8192);
		expect(usage.shouldCompact).toBe(false);
	});
});

describe("estimateContextTokens", () => {
	test("estimates tokens for simple messages", () => {
		const messages: AgentMessage[] = [{ role: "user", content: "Hello world", timestamp: Date.now() }];
		const tokens = estimateContextTokens(messages);
		expect(tokens).toBeGreaterThan(0);
	});

	test("uses real usage data when available", () => {
		const messages: AgentMessage[] = [
			{
				role: "assistant",
				content: "Response",
				timestamp: Date.now(),
				usage: { input: 100, output: 50, cacheRead: 0, cacheWrite: 0 },
				stopReason: "stop",
			} as any,
		];
		const tokens = estimateContextTokens(messages);
		expect(tokens).toBeGreaterThan(0);
	});
});

describe("shouldCompact (standalone function)", () => {
	test("returns true when over threshold", () => {
		// 120K tokens, 128K window, 16384 reserve → threshold 111616 → 120K > 111616
		expect(shouldCompact(120_000, 128_000)).toBe(true);
	});

	test("returns false when under threshold", () => {
		// 50K tokens, 128K window, 16384 reserve → threshold 111616 → 50K < 111616
		expect(shouldCompact(50_000, 128_000)).toBe(false);
	});

	test("respects disabled setting", () => {
		expect(shouldCompact(200_000, 128_000, { ...DEFAULT_COMPACTION_SETTINGS, enabled: false })).toBe(false);
	});

	test("returns false when reserve exceeds window", () => {
		expect(shouldCompact(100, 8192, { ...DEFAULT_COMPACTION_SETTINGS, reserveTokens: 20000 })).toBe(false);
	});
});
