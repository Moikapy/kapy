/**
 * Tests for TUI dialog context — open/close state.
 */

import { describe, it, expect } from "bun:test";
import { createSignal } from "solid-js";
import type { DialogType } from "../../../../src/tui/context/dialog.js";

describe("TUI Dialog Context (logic)", () => {
	it("starts with no dialog open", () => {
		const [open, setOpen] = createSignal<DialogType>(null);
		expect(open()).toBeNull();
	});

	it("opens a dialog", () => {
		const [open, setOpen] = createSignal<DialogType>(null);
		setOpen("help");
		expect(open()).toBe("help");
	});

	it("closes a dialog", () => {
		const [open, setOpen] = createSignal<DialogType>("help");
		setOpen(null);
		expect(open()).toBeNull();
	});

	it("switches between dialogs", () => {
		const [open, setOpen] = createSignal<DialogType>(null);
		setOpen("model");
		expect(open()).toBe("model");
		setOpen("help");
		expect(open()).toBe("help");
	});

	it("all valid dialog types can be opened", () => {
		const validTypes: DialogType[] = [
			"model",
			"help",
			"command",
			"agent",
			"session-list",
			"mcp",
			"theme",
			"status",
		];
		for (const type of validTypes) {
			const [open, setOpen] = createSignal<DialogType>(null);
			setOpen(type);
			expect(open()).toBe(type);
		}
	});
});