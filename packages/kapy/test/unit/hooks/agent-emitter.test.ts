import { describe, expect, test } from "bun:test";
import { AgentEventEmitter } from "../../../src/hooks/agent-emitter.js";

describe("AgentEventEmitter", () => {
	test("emits events and collects handler results", async () => {
		const emitter = new AgentEventEmitter();
		emitter.on("tool_call", async (_event) => {
			return { blocked: false };
		});
		const results = await emitter.emit("tool_call", { toolName: "bash" });
		expect(results).toEqual([{ blocked: false }]);
	});

	test("multiple handlers return multiple results", async () => {
		const emitter = new AgentEventEmitter();
		emitter.on("tool_call", async () => ({ blocked: false }));
		emitter.on("tool_call", async () => undefined);
		const results = await emitter.emit("tool_call", { toolName: "bash" });
		expect(results).toEqual([{ blocked: false }, undefined]);
	});

	test("tool_call handler can return { block: true, reason }", async () => {
		const emitter = new AgentEventEmitter();
		emitter.on("tool_call", async (event) => {
			if ((event as any).toolName === "bash") {
				return { block: true, reason: "Dangerous command" };
			}
			return undefined;
		});
		const results = await emitter.emit("tool_call", { toolName: "bash" });
		expect(results).toEqual([{ block: true, reason: "Dangerous command" }]);
	});

	test("tool_call handler can mutate event.input", async () => {
		const emitter = new AgentEventEmitter();
		const event = { toolName: "bash", input: { command: "ls" } };

		emitter.on("tool_call", async (e) => {
			// Mutate input — same as pi's pattern
			(e as any).input.command = `source ~/.profile\n${(e as any).input.command}`;
		});
		await emitter.emit("tool_call", event);

		// The event should be mutated in place
		expect((event as any).input.command).toBe("source ~/.profile\nls");
	});

	test("tool_result handler can modify result", async () => {
		const emitter = new AgentEventEmitter();
		emitter.on("tool_result", async (_event) => {
			return { content: [{ type: "text", text: "modified" }], isError: false };
		});
		const results = await emitter.emit("tool_result", { toolName: "bash" });
		expect(results).toEqual([{ content: [{ type: "text", text: "modified" }], isError: false }]);
	});

	test("handlers run in registration order", async () => {
		const emitter = new AgentEventEmitter();
		const order: number[] = [];
		emitter.on("test", async () => {
			order.push(1);
		});
		emitter.on("test", async () => {
			order.push(2);
		});
		emitter.on("test", async () => {
			order.push(3);
		});
		await emitter.emit("test", {});
		expect(order).toEqual([1, 2, 3]);
	});

	test("returns empty array for unknown events", async () => {
		const emitter = new AgentEventEmitter();
		const results = await emitter.emit("nonexistent", {});
		expect(results).toEqual([]);
	});

	test("off removes a handler", async () => {
		const emitter = new AgentEventEmitter();
		let called = false;
		const handler = async () => {
			called = true;
		};
		emitter.on("test", handler);
		emitter.off("test", handler);
		await emitter.emit("test", {});
		expect(called).toBe(false);
	});
});
