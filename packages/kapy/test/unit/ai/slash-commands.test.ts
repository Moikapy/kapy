/**
 * Tests for slash command system — /help, /model, /compact, etc.
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { KapyAgent } from "../../../src/ai/agent/agent.js";
import { ProviderRegistry } from "../../../src/ai/provider/registry.js";
import { ToolRegistry } from "../../../src/tool/registry.js";
import { SessionManager } from "../../../src/ai/session/manager.js";
import {
	createBuiltinSlashCommands,
	processSlashCommand,
	type SlashCommandContext,
} from "../../../src/ai/slash-commands.js";

function createMockContext(overrides?: Partial<SlashCommandContext>): SlashCommandContext {
	const agent = new KapyAgent();
	const providers = new ProviderRegistry();
	const tools = new ToolRegistry();
	const sessions = new SessionManager();
	const output: string[] = [];

	return {
		agent,
		providers,
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
			const providers = new ProviderRegistry();
			providers.register({
				id: "ollama",
				name: "Ollama",
				type: "ollama",
				models: [{ id: "llama3", provider: "ollama", label: "Llama 3" }],
			});
			const output: string[] = [];
			const ctx = createMockContext({ providers, output: (t) => output.push(t) });
			await processSlashCommand("/model", ctx);
			expect(output.some((l) => l.includes("llama3"))).toBe(true);
		});

		test("marks current model", async () => {
			const agent = new KapyAgent();
			agent.setModel({ id: "llama3", provider: "ollama" });
			const providers = new ProviderRegistry();
			providers.register({
				id: "ollama",
				name: "Ollama",
				type: "ollama",
				models: [{ id: "llama3", provider: "ollama", label: "Llama 3" }],
			});
			const output: string[] = [];
			const ctx = createMockContext({ agent, providers, output: (t) => output.push(t) });
			await processSlashCommand("/model", ctx);
			expect(output.some((l) => l.includes("← current"))).toBe(true);
		});
	});

	describe("/clear", () => {
		test("clears agent messages", async () => {
			const agent = new KapyAgent();
			agent.appendMessage({ role: "user", content: "Hello", timestamp: Date.now() });
			const output: string[] = [];
			const ctx = createMockContext({ agent, output: (t) => output.push(t) });
			await processSlashCommand("/clear", ctx);
			expect(agent.state.messages.length).toBe(0);
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

	describe("/fork", () => {
		test("creates a fork", async () => {
			const sessions = new SessionManager();
			sessions.appendMessage({ role: "user", content: "Hello" });
			const output: string[] = [];
			const ctx = createMockContext({ sessions, output: (t) => output.push(t) });
			await processSlashCommand("/fork", ctx);
			expect(output.some((l) => l.includes("Forked") || l.includes("fork"))).toBe(true);
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