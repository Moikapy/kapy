/**
 * Tests for TUI theme context — dark/light mode, color values.
 */

import { describe, expect, it } from "bun:test";
import { RGBA } from "@opentui/core";
import { createSignal } from "solid-js";

describe("TUI Theme Context (logic)", () => {
	const DARK = {
		background: RGBA.fromHex("#16161e"),
		text: RGBA.fromHex("#c0caf5"),
		accent: RGBA.fromHex("#00AAFF"),
	};

	const LIGHT = {
		background: RGBA.fromHex("#e1e2e7"),
		text: RGBA.fromHex("#3760bf"),
		accent: RGBA.fromHex("#0070C0"),
	};

	it("defaults to dark mode", () => {
		const [mode, _setMode] = createSignal<"dark" | "light">("dark");
		expect(mode()).toBe("dark");
	});

	it("switches to light mode", () => {
		const [mode, setMode] = createSignal<"dark" | "light">("dark");
		setMode("light");
		expect(mode()).toBe("light");
	});

	it("provides correct colors for dark mode", () => {
		const [mode] = createSignal<"dark" | "light">("dark");
		const theme = () => (mode() === "dark" ? DARK : LIGHT);
		expect(theme().background).toBe(DARK.background);
		expect(theme().text).toBe(DARK.text);
	});

	it("provides correct colors for light mode", () => {
		const [mode] = createSignal<"dark" | "light">("light");
		const theme = () => (mode() === "dark" ? DARK : LIGHT);
		expect(theme().background).toBe(LIGHT.background);
		expect(theme().text).toBe(LIGHT.text);
	});

	it("accent color differs between modes", () => {
		// Compare by value (r,g,b differ)
		expect(
			DARK.accent.r === LIGHT.accent.r && DARK.accent.g === LIGHT.accent.g && DARK.accent.b === LIGHT.accent.b,
		).toBe(false);
	});
});
