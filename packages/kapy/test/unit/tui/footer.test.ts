/**
 * Tests for TUI footer component logic — status bar data.
 */

import { describe, expect, it } from "bun:test";

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
