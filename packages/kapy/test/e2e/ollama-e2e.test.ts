/**
 * E2E smoke test — verifies the full pipeline:
 * ChatSession → Agent → kapy-ai → Ollama (if available)
 *
 * Skipped if Ollama is not running (CI-safe).
 */

import { describe, test, expect, beforeAll } from "bun:test";
import { ChatSession } from "../../src/ai/chat-session.js";
import { z } from "zod";

let ollamaAvailable = false;

beforeAll(async () => {
	try {
		const res = await fetch("http://localhost:11434/api/tags", {
			signal: AbortSignal.timeout(2000),
		});
		ollamaAvailable = res.ok;
	} catch {
		ollamaAvailable = false;
	}
});

describe("E2E: ChatSession → Ollama", () => {
	test("full pipeline: init → send → response", async () => {
		if (!ollamaAvailable) {
			console.log("  ⏭ Skipping — Ollama not running");
			return;
		}

		const session = new ChatSession({
			defaultModel: "ollama:llama3.2:latest",
			systemPrompt: "You are a test assistant. Reply in one word only.",
		});

		await session.init();

		// Model should be set
		expect(session.agent.state.model?.id).toBe("llama3.2:latest");
		expect(session.agent.state.model?.provider).toBe("ollama");

		// Should have detected models
		expect(session.getAllModels().length).toBeGreaterThan(0);

		// Send a message
		await session.send("What is 2+2? Reply with just the number.");

		// Should have user + assistant messages
		expect(session.messages.length).toBeGreaterThanOrEqual(2);
		expect(session.messages[0].role).toBe("user");

		const assistantMsgs = session.messages.filter((m) => m.role === "assistant");
		expect(assistantMsgs.length).toBeGreaterThan(0);
		// Response should contain "4" somewhere
		expect(assistantMsgs[0].content).toContain("4");
	}, 30000);

	test("tool registration syncs to agent", async () => {
		if (!ollamaAvailable) {
			console.log("  ⏭ Skipping — Ollama not running");
			return;
		}

		const session = new ChatSession({
			defaultModel: "ollama:llama3.2:latest",
		});

		await session.init();

		// No tools initially
		expect(session.agent.state.tools?.length ?? 0).toBe(0);

		// Register a tool
		session.registerTool({
			name: "calculator",
			label: "Calculator",
			description: "Performs basic math",
			parameters: z.object({ expression: z.string() }),
			execute: async (_id, params, _sig, _cb, _ctx) => ({
				content: [{ type: "text" as const, text: `Result: ${params.expression}` }],
				details: {},
			}),
		});

		// Tool should be synced to agent
		expect(session.agent.state.tools?.length).toBe(1);
		expect(session.agent.state.tools?.[0]?.name).toBe("calculator");
	}, 15000);

	test("Ollama models detected and registered", async () => {
		if (!ollamaAvailable) {
			console.log("  ⏭ Skipping — Ollama not running");
			return;
		}

		const session = new ChatSession();
		await session.init();

		const models = session.getAllModels();
		expect(models.length).toBeGreaterThan(0);

		// All should be ollama provider
		for (const m of models) {
			expect(m.provider).toBe("ollama");
		}

		// llama3.2 should be present
		const llama = models.find((m) => m.id.includes("llama3.2"));
		expect(llama).toBeDefined();
	}, 15000);

	test("context usage is trackable", async () => {
		if (!ollamaAvailable) {
			console.log("  ⏭ Skipping — Ollama not running");
			return;
		}

		const session = new ChatSession({
			defaultModel: "ollama:llama3.2:latest",
		});
		await session.init();

		const usage = session.getContextUsage();
		expect(usage.usedTokens).toBeGreaterThanOrEqual(0);
		expect(usage.maxTokens).toBeGreaterThan(0);
		expect(usage.fraction).toBeGreaterThanOrEqual(0);
	});
});