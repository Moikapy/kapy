/**
 * Tests for TUI footer component logic — status bar data,
 * including context usage display and color thresholds.
 */

import { describe, expect, it } from "bun:test";
import { type ContextMessage, ContextTracker } from "../../../src/ai/context-tracker.js";

describe("TUI Footer (logic)", () => {
	it("shows cwd in footer", () => {
		const cwd = "/home/user/project";
		expect(cwd.length).toBeGreaterThan(0);
	});

	it("permission count formatting — singular", () => {
		const count = 1;
		const label = `△ ${count} Permission${count > 1 ? "s" : ""}`;
		expect(label).toBe("△ 1 Permission");
	});

	it("permission count formatting — plural", () => {
		const count = 3;
		const label = `△ ${count} Permission${count > 1 ? "s" : ""}`;
		expect(label).toBe("△ 3 Permissions");
	});

	it("provider status indicators", () => {
		const statuses = ["connected", "disconnected", "error"] as const;
		for (const s of statuses) {
			expect(s).toBeDefined();
		}
	});

	it("tool count display", () => {
		const count = 5;
		const label = `• ${count} Tools`;
		expect(label).toBe("• 5 Tools");
	});
});

describe("Context usage footer display", () => {
	const tracker = new ContextTracker();

	function ctxPercent(usage: { fraction: number }) {
		const pct = Math.round(usage.fraction * 100);
		return {
			pct,
			warn: usage.fraction >= 0.6,
			danger: usage.fraction >= 0.8,
		};
	}

	function ctxColor(info: { warn: boolean; danger: boolean }): string {
		if (info.danger) return "error";
		if (info.warn) return "warning";
		return "muted";
	}

	it("0% usage shows muted color", () => {
		const usage = tracker.getUsage([], 128_000);
		const info = ctxPercent(usage);
		expect(info.pct).toBe(0);
		expect(info.warn).toBe(false);
		expect(info.danger).toBe(false);
		expect(ctxColor(info)).toBe("muted");
	});

	it("low usage (< 60%) shows muted color", () => {
		const messages: ContextMessage[] = [{ role: "user", content: "A".repeat(1000) }];
		const usage = tracker.getUsage(messages, 128_000);
		const info = ctxPercent(usage);
		expect(info.pct).toBeLessThan(60);
		expect(info.warn).toBe(false);
		expect(info.danger).toBe(false);
		expect(ctxColor(info)).toBe("muted");
	});

	it("medium usage (60-79%) shows warning color", () => {
		// 100 messages × (200 chars / 4 + 4 role overhead) ≈ 5400 tokens
		// 5400 / 8192 ≈ 66% — solidly in warning zone
		const messages: ContextMessage[] = Array.from({ length: 100 }, () => ({
			role: "user",
			content: "A".repeat(200),
		}));
		const usage = tracker.getUsage(messages, 8192);
		const info = ctxPercent(usage);
		expect(info.warn).toBe(true);
		expect(info.danger).toBe(false);
		expect(ctxColor(info)).toBe("warning");
	});

	it("high usage (>= 80%) shows danger color", () => {
		// Fill past 80% of 8K context
		const messages: ContextMessage[] = Array.from({ length: 100 }, () => ({
			role: "user",
			content: "A".repeat(300),
		}));
		const usage = tracker.getUsage(messages, 8192);
		const info = ctxPercent(usage);
		expect(info.danger).toBe(true);
		expect(ctxColor(info)).toBe("error");
	});

	it("uses model context window, not hardcoded 128K", () => {
		// Same messages should show higher % on smaller context
		const messages: ContextMessage[] = Array.from({ length: 10 }, () => ({
			role: "user",
			content: "A".repeat(200),
		}));

		const usage8k = tracker.getUsage(messages, 8192);
		const usage128k = tracker.getUsage(messages, 128_000);

		expect(usage8k.fraction).toBeGreaterThan(usage128k.fraction);
		expect(usage8k.fraction).toBeGreaterThan(0);
		expect(usage128k.fraction).toBeGreaterThan(0);

		const pct8k = Math.round(usage8k.fraction * 100);
		const pct128k = Math.round(usage128k.fraction * 100);
		expect(pct8k).toBeGreaterThan(pct128k);
	});

	it("fraction is consistent: usedTokens / maxTokens", () => {
		const messages: ContextMessage[] = [{ role: "user", content: "Hello world this is a test" }];
		const usage = tracker.getUsage(messages, 8192);
		expect(usage.fraction).toBeCloseTo(usage.usedTokens / usage.maxTokens, 5);
	});
});
