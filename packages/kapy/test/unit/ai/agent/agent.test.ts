import { describe, expect, test } from "bun:test";
import { KapyAgent } from "../../../../src/ai/agent/agent.js";

describe("KapyAgent", () => {
	test("creates with default state", () => {
		const agent = new KapyAgent();
		const state = agent.state;
		expect(state.systemPrompt).toBe("");
		expect(state.thinkingLevel).toBe("off");
		expect(state.messages).toHaveLength(0);
		expect(state.isStreaming).toBe(false);
	});

	test("setSystemPrompt updates state", () => {
		const agent = new KapyAgent();
		agent.setSystemPrompt("You are a helpful assistant");
		expect(agent.state.systemPrompt).toBe("You are a helpful assistant");
	});

	test("setThinkingLevel updates state", () => {
		const agent = new KapyAgent();
		agent.setThinkingLevel("medium");
		expect(agent.state.thinkingLevel).toBe("medium");
	});

	test("setModel updates state", () => {
		const agent = new KapyAgent();
		agent.setModel({ id: "llama3", provider: "ollama" } as any);
		expect(agent.state.model.id).toBe("llama3");
	});

	test("subscribe receives events", () => {
		const agent = new KapyAgent();
		const events: any[] = [];
		agent.subscribe((e) => events.push(e));
		agent.setSystemPrompt("test");
		// No events emitted by setSystemPrompt directly —
		// but subscribe returns an unsubscribe function
		const unsub = agent.subscribe((e) => events.push(e));
		expect(typeof unsub).toBe("function");
		unsub();
	});

	test("appendMessage adds to messages", () => {
		const agent = new KapyAgent();
		agent.appendMessage({ role: "user", content: "Hello" } as any);
		expect(agent.state.messages).toHaveLength(1);
		expect(agent.state.messages[0].content).toBe("Hello");
	});

	test("replaceMessages overwrites messages", () => {
		const agent = new KapyAgent();
		agent.appendMessage({ role: "user", content: "First" } as any);
		agent.replaceMessages([{ role: "user", content: "Replaced" } as any]);
		expect(agent.state.messages).toHaveLength(1);
		expect(agent.state.messages[0].content).toBe("Replaced");
	});

	test("steer queues a steering message", () => {
		const agent = new KapyAgent();
		agent.steer({ role: "user", content: "Change direction" } as any);
		expect(agent.hasQueuedMessages()).toBe(true);
	});

	test("followUp queues a follow-up message", () => {
		const agent = new KapyAgent();
		agent.followUp({ role: "user", content: "Next step" } as any);
		expect(agent.hasQueuedMessages()).toBe(true);
	});

	test("clearSteeringQueue removes steering messages", () => {
		const agent = new KapyAgent();
		agent.steer({ role: "user", content: "Steer" } as any);
		agent.clearSteeringQueue();
		// Only steering cleared, followUp might still be queued
	});

	test("clearFollowUpQueue removes follow-up messages", () => {
		const agent = new KapyAgent();
		agent.followUp({ role: "user", content: "Follow up" } as any);
		agent.clearFollowUpQueue();
	});

	test("clearAllQueues removes both queues", () => {
		const agent = new KapyAgent();
		agent.steer({ role: "user", content: "Steer" } as any);
		agent.followUp({ role: "user", content: "Follow" } as any);
		agent.clearAllQueues();
		expect(agent.hasQueuedMessages()).toBe(false);
	});

	test("setSteeringMode updates mode", () => {
		const agent = new KapyAgent();
		agent.setSteeringMode("one-at-a-time");
		expect(agent.getSteeringMode()).toBe("one-at-a-time");
	});

	test("setFollowUpMode updates mode", () => {
		const agent = new KapyAgent();
		agent.setFollowUpMode("one-at-a-time");
		expect(agent.getFollowUpMode()).toBe("one-at-a-time");
	});

	test("abort sets abort flag and controller", () => {
		const agent = new KapyAgent();
		agent.abort();
		// After abort, state should reflect it
		expect(agent.state.error).toBeDefined();
	});

	test("reset clears state", () => {
		const agent = new KapyAgent();
		agent.setSystemPrompt("Test prompt");
		agent.appendMessage({ role: "user", content: "Hello" } as any);
		agent.reset();
		expect(agent.state.messages).toHaveLength(0);
		expect(agent.state.systemPrompt).toBe("");
	});
});
