/**
 * Tests for ChatSession — the integration glue between kapy-agent, kapy-ai, and TUI.
 *
 * These tests verify ChatSession's wiring without making real LLM calls.
 * Agent behavior is tested by @moikapy/kapy-agent's own test suite.
 */

import { beforeEach, describe, expect, test } from "bun:test";
import { Agent } from "@moikapy/kapy-agent";
import { type ChatMessage, ChatSession } from "../../../src/ai/chat-session.js";

describe("ChatSession", () => {
	let session: ChatSession;

	beforeEach(() => {
		session = new ChatSession();
	});

	test("creates with empty messages", () => {
		expect(session.messages.length).toBe(0);
		expect(session.isProcessing).toBe(false);
	});

	test("uses kapy-agent's Agent class", () => {
		expect(session.agent).toBeInstanceOf(Agent);
	});

	test("registers tools via registerTool", () => {
		const z = require("zod");
		session.registerTool({
			name: "my_tool",
			label: "My Tool",
			description: "A test tool",
			parameters: z.object({ input: z.string() }),
			execute: async (_id, args, _sig, _cb, _ctx) => ({
				content: [{ type: "text" as const, text: `Result: ${args.input}` }],
				details: {},
			}),
		});
		expect(session.tools.get("my_tool")).toBeDefined();
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

	test("setModel creates model reference for local providers", () => {
		// Register a model first so it can be found
		session.registerModel({
			id: "qwen3:32b",
			label: "Qwen3 32B",
			provider: "ollama",
			contextLength: 32768,
			supportsVision: false,
			supportsReasoning: false,
		});
		session.setModel("ollama", "qwen3:32b");
		const model = session.agent.state.model;
		expect(model?.id).toBe("qwen3:32b");
		expect(model?.provider).toBe("ollama");
	});

	test("setModel creates model reference for known providers", () => {
		// "anthropic" is a known provider in kapy-ai
		session.setModel("anthropic", "claude-sonnet-4-20250514");
		const model = session.agent.state.model;
		expect(model?.id).toBe("claude-sonnet-4-20250514");
		expect(model?.provider).toBe("anthropic");
	});

	test("getAllModels starts empty", () => {
		expect(session.getAllModels().length).toBe(0);
	});

	test("registerModel adds to internal registry", () => {
		session.registerModel({
			id: "test-model",
			label: "Test Model",
			provider: "ollama",
			contextLength: 8192,
			supportsVision: false,
			supportsReasoning: true,
		});
		expect(session.getAllModels().length).toBe(1);
		expect(session.getModel("test-model")?.provider).toBe("ollama");
	});

	test("onEvent returns unsubscribe function", () => {
		const events: unknown[] = [];
		const unsub = session.onEvent((e) => events.push(e));
		expect(typeof unsub).toBe("function");
		unsub();
	});

	test("abort calls agent abort", () => {
		// Verify abort doesn't throw when agent is idle
		session.abort();
		expect(session.isProcessing).toBe(false);
	});

	test("context tracker is accessible", () => {
		const usage = session.getContextUsage();
		expect(usage).toHaveProperty("usedTokens");
		expect(usage).toHaveProperty("maxTokens");
		expect(usage).toHaveProperty("fraction");
	});

	test("send ignores empty input", async () => {
		await session.send("");
		await session.send("   ");
		expect(session.messages.length).toBe(0);
	});

	test("send processes slash commands", async () => {
		await session.send("/help");

		// Should have system message from /help, not user message
		const hasSystemMessages = session.messages.some((m) => m.role === "system");
		expect(hasSystemMessages).toBe(true);
		// Should NOT have user message with "/help"
		expect(session.messages.some((m) => m.role === "user" && m.content === "/help")).toBe(false);
	});

	test("send /clear resets agent", async () => {
		await session.send("/clear");

		// Should have system confirmation message
		const clearMsg = session.messages.find((m) => m.content.includes("cleared"));
		expect(clearMsg).toBeDefined();
	});

	test("send unknown slash command shows error", async () => {
		await session.send("/nonexistent");

		const errorMsg = session.messages.find((m) => m.content.includes("Unknown command"));
		expect(errorMsg).toBeDefined();
	});

	test("extractContent handles string content", () => {
		// Access private method via any cast
		const result = (session as any).extractContent({ content: "hello" });
		expect(result).toBe("hello");
	});

	test("extractContent handles array content", () => {
		const result = (session as any).extractContent({
			content: [
				{ type: "text", text: "hello " },
				{ type: "text", text: "world" },
			],
		});
		expect(result).toBe("hello world");
	});
});
