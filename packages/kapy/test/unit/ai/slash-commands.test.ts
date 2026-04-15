/**
 * Tests for slash command system — /help, /model, /compact, etc.
 */

import { beforeEach, describe, expect, test } from "bun:test";
import { Agent } from "@moikapy/kapy-agent";
import { SessionManager } from "../../../src/ai/session/manager.js";
import {
	createBuiltinSlashCommands,
	processSlashCommand,
	type SlashCommandContext,
} from "../../../src/ai/slash-commands.js";
import { ToolRegistry } from "../../../src/tool/registry.js";

/** Simple provider that wraps a model list */
class MockProvider {
	private models: Array<{ id: string; label?: string; provider: string; supportsReasoning?: boolean }> = [];

	constructor(models?: Array<{ id: string; label?: string; provider: string; supportsReasoning?: boolean }>) {
		this.models = models ?? [];
	}

	getAllModels() {
		return this.models;
	}
}

function createMockContext(overrides?: Partial<SlashCommandContext>): SlashCommandContext {
	const agent = new Agent();
	const providers = new MockProvider();
	const tools = new ToolRegistry();
	const sessions = SessionManager.inMemory();
	const output: string[] = [];

	return {
		agent,
		providers: providers as unknown as SlashCommandContext["providers"],
		tools,
		sessions,
		output: (text: string) => output.push(text),
		...overrides,
	};
}

describe("Slash Commands", () => {
	describe("processSlashCommand", () => {
		test("returns false for non-slash input", async () => {
			const ctx = createMockContext();
			const result = await processSlashCommand("hello world", ctx);
			expect(result).toBe(false);
		});

		test("returns true for slash input (consumed)", async () => {
			const ctx = createMockContext();
			const result = await processSlashCommand("/help", ctx);
			expect(result).toBe(true);
		});

		test("unknown slash command still consumes input", async () => {
			const ctx = createMockContext();
			const result = await processSlashCommand("/unknown", ctx);
			expect(result).toBe(true);
		});

		test("unknown slash command shows error", async () => {
			const output: string[] = [];
			const ctx = createMockContext({ output: (t) => output.push(t) });
			await processSlashCommand("/badcmd", ctx);
			expect(output.some((l) => l.includes("Unknown command"))).toBe(true);
		});
	});

	describe("/help", () => {
		test("shows available commands", async () => {
			const output: string[] = [];
			const ctx = createMockContext({ output: (t) => output.push(t) });
			await processSlashCommand("/help", ctx);
			expect(output.some((l) => l.includes("/help"))).toBe(true);
			expect(output.some((l) => l.includes("/model"))).toBe(true);
			expect(output.some((l) => l.includes("/quit"))).toBe(true);
		});
	});

	describe("/model", () => {
		test("shows no models message when empty", async () => {
			const output: string[] = [];
			const ctx = createMockContext({ output: (t) => output.push(t) });
			await processSlashCommand("/model", ctx);
			expect(output.some((l) => l.includes("No models available"))).toBe(true);
		});

		test("lists available models", async () => {
			const providers = new MockProvider([{ id: "llama3", provider: "ollama", label: "Llama 3" }]);
			const output: string[] = [];
			const ctx = createMockContext({
				providers: providers as unknown as SlashCommandContext["providers"],
				output: (t) => output.push(t),
			});
			await processSlashCommand("/model", ctx);
			expect(output.some((l) => l.includes("llama3"))).toBe(true);
		});
	});

	describe("/clear", () => {
		test("resets agent", async () => {
			const output: string[] = [];
			const ctx = createMockContext({ output: (t) => output.push(t) });
			await processSlashCommand("/clear", ctx);
			expect(output.some((l) => l.includes("cleared"))).toBe(true);
		});
	});

	describe("/compact", () => {
		test("produces output", async () => {
			const output: string[] = [];
			const ctx = createMockContext({ output: (t) => output.push(t) });
			await processSlashCommand("/compact", ctx);
			expect(output.length).toBeGreaterThan(0);
		});
	});

	describe("/tree", () => {
		test("shows empty tree message", async () => {
			const output: string[] = [];
			const ctx = createMockContext({ output: (t) => output.push(t) });
			await processSlashCommand("/tree", ctx);
			expect(output.some((l) => l.includes("No session entries") || l.includes("├─"))).toBe(true);
		});
	});

	describe("createBuiltinSlashCommands", () => {
		test("returns all expected commands", () => {
			const cmds = createBuiltinSlashCommands();
			const names = cmds.map((c) => c.name);
			expect(names).toContain("help");
			expect(names).toContain("model");
			expect(names).toContain("agent");
			expect(names).toContain("compact");
			expect(names).toContain("tree");
			expect(names).toContain("fork");
			expect(names).toContain("clear");
			expect(names).toContain("quit");
		});
	});
});
