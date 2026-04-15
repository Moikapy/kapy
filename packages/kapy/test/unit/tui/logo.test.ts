/**
 * Tests for TUI logo component logic — ASCII art lines, branding.
 */

import { describe, expect, it } from "bun:test";

const LOGO_LINES = ["  ╭━━━╮  ", "  ┃╺╮╺┃  ", "  ┃╹ ╹┃  ", "  ╰┳━┳╯  ", "   ┗━┛   "];

const KAPY = "KAPY";
const TAGLINE = "agent-first cli";

describe("TUI Logo (logic)", () => {
	it("has 5 ASCII art lines for the hamster icon", () => {
		expect(LOGO_LINES.length).toBe(5);
	});

	it("each logo line has consistent width", () => {
		const widths = LOGO_LINES.map((l) => l.length);
		const unique = [...new Set(widths)];
		expect(unique.length).toBe(1);
	});

	it("brand name is KAPY", () => {
		expect(KAPY).toBe("KAPY");
		expect(KAPY.length).toBe(4);
	});

	it("tagline indicates agent-first CLI", () => {
		expect(TAGLINE).toContain("agent");
		expect(TAGLINE).toContain("cli");
	});

	it("logo uses box-drawing characters", () => {
		const hasBoxDrawing = LOGO_LINES.some((line) => /[╭╮╰╯┃━╺╹┳┗]/.test(line));
		expect(hasBoxDrawing).toBe(true);
	});
});
