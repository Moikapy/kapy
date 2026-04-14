/**
 * Tests for AgentLoop — the core LLM ↔ tool execution cycle.
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { KapyAgent } from "../../../src/ai/agent/agent.js";
import { ToolRegistry } from "../../../src/tool/registry.js";
import { ProviderRegistry } from "../../../src/ai/provider/registry.js";
import { PermissionEvaluator } from "../../../src/ai/permission/evaluator.js";
import { AgentLoop } from "../../../src/ai/agent-loop.js";
import { z } from "zod";
import type { KapyToolRegistration } from "../../../src/tool/types.js";
import type { StreamChunk, ProviderAdapter, ChatMessage } from "../../../src/ai/provider/types.js";
import type { ModelInfo } from "../../../src/ai/provider/types.js";

// ─── Mock Provider Adapters ─────────────────────────────

function createMockProvider(responseText: string): ProviderAdapter {
	const chunks = splitIntoChunks(responseText);
	return {
		async listModels(): Promise<ModelInfo[]> {
			return [{ id: "mock-model", provider: "mock", label: "Mock Model" }];
		},
		async isAvailable(): Promise<boolean> { return true; },
		async *streamChat(_options): AsyncGenerator<StreamChunk> {
			for (const chunk of chunks) yield chunk;
		},
		async chat(_options): Promise<{ content: string; usage: { inputTokens: number; outputTokens: number } }> {
			return { content: responseText, usage: { inputTokens: 10, outputTokens: responseText.length } };
		},
	};
}

function createMultiRoundProvider(rounds: Array<{ toolCalls?: StreamChunk[]; finalText: string }>): ProviderAdapter {
	let roundIndex = 0;
	return {
		async listModels(): Promise<ModelInfo[]> {
			return [{ id: "mock-model", provider: "mock", label: "Mock Model" }];
		},
		async isAvailable(): Promise<boolean> { return true; },
		async *streamChat(_options): AsyncGenerator<StreamChunk> {
			const round = rounds[Math.min(roundIndex, rounds.length - 1)];
			roundIndex++;
			if (round.toolCalls) {
				for (const tc of round.toolCalls) yield tc;
			}
			yield { type: "text", text: round.finalText };
			yield { type: "done" };
		},
		async chat(_options): Promise<{ content: string; usage: { inputTokens: number; outputTokens: number } }> {
			return { content: rounds[0].finalText, usage: { inputTokens: 10, outputTokens: 5 } };
		},
	};
}

function splitIntoChunks(text: string): StreamChunk[] {
	const mid = Math.floor(text.length / 2);
	const chunks: StreamChunk[] = [];
	if (mid > 0) {
		chunks.push({ type: "text", text: text.slice(0, mid) });
		chunks.push({ type: "text", text: text.slice(mid) });
	} else {
		chunks.push({ type: "text", text });
	}
	chunks.push({ type: "done" });
	return chunks;
}

// ─── Tests ─────────────────────────────

describe("AgentLoop", () => {
	let agent: KapyAgent;
	let toolRegistry: ToolRegistry;
	let providerRegistry: ProviderRegistry;
	let permissionEvaluator: PermissionEvaluator;
	let events: unknown[];

	beforeEach(() => {
		agent = new KapyAgent();
		toolRegistry = new ToolRegistry();
		providerRegistry = new ProviderRegistry();
		permissionEvaluator = new PermissionEvaluator([]);
		events = [];
		agent.subscribe((e) => events.push(e));
	});

	test("prompt sends user message and receives LLM response", async () => {
		const mockProvider = createMockProvider("Hello from the agent!");

		providerRegistry.register({
			id: "mock",
			name: "Mock Provider",
			type: "custom",
			models: [{ id: "mock-model", provider: "mock", label: "Mock Model" }],
		});

		agent.setModel({ id: "mock-model", provider: "mock" });
		agent.setSystemPrompt("You are a helpful assistant.");

		const loop = new AgentLoop(agent, toolRegistry, providerRegistry, permissionEvaluator);
		loop.setProviderAdapter("mock", mockProvider);

		await loop.prompt("Say hello");

		expect(agent.state.messages.length).toBeGreaterThanOrEqual(2);
		expect(agent.state.messages[0].role).toBe("user");
		expect(agent.state.messages[0].content).toBe("Say hello");
		expect(agent.state.messages[1].role).toBe("assistant");

		const eventTypes = events.map((e: any) => e.type);
		expect(eventTypes).toContain("agent_start");
		expect(eventTypes).toContain("agent_end");
	});

	test("prompt with tool call executes the tool and loops", async () => {
		const readTool: KapyToolRegistration = {
			name: "read_file",
			description: "Read a file",
			parameters: z.object({ path: z.string() }),
			execute: async (_toolCallId, args) => ({
				output: `Content of ${args.path}`,
				title: `Read ${args.path}`,
			}),
		};
		toolRegistry.register(readTool);

		// Allow read_file for any input
		permissionEvaluator.addRule({ permission: "read_file", pattern: "*", action: "allow" });

		const mockProvider = createMultiRoundProvider([
			{
				toolCalls: [{ type: "tool_call", toolCallId: "tc-1", toolName: "read_file", toolArgs: JSON.stringify({ path: "/tmp/test.txt" }) }],
				finalText: "",
			},
			{ finalText: "I read the file for you." },
		]);

		providerRegistry.register({ id: "mock", name: "Mock Provider", type: "custom" });
		agent.setModel({ id: "mock-model", provider: "mock" });

		const loop = new AgentLoop(agent, toolRegistry, providerRegistry, permissionEvaluator);
		loop.setProviderAdapter("mock", mockProvider);

		await loop.prompt("Read the test file");

		const msgRoles = agent.state.messages.map((m) => m.role);
		expect(msgRoles).toContain("user");
		expect(msgRoles).toContain("tool");

		const eventTypes = events.map((e: any) => e.type);
		expect(eventTypes).toContain("agent_start");
		expect(eventTypes).toContain("agent_end");
	});

	test("permission denied blocks tool execution and sends error to LLM", async () => {
		const writeTool: KapyToolRegistration = {
			name: "write_file",
			description: "Write a file",
			parameters: z.object({ path: z.string(), content: z.string() }),
			execute: async (_toolCallId, args) => ({
				output: `Wrote to ${args.path}`,
				title: `Write ${args.path}`,
			}),
		};
		toolRegistry.register(writeTool);

		// Deny write_file for any input
		permissionEvaluator.addRule({ permission: "write_file", pattern: "*", action: "deny" });

		const mockProvider = createMultiRoundProvider([
			{
				toolCalls: [{ type: "tool_call", toolCallId: "tc-1", toolName: "write_file", toolArgs: JSON.stringify({ path: "/secret", content: "data" }) }],
				finalText: "",
			},
			{ finalText: "I cannot write to that location." },
		]);

		providerRegistry.register({ id: "mock", name: "Mock Provider", type: "custom" });
		agent.setModel({ id: "mock-model", provider: "mock" });

		const loop = new AgentLoop(agent, toolRegistry, providerRegistry, permissionEvaluator);
		loop.setProviderAdapter("mock", mockProvider);

		await loop.prompt("Write a file");

		const toolResults = agent.state.messages.filter((m) => m.role === "tool");
		expect(toolResults.length).toBeGreaterThanOrEqual(1);
		expect(toolResults[0].content).toContain("Permission denied");
	});

	test("events include streaming message_update tokens", async () => {
		const mockProvider = createMockProvider("Hello world");

		providerRegistry.register({ id: "mock", name: "Mock", type: "custom" });
		agent.setModel({ id: "mock-model", provider: "mock" });

		const loop = new AgentLoop(agent, toolRegistry, providerRegistry, permissionEvaluator);
		loop.setProviderAdapter("mock", mockProvider);

		await loop.prompt("Hi");

		const messageUpdates = events.filter((e: any) => e.type === "message_update");
		expect(messageUpdates.length).toBeGreaterThanOrEqual(1);
	});

	test("abort stops the agent loop", async () => {
		const slowProvider: ProviderAdapter = {
			async listModels() { return []; },
			async isAvailable() { return true; },
			async *streamChat(options) {
				yield { type: "text", text: "start..." };
				await new Promise((r) => setTimeout(r, 200));
				if (options.signal?.aborted) return;
				yield { type: "text", text: "end" };
				yield { type: "done" };
			},
			async chat() { return { content: "", usage: { inputTokens: 0, outputTokens: 0 } }; },
		};

		providerRegistry.register({ id: "mock", name: "Mock", type: "custom" });
		agent.setModel({ id: "mock-model", provider: "mock" });

		const loop = new AgentLoop(agent, toolRegistry, providerRegistry, permissionEvaluator);
		loop.setProviderAdapter("mock", slowProvider);

		const promise = loop.prompt("Go slow");
		setTimeout(() => agent.abort(), 50);

		await promise;
		expect(agent.state.isStreaming).toBe(false);
	});

	test("no model set throws error", () => {
		const loop = new AgentLoop(agent, toolRegistry, providerRegistry, permissionEvaluator);
		expect(loop.prompt("Hello")).rejects.toThrow("No model set");
	});

	test("no adapter for provider throws error", () => {
		agent.setModel({ id: "some-model", provider: "nonexistent" });
		const loop = new AgentLoop(agent, toolRegistry, providerRegistry, permissionEvaluator);
		expect(loop.prompt("Hello")).rejects.toThrow("No adapter for provider");
	});

	test("max tool rounds prevents infinite loops", async () => {
		const infiniteProvider: ProviderAdapter = {
			async listModels() { return []; },
			async isAvailable() { return true; },
			async *streamChat() {
				yield { type: "tool_call", toolCallId: "tc-loop", toolName: "read_file", toolArgs: JSON.stringify({ path: "/loop" }) };
				yield { type: "done" };
			},
			async chat() { return { content: "", usage: { inputTokens: 0, outputTokens: 0 } }; },
		};

		const readTool: KapyToolRegistration = {
			name: "read_file",
			description: "Read a file",
			parameters: z.object({ path: z.string() }),
			execute: async (_toolCallId, args) => ({
				output: `Content of ${args.path}`,
				title: `Read ${args.path}`,
			}),
		};
		toolRegistry.register(readTool);
		permissionEvaluator.addRule({ permission: "read_file", pattern: "*", action: "allow" });

		providerRegistry.register({ id: "mock", name: "Mock", type: "custom" });
		agent.setModel({ id: "mock-model", provider: "mock" });

		const loop = new AgentLoop(agent, toolRegistry, providerRegistry, permissionEvaluator);
		loop.setProviderAdapter("mock", infiniteProvider);
		loop.setMaxToolRounds(3);

		await loop.prompt("Keep reading");

		expect(agent.state.isStreaming).toBe(false);
	});

	test("continue resumes from current context", async () => {
		providerRegistry.register({ id: "mock", name: "Mock", type: "custom" });
		agent.setModel({ id: "mock-model", provider: "mock" });

		const mockProvider = createMockProvider("Continuing...");

		const loop = new AgentLoop(agent, toolRegistry, providerRegistry, permissionEvaluator);
		loop.setProviderAdapter("mock", mockProvider);

		await loop.prompt("Start");
		const msgCountAfterFirst = agent.state.messages.length;

		await loop.continue();
		expect(agent.state.messages.length).toBeGreaterThan(msgCountAfterFirst);
	});

	test("system prompt included in chat messages", async () => {
		let capturedMessages: ChatMessage[] = [];

		const capturingProvider: ProviderAdapter = {
			async listModels() { return []; },
			async isAvailable() { return true; },
			async *streamChat(options) {
				capturedMessages = options.messages;
				yield { type: "text", text: "OK" };
				yield { type: "done" };
			},
			async chat() { return { content: "", usage: { inputTokens: 0, outputTokens: 0 } }; },
		};

		providerRegistry.register({ id: "mock", name: "Mock", type: "custom" });
		agent.setModel({ id: "mock-model", provider: "mock" });
		agent.setSystemPrompt("You are a kapy agent.");

		const loop = new AgentLoop(agent, toolRegistry, providerRegistry, permissionEvaluator);
		loop.setProviderAdapter("mock", capturingProvider);

		await loop.prompt("Hi");

		expect(capturedMessages.length).toBeGreaterThanOrEqual(2);
		expect(capturedMessages[0].role).toBe("system");
		expect(capturedMessages[0].content).toBe("You are a kapy agent.");
	});

	test("tool schemas built from ToolRegistry", async () => {
		let capturedTools: unknown[] = [];

		const capturingProvider: ProviderAdapter = {
			async listModels() { return []; },
			async isAvailable() { return true; },
			async *streamChat(options) {
				capturedTools = options.tools ?? [];
				yield { type: "text", text: "OK" };
				yield { type: "done" };
			},
			async chat() { return { content: "", usage: { inputTokens: 0, outputTokens: 0 } }; },
		};

		const readTool: KapyToolRegistration = {
			name: "read_file",
			description: "Read a file",
			parameters: z.object({ path: z.string() }),
			execute: async (_toolCallId, args) => ({
				output: `Content of ${args.path}`,
				title: `Read ${args.path}`,
			}),
		};
		toolRegistry.register(readTool);

		providerRegistry.register({ id: "mock", name: "Mock", type: "custom" });
		agent.setModel({ id: "mock-model", provider: "mock" });

		const loop = new AgentLoop(agent, toolRegistry, providerRegistry, permissionEvaluator);
		loop.setProviderAdapter("mock", capturingProvider);

		await loop.prompt("Use tools");

		expect(capturedTools.length).toBe(1);
		const toolDef = capturedTools[0] as any;
		expect(toolDef.type).toBe("function");
		expect(toolDef.function.name).toBe("read_file");
	});

	test("context transformer modifies messages before sending", async () => {
		let capturedMessages: ChatMessage[] = [];

		const capturingProvider: ProviderAdapter = {
			async listModels() { return []; },
			async isAvailable() { return true; },
			async *streamChat(options) {
				capturedMessages = options.messages;
				yield { type: "text", text: "OK" };
				yield { type: "done" };
			},
			async chat() { return { content: "", usage: { inputTokens: 0, outputTokens: 0 } }; },
		};

		providerRegistry.register({ id: "mock", name: "Mock", type: "custom" });
		agent.setModel({ id: "mock-model", provider: "mock" });

		const loop = new AgentLoop(agent, toolRegistry, providerRegistry, permissionEvaluator);
		loop.setProviderAdapter("mock", capturingProvider);

		// Truncate to last message only
		loop.setContextTransformer(async (msgs) => msgs.slice(-1));

		await loop.prompt("Hi");

		const nonSystem = capturedMessages.filter((m) => m.role !== "system");
		expect(nonSystem.length).toBeLessThanOrEqual(1);
	});
});