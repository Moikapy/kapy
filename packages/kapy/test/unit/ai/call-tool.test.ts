import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { callTool } from "../../../src/ai/call-tool.js";
import { ToolRegistry } from "../../../src/tool/registry.js";

describe("callTool", () => {
	test("executes a tool and returns result", async () => {
		const registry = new ToolRegistry();
		registry.register({
			name: "greet",
			label: "Greet",
			description: "Greet someone",
			parameters: z.object({ name: z.string() }),
			execute: async (_id, params) => ({
				content: [{ type: "text", text: `Hello, ${params.name}!` }],
				details: {},
			}),
		});

		const result = await callTool(registry, "greet", { name: "World" });
		expect(result.content).toEqual([{ type: "text", text: "Hello, World!" }]);
	});

	test("validates input against Zod schema", async () => {
		const registry = new ToolRegistry();
		registry.register({
			name: "greet",
			label: "Greet",
			description: "Greet someone",
			parameters: z.object({ name: z.string() }),
			execute: async (_id, params) => ({
				content: [{ type: "text", text: `Hello, ${params.name}!` }],
				details: {},
			}),
		});

		// Missing required field
		expect(callTool(registry, "greet", {})).rejects.toThrow();
		// Wrong type
		expect(callTool(registry, "greet", { name: 123 })).rejects.toThrow();
	});

	test("throws on unknown tool", async () => {
		const registry = new ToolRegistry();
		expect(callTool(registry, "nonexistent", {})).rejects.toThrow("Tool not found");
	});

	test("passes signal to execute", async () => {
		const registry = new ToolRegistry();
		let receivedSignal: AbortSignal | undefined;
		registry.register({
			name: "test",
			label: "Test",
			description: "Test tool",
			parameters: z.object({}),
			execute: async (_id, _params, signal) => {
				receivedSignal = signal;
				return { content: [{ type: "text", text: "ok" }], details: {} };
			},
		});

		const controller = new AbortController();
		await callTool(registry, "test", {}, { signal: controller.signal });
		expect(receivedSignal).toBe(controller.signal);
	});

	test("passes prepareArguments before validation", async () => {
		const registry = new ToolRegistry();
		let receivedParams: Record<string, unknown> = {};
		registry.register({
			name: "legacy",
			label: "Legacy",
			description: "Legacy tool",
			parameters: z.object({ input: z.string() }),
			prepareArguments: (args) => {
				// Remap old 'text' field to 'input'
				if ("text" in args && !("input" in args)) {
					return { ...args, input: args.text };
				}
				return args;
			},
			execute: async (_id, params) => {
				receivedParams = params;
				return { content: [{ type: "text", text: "ok" }], details: {} };
			},
		});

		const result = await callTool(registry, "legacy", { text: "hello" });
		expect(result.content[0]).toEqual({ type: "text", text: "ok" });
		expect(receivedParams.input).toBe("hello");
	});

	test("dry-run returns description without executing", async () => {
		const registry = new ToolRegistry();
		let executed = false;
		registry.register({
			name: "danger",
			label: "Danger",
			description: "A dangerous tool",
			parameters: z.object({ action: z.string() }),
			execute: async () => {
				executed = true;
				return { content: [{ type: "text", text: "boom" }], details: {} };
			},
		});

		const result = await callTool(registry, "danger", { action: "delete" }, { dryRun: true });
		expect(executed).toBe(false);
		expect(result).toEqual({
			dryRun: true,
			tool: "danger",
			input: { action: "delete" },
			description: "A dangerous tool",
		});
	});
});
