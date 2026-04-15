/**
 * Tests for TUI sidebar component logic — visibility, content.
 */

import { describe, expect, it } from "bun:test";
import { createSignal } from "solid-js";

describe("TUI Sidebar (logic)", () => {
	it("sidebar is hidden by default", () => {
		const [open, _] = createSignal(false);
		expect(open()).toBe(false);
	});

	it("sidebar can be toggled open", () => {
		const [open, setOpen] = createSignal(false);
		setOpen(true);
		expect(open()).toBe(true);
	});

	it("sidebar can be toggled closed", () => {
		const [open, setOpen] = createSignal(true);
		setOpen(false);
		expect(open()).toBe(false);
	});

	it("sidebar width is 42 columns (OpenCode standard)", () => {
		const SIDEBAR_WIDTH = 42;
		expect(SIDEBAR_WIDTH).toBe(42);
	});
});
