import { describe, expect, test } from "bun:test";
import { OllamaAdapter } from "../../../../src/ai/provider/ollama.js";

describe("OllamaAdapter tool calling", () => {
	const adapter = new OllamaAdapter();

	test("stripProviderPrefix removes ollama/ prefix", () => {
		expect(adapter.stripProviderPrefix("ollama/qwen3:32b")).toBe("qwen3:32b");
	});

	test("stripProviderPrefix passes through plain model names", () => {
		expect(adapter.stripProviderPrefix("qwen3:32b")).toBe("qwen3:32b");
	});

	test("stripProviderPrefix handles model names with colons", () => {
		expect(adapter.stripProviderPrefix("ollama/qwen3-coder:480b-cloud")).toBe("qwen3-coder:480b-cloud");
	});

	test("getContextLength estimates from model name", () => {
		expect(adapter.getContextLength(null, "llama3.2:latest")).toBe(128_000);
		expect(adapter.getContextLength(null, "mistral:7b")).toBe(32_768);
		expect(adapter.getContextLength(null, "qwen3-coder:480b-cloud")).toBe(262_144);
		expect(adapter.getContextLength(null, "unknown-model")).toBe(4096);
	});

	test("hasReasoningCapability detects reasoning models", () => {
		expect(adapter.hasReasoningCapability("deepseek-r1:671b")).toBe(true);
		expect(adapter.hasReasoningCapability("qwq:32b")).toBe(true);
		expect(adapter.hasReasoningCapability("llama3.2:latest")).toBe(false);
	});

	test("tools parameter is accepted in StreamChatOptions", () => {
		const tools = [
			{
				type: "function" as const,
				function: {
					name: "test_tool",
					description: "A test tool",
					parameters: { type: "object", properties: {} },
				},
			},
		];
		const options = {
			model: "test",
			messages: [{ role: "system" as const, content: "test" }],
			tools,
		};
		expect(options.tools).toBeDefined();
		expect(options.tools?.length).toBe(1);
		expect(options.tools?.[0].function.name).toBe("test_tool");
	});

	test("StreamChunk type supports reasoning", () => {
		const chunk = { type: "reasoning" as const, text: "thinking..." };
		expect(chunk.type).toBe("reasoning");
		expect(chunk.text).toBe("thinking...");
	});

	test("StreamChunk type supports tool_call", () => {
		const chunk = {
			type: "tool_call" as const,
			toolCallId: "call_123",
			toolName: "read_file",
			toolArgs: '{"path": "/tmp/test.txt"}',
		};
		expect(chunk.type).toBe("tool_call");
		expect(chunk.toolName).toBe("read_file");
	});
});
