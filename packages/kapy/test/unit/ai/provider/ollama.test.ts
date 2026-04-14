import { describe, expect, test } from "bun:test";
import { OllamaAdapter } from "../../../../src/ai/provider/ollama.js";

describe("OllamaAdapter", () => {
	test("creates with default baseUrl", () => {
		const adapter = new OllamaAdapter();
		expect(adapter.baseUrl).toBe("http://localhost:11434");
	});

	test("creates with custom baseUrl from env", () => {
		const origEnv = process.env.OLLAMA_HOST;
		process.env.OLLAMA_HOST = "http://custom:1234";
		const adapter = new OllamaAdapter();
		expect(adapter.baseUrl).toBe("http://custom:1234");
		process.env.OLLAMA_HOST = origEnv;
	});

	test("getContextLength returns known model sizes", () => {
		const adapter = new OllamaAdapter();
		expect(adapter.getContextLength(null, "llama3.2")).toBe(128000);
		expect(adapter.getContextLength(null, "mistral")).toBe(32768);
		expect(adapter.getContextLength(null, "unknown-model")).toBe(4096);
	});

	test("getContextLength from model info", () => {
		const adapter = new OllamaAdapter();
		const modelInfo = {
			model_info: { "llama.context_length": 8192 },
		};
		expect(adapter.getContextLength(modelInfo as any, "test")).toBe(8192);
	});

	test("hasVisionCapability detects vision models", () => {
		const adapter = new OllamaAdapter();
		expect(adapter.hasVisionCapability({ capabilities: ["vision"] } as any)).toBe(true);
		expect(adapter.hasVisionCapability({ capabilities: [] } as any)).toBe(false);
		expect(adapter.hasVisionCapability(null)).toBe(false);
	});

	test("hasReasoningCapability detects reasoning models", () => {
		const adapter = new OllamaAdapter();
		expect(adapter.hasReasoningCapability("deepseek-r1")).toBe(true);
		expect(adapter.hasReasoningCapability("qwq")).toBe(true);
		expect(adapter.hasReasoningCapability("llama3")).toBe(false);
	});

	test("stripProviderPrefix removes provider prefix", () => {
		const adapter = new OllamaAdapter();
		expect(adapter.stripProviderPrefix("ollama/llama3")).toBe("llama3");
		expect(adapter.stripProviderPrefix("llama3")).toBe("llama3");
	});
});
