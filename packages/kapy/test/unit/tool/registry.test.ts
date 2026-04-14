import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { ToolRegistry } from "../../../src/tool/registry.js";
import type { KapyToolRegistration } from "../../../src/tool/types.js";

function makeTool(overrides: Partial<KapyToolRegistration> = {}): KapyToolRegistration {
	return {
		name: "test-tool",
		label: "Test Tool",
		description: "A test tool",
		parameters: z.object({ input: z.string() }),
		execute: async () => ({ content: [{ type: "text", text: "ok" }], details: {} }),
		...overrides,
	};
}

describe("ToolRegistry", () => {
	test("registers a tool definition", () => {
		const reg = new ToolRegistry();
		const tool = makeTool();
		reg.register(tool);
		expect(reg.has("test-tool")).toBe(true);
	});

	test("retrieves a tool by name", () => {
		const reg = new ToolRegistry();
		const tool = makeTool();
		reg.register(tool);
		expect(reg.get("test-tool")).toBe(tool);
	});

	test("returns undefined for unknown tool", () => {
		const reg = new ToolRegistry();
		expect(reg.get("no-such-tool")).toBeUndefined();
	});

	test("has() returns false for unknown tool", () => {
		const reg = new ToolRegistry();
		expect(reg.has("no-such-tool")).toBe(false);
	});

	test("all() returns all registered tools", () => {
		const reg = new ToolRegistry();
		reg.register(makeTool({ name: "tool-a" }));
		reg.register(makeTool({ name: "tool-b" }));
		expect(reg.all()).toHaveLength(2);
	});

	test("toolCount returns count", () => {
		const reg = new ToolRegistry();
		expect(reg.toolCount).toBe(0);
		reg.register(makeTool({ name: "a" }));
		reg.register(makeTool({ name: "b" }));
		expect(reg.toolCount).toBe(2);
	});

	test("first registration wins on duplicates", () => {
		const reg = new ToolRegistry();
		const first = makeTool({ name: "dup", label: "First" });
		const second = makeTool({ name: "dup", label: "Second" });
		reg.register(first);
		reg.register(second);
		expect(reg.get("dup")?.label).toBe("First");
	});

	test("validates tool name matches ^[a-z][a-z0-9_-]*$", () => {
		const reg = new ToolRegistry();
		expect(() => reg.register(makeTool({ name: "" }))).toThrow();
		expect(() => reg.register(makeTool({ name: "MY-TOOL" }))).toThrow();
		expect(() => reg.register(makeTool({ name: "123bad" }))).toThrow();
		expect(() => reg.register(makeTool({ name: "good-name_v2" }))).not.toThrow();
	});

	test("requires non-empty description", () => {
		const reg = new ToolRegistry();
		expect(() => reg.register(makeTool({ description: "" }))).toThrow();
		expect(() => reg.register(makeTool({ description: "Valid desc" }))).not.toThrow();
	});

	test("unregister removes a tool", () => {
		const reg = new ToolRegistry();
		reg.register(makeTool({ name: "removable" }));
		expect(reg.has("removable")).toBe(true);
		reg.unregister("removable");
		expect(reg.has("removable")).toBe(false);
	});

	test("getActiveTools returns only active tools when set", () => {
		const reg = new ToolRegistry();
		reg.register(makeTool({ name: "tool-a" }));
		reg.register(makeTool({ name: "tool-b" }));
		reg.register(makeTool({ name: "tool-c" }));

		// Default: all tools active
		expect(reg.getActiveTools()).toHaveLength(3);

		// Set only tool-a and tool-c as active
		reg.setActiveTools(["tool-a", "tool-c"]);
		const active = reg.getActiveTools();
		expect(active).toHaveLength(2);
		expect(active.map((t) => t.name).sort()).toEqual(["tool-a", "tool-c"]);
	});

	test("setActiveTools ignores unknown tool names", () => {
		const reg = new ToolRegistry();
		reg.register(makeTool({ name: "tool-a" }));
		reg.setActiveTools(["tool-a", "nonexistent"]);
		const active = reg.getActiveTools();
		expect(active).toHaveLength(1);
		expect(active[0].name).toBe("tool-a");
	});

	test("setActiveTools with empty array disables all tools", () => {
		const reg = new ToolRegistry();
		reg.register(makeTool({ name: "tool-a" }));
		reg.setActiveTools([]);
		expect(reg.getActiveTools()).toHaveLength(0);
	});

	test("setActiveTools(null) resets to all tools active", () => {
		const reg = new ToolRegistry();
		reg.register(makeTool({ name: "tool-a" }));
		reg.register(makeTool({ name: "tool-b" }));
		reg.setActiveTools(["tool-a"]);
		expect(reg.getActiveTools()).toHaveLength(1);
		reg.setActiveTools(null);
		expect(reg.getActiveTools()).toHaveLength(2);
	});
});
