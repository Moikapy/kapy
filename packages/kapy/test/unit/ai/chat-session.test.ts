/**
 * Tests for ChatSession — the integration glue between AgentLoop and TUI.
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { ChatSession, type ChatMessage } from "../../../src/ai/chat-session.js";
import type { StreamChunk, ProviderAdapter, ModelInfo } from "../../../src/ai/provider/types.js";

/** Mock provider that yields a simple response */
function createMockProvider(text: string): ProviderAdapter {
	return {
		async listModels(): Promise<ModelInfo[]> {
			return [{ id: "test-model", provider: "test", label: "Test Model" }];
		},
		async isAvailable(): Promise<boolean> { return true; },
		async *streamChat(_options): AsyncGenerator<StreamChunk> {
			yield { type: "text", text };
			yield { type: "done" };
		},
		async chat(_options): Promise<{ content: string; usage: { inputTokens: number; outputTokens: number } }> {
			return { content: text, usage: { inputTokens: 5, outputTokens: text.length } };
		},
	};
}

function createMockProviderWithToolCall(): ProviderAdapter {
	let round = 0;
	return {
		async listModels(): Promise<ModelInfo[]> {
			return [{ id: "test-model", provider: "test", label: "Test Model" }];
		},
		async isAvailable(): Promise<boolean> { return true; },
		async *streamChat(_options): AsyncGenerator<StreamChunk> {
			if (round === 0) {
				round++;
				yield { type: "tool_call", toolCallId: "tc-1", toolName: "read_file", toolArgs: JSON.stringify({ path: "/test.txt" }) };
				yield { type: "done" };
			} else {
				yield { type: "text", text: "I read the file." };
				yield { type: "done" };
			}
		},
		async chat(_options): Promise<{ content: string; usage: { inputTokens: number; outputTokens: number } }> {
			return { content: "Done", usage: { inputTokens: 5, outputTokens: 3 } };
		},
	};
}

