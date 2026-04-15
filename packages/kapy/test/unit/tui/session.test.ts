/**
 * Tests for TUI session state — message list, prompt submission.
 */

import { describe, expect, it } from "bun:test";
import { createSignal } from "solid-js";

interface Message {
	id: string;
	role: "user" | "assistant" | "tool" | "system";
	content: string;
	timestamp: number;
}

describe("TUI Session State (logic)", () => {
	it("starts with empty messages", () => {
		const [messages] = createSignal<Message[]>([]);
		expect(messages()).toEqual([]);
	});

	it("adds user message on submit", () => {
		const [messages, setMessages] = createSignal<Message[]>([]);
		const input = "Fix the TODO in auth.ts";
		setMessages((prev) => [...prev, { id: "msg-1", role: "user", content: input, timestamp: Date.now() }]);
		expect(messages().length).toBe(1);
		expect(messages()[0].role).toBe("user");
		expect(messages()[0].content).toBe(input);
	});

	it("adds assistant response after user message", () => {
		const [messages, setMessages] = createSignal<Message[]>([]);
		setMessages((prev) => [...prev, { id: "msg-1", role: "user", content: "hello", timestamp: Date.now() }]);
		setMessages((prev) => [...prev, { id: "msg-2", role: "assistant", content: "Hi there!", timestamp: Date.now() }]);
		expect(messages().length).toBe(2);
		expect(messages()[1].role).toBe("assistant");
	});

	it("clears input after submit", () => {
		const [input, setInput] = createSignal("Fix tests");
		setInput("");
		expect(input()).toBe("");
	});

	it("preserves message order", () => {
		const [messages, setMessages] = createSignal<Message[]>([]);
		const items = ["first", "second", "third"];
		for (const text of items) {
			setMessages((prev) => [...prev, { id: `msg-${text}`, role: "user", content: text, timestamp: Date.now() }]);
		}
		expect(messages().map((m) => m.content)).toEqual(["first", "second", "third"]);
	});

	it("handles tool result messages", () => {
		const [messages, setMessages] = createSignal<Message[]>([]);
		setMessages((prev) => [
			...prev,
			{ id: "msg-1", role: "user", content: "read file", timestamp: Date.now() },
			{ id: "msg-2", role: "tool", content: "file contents here", timestamp: Date.now() },
			{ id: "msg-3", role: "assistant", content: "I read the file", timestamp: Date.now() },
		]);
		expect(messages()[1].role).toBe("tool");
		expect(messages().length).toBe(3);
	});
});
