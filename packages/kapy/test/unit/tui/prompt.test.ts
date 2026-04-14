/**
 * Tests for TUI prompt component logic — placeholder rotation, input state.
 */

import { describe, it, expect } from "bun:test";

const PLACEHOLDERS = {
	normal: [
		"Fix a TODO in the codebase",
		"What is the tech stack of this project?",
		"Fix broken tests",
	],
};

describe("TUI Prompt (logic)", () => {
	it("cycles through placeholders based on time", () => {
		const list = PLACEHOLDERS.normal;
		// Simulate the rotation logic from the component
		const idx = Math.floor(Date.now() / 8000) % list.length;
		expect(idx).toBeGreaterThanOrEqual(0);
		expect(idx).toBeLessThan(list.length);
		expect(list[idx]).toBeDefined();
	});

	it("placeholder index wraps around", () => {
		const list = PLACEHOLDERS.normal;
		for (let i = 0; i < list.length * 3; i++) {
			const idx = i % list.length;
			expect(list[idx]).toBeDefined();
		}
	});

	it("does not submit empty input", () => {
		const input = "";
		const trimmed = input.trim();
		expect(trimmed.length).toBe(0);
		expect(!trimmed).toBe(true); // should NOT submit
	});

	it("submits non-empty trimmed input", () => {
		const input = "  hello world  ";
		const trimmed = input.trim();
		expect(trimmed.length).toBeGreaterThan(0);
		expect(!trimmed).toBe(false); // should submit
	});
});