describe("ChatSession", () => {
	let session: ChatSession;

	beforeEach(() => {
		session = new ChatSession();
	});

	test("creates with empty messages", () => {
		expect(session.messages.length).toBe(0);
		expect(session.isProcessing).toBe(false);
	});

	test("registers a provider adapter", () => {
		const provider = createMockProvider("Hello");
		session.registerProvider("test", provider);
		session.providers.register({ id: "test", name: "Test", type: "custom" });
		session.setModel("test", "test-model");
		expect(session.agent.state.model?.id).toBe("test-model");
	});

	test("send adds user message and processes through agent", async () => {
		const provider = createMockProvider("Hello from agent!");
		session.registerProvider("test", provider);
		session.providers.register({ id: "test", name: "Test", type: "custom" });
		session.setModel("test", "test-model");

		await session.send("Say hi");

		// Should have user message + assistant response
		expect(session.messages.length).toBeGreaterThanOrEqual(2);
		expect(session.messages[0].role).toBe("user");
		expect(session.messages[0].content).toBe("Say hi");
		expect(session.messages.some((m) => m.role === "assistant")).toBe(true);
	});

	test("send processes slash commands instead of agent", async () => {
		session.registerProvider("test", createMockProvider("X"));
		session.providers.register({ id: "test", name: "Test", type: "custom" });
		session.setModel("test", "test-model");

		await session.send("/help");

		// Should have system message from /help, not user+assistant
		const hasSystemMessages = session.messages.some((m) => m.role === "system");
		expect(hasSystemMessages).toBe(true);
		// Should NOT have sent to LLM
		expect(session.messages.some((m) => m.role === "user" && m.content === "/help")).toBe(false);
	});

	test("send shows error when no model available", async () => {
		await session.send("Hello");

		// Should have user message + system error
		expect(session.messages.length).toBeGreaterThanOrEqual(2);
		const error = session.messages.find((m) => m.content.includes("No model"));
		expect(error).toBeDefined();
	});

	test("streaming updates last assistant message", async () => {
		const provider = createMockProvider("Hello world!");
		session.registerProvider("test", provider);
		session.providers.register({ id: "test", name: "Test", type: "custom" });
		session.setModel("test", "test-model");

		const events: unknown[] = [];
		session.onEvent((e) => events.push(e));

		await session.send("Hi");

		// Should have received streaming events
		const hasUpdate = events.some((e: any) => e.type === "message_update");
		expect(hasUpdate).toBe(true);

		// Last assistant message should not be streaming anymore
		const lastAssistant = session.messages.filter((m) => m.role === "assistant").pop();
		expect(lastAssistant?.isStreaming).toBe(false);
	});

	test("abort stops processing", async () => {
		const slowProvider: ProviderAdapter = {
			async listModels() { return []; },
			async isAvailable() { return true; },
			async *streamChat(options) {
				yield { type: "text", text: "start..." };
				await new Promise((r) => setTimeout(r, 200));
				yield { type: "text", text: "end" };
				yield { type: "done" };
			},
			async chat() { return { content: "", usage: { inputTokens: 0, outputTokens: 0 } }; },
		};

		session.registerProvider("test", slowProvider);
		session.providers.register({ id: "test", name: "Test", type: "custom" });
		session.setModel("test", "test-model");

		const promise = session.send("Go slow");
		setTimeout(() => session.abort(), 50);
		await promise;

		expect(session.isProcessing).toBe(false);
	});

	test("event subscription and unsubscribe", async () => {
		const events: unknown[] = [];
		const unsub = session.onEvent((e) => events.push(e));

		const provider = createMockProvider("Hi");
		session.registerProvider("test", provider);
		session.providers.register({ id: "test", name: "Test", type: "custom" });
		session.setModel("test", "test-model");

		await session.send("Hi");
		expect(events.length).toBeGreaterThan(0);

		unsub();
		events.length = 0;

		await session.send("Hi again");
		expect(events.length).toBe(0);
	});

	test("registerTool adds tool to registry", () => {
		const z = require("zod");
		session.registerTool({
			name: "my_tool",
			description: "A test tool",
			parameters: z.object({ input: z.string() }),
			execute: async (_id, args) => ({
				output: `Result: ${args.input}`,
				title: "My Tool",
			}),
		});
		expect(session.tools.get("my_tool")).toBeDefined();
	});

	test("auto-select model from available providers", async () => {
		session.providers.register({
			id: "ollama",
			name: "Ollama",
			type: "ollama",
			models: [
				{ id: "llama3", provider: "ollama", label: "Llama 3", supportsReasoning: false },
				{ id: "qwq-32b", provider: "ollama", label: "QwQ 32B", supportsReasoning: true },
			],
		});

		session["autoSelectModel"]();

		// Should prefer reasoning model
		expect(session.agent.state.model?.id).toBe("qwq-32b");
	});

	test("auto-select falls back to first model if no reasoning", () => {
		session.providers.register({
			id: "ollama",
			name: "Ollama",
			type: "ollama",
			models: [
				{ id: "llama3", provider: "ollama", label: "Llama 3" },
			],
		});

		session["autoSelectModel"]();

		expect(session.agent.state.model?.id).toBe("llama3");
	});

	test("setModel updates agent model", () => {
		session.providers.register({ id: "ollama", name: "Ollama", type: "ollama" });
		session.setModel("ollama", "qwen3:32b");
		expect(session.agent.state.model?.id).toBe("qwen3:32b");
		expect(session.agent.state.model?.provider).toBe("ollama");
	});

	test("system prompt passed to agent", () => {
		const s = new ChatSession({ systemPrompt: "You are a kapy agent." });
		expect(s.agent.state.systemPrompt).toBe("You are a kapy agent.");
	});

	test("permission rules passed to evaluator", () => {
		const s = new ChatSession({
			permissionRules: [
				{ permission: "read_file", pattern: "*", action: "allow" },
				{ permission: "write_file", pattern: "*", action: "deny" },
			],
		});
		const rules = s.permissions.getRules();
		expect(rules.length).toBe(2);
	});
});