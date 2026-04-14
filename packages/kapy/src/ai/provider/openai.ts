/**
 * OpenAI provider adapter.
 * Uses /v1/chat/completions endpoint.
 */

import type { ModelInfo, ProviderAdapter, StreamChatOptions, StreamChunk, TokenUsage } from "./types.js";

const KNOWN_MODELS: Record<string, { contextLength: number; vision: boolean; reasoning: boolean }> = {
	"gpt-4o": { contextLength: 128000, vision: true, reasoning: false },
	"gpt-4o-mini": { contextLength: 128000, vision: true, reasoning: false },
	"gpt-4-turbo": { contextLength: 128000, vision: true, reasoning: false },
	"gpt-4": { contextLength: 8192, vision: false, reasoning: false },
	"gpt-3.5-turbo": { contextLength: 16385, vision: false, reasoning: false },
	o1: { contextLength: 200000, vision: false, reasoning: true },
	"o1-mini": { contextLength: 128000, vision: false, reasoning: true },
	o3: { contextLength: 200000, vision: true, reasoning: true },
	"o3-mini": { contextLength: 200000, vision: false, reasoning: true },
	"o4-mini": { contextLength: 200000, vision: true, reasoning: true },
};

export class OpenAIAdapter implements ProviderAdapter {
	baseUrl: string;
	apiKey?: string;

	constructor(options?: { baseUrl?: string; apiKey?: string }) {
		this.baseUrl = options?.baseUrl ?? "https://api.openai.com/v1";
		this.apiKey = options?.apiKey ?? process.env.OPENAI_API_KEY;
	}

	async isAvailable(): Promise<boolean> {
		return !!this.apiKey;
	}

	async listModels(): Promise<ModelInfo[]> {
		// Return known model list (no dynamic discovery for OpenAI)
		return Object.entries(KNOWN_MODELS).map(([id, info]) => ({
			id,
			label: id,
			contextLength: info.contextLength,
			supportsVision: info.vision,
			supportsReasoning: info.reasoning,
			provider: "openai",
			family: "gpt",
		}));
	}

	async chat(options: StreamChatOptions): Promise<{ content: string; usage: TokenUsage }> {
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
		};
		if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`;

		const response = await fetch(`${this.baseUrl}/chat/completions`, {
			method: "POST",
			headers,
			signal: options.signal,
			body: JSON.stringify({
				model: options.model,
				messages: options.messages,
				temperature: options.temperature ?? 0.7,
				max_tokens: options.maxTokens ?? 4096,
				stream: false,
			}),
		});

		if (!response.ok) {
			const error = await response.text().catch(() => response.statusText);
			throw new Error(`OpenAI chat error: ${error}`);
		}

		const data = (await response.json()) as {
			choices: Array<{ message: { content: string } }>;
			usage: { prompt_tokens: number; completion_tokens: number };
		};
		return {
			content: data.choices?.[0]?.message?.content ?? "",
			usage: {
				inputTokens: data.usage?.prompt_tokens ?? 0,
				outputTokens: data.usage?.completion_tokens ?? 0,
			},
		};
	}

	async *streamChat(options: StreamChatOptions): AsyncGenerator<StreamChunk> {
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
		};
		if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`;

		const response = await fetch(`${this.baseUrl}/chat/completions`, {
			method: "POST",
			headers,
			signal: options.signal,
			body: JSON.stringify({
				model: options.model,
				messages: options.messages,
				temperature: options.temperature ?? 0.7,
				max_tokens: options.maxTokens ?? 4096,
				stream: true,
			}),
		});

		if (!response.ok) {
			const error = await response.text().catch(() => response.statusText);
			throw new Error(`OpenAI stream error: ${error}`);
		}

		if (!response.body) throw new Error("No response body");
		const reader = response.body.getReader();
		const decoder = new TextDecoder();

		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				const chunk = decoder.decode(value, { stream: true });
				const lines = chunk.split("\n").filter((l) => l.trim());
				for (const line of lines) {
					const dataLine = line.startsWith("data: ") ? line.slice(6) : line;
					if (dataLine === "[DONE]") {
						yield { type: "done" };
						continue;
					}
					try {
						const data = JSON.parse(dataLine) as {
							choices: Array<{ delta: { content?: string } }>;
							usage?: { prompt_tokens: number; completion_tokens: number };
						};
						const content = data.choices?.[0]?.delta?.content;
						if (content) yield { type: "text", text: content };
						if (data.usage) {
							yield {
								type: "usage",
								usage: {
									inputTokens: data.usage.prompt_tokens,
									outputTokens: data.usage.completion_tokens,
								},
							};
						}
					} catch {
						// Skip malformed SSE
					}
				}
			}
		} finally {
			reader.releaseLock();
		}
	}
}
