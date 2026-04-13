/**
 * Anthropic provider adapter.
 * Uses /v1/messages endpoint (Anthropic's native API).
 */

import type { ModelInfo, ProviderAdapter, StreamChatOptions, StreamChunk, TokenUsage } from "./types.js";

const KNOWN_MODELS: Record<string, { contextLength: number; vision: boolean; reasoning: boolean }> = {
	"claude-sonnet-4-20250514": { contextLength: 200000, vision: true, reasoning: true },
	"claude-3-5-sonnet-20241022": { contextLength: 200000, vision: true, reasoning: false },
	"claude-3-5-haiku-20241022": { contextLength: 200000, vision: true, reasoning: false },
	"claude-3-opus-20240229": { contextLength: 200000, vision: true, reasoning: false },
};

export class AnthropicAdapter implements ProviderAdapter {
	baseUrl: string;
	apiKey?: string;

	constructor(options?: { baseUrl?: string; apiKey?: string }) {
		this.baseUrl = options?.baseUrl ?? "https://api.anthropic.com/v1";
		this.apiKey = options?.apiKey ?? process.env.ANTHROPIC_API_KEY;
	}

	async isAvailable(): Promise<boolean> {
		return !!this.apiKey;
	}

	async listModels(): Promise<ModelInfo[]> {
		return Object.entries(KNOWN_MODELS).map(([id, info]) => ({
			id,
			label: id,
			contextLength: info.contextLength,
			supportsVision: info.vision,
			supportsReasoning: info.reasoning,
			provider: "anthropic",
			family: "claude",
		}));
	}

	async chat(options: StreamChatOptions): Promise<{ content: string; usage: TokenUsage }> {
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
			"anthropic-version": "2023-06-01",
		};
		if (this.apiKey) headers["x-api-key"] = this.apiKey;

		// Convert messages to Anthropic format
		const systemMsg = options.messages.find((m) => m.role === "system");
		const messages = options.messages
			.filter((m) => m.role !== "system")
			.map((m) => ({ role: m.role === "tool" ? "user" : m.role, content: m.content }));

		const response = await fetch(`${this.baseUrl}/messages`, {
			method: "POST",
			headers,
			signal: options.signal,
			body: JSON.stringify({
				model: options.model,
				max_tokens: options.maxTokens ?? 4096,
				system: systemMsg?.content,
				messages,
			}),
		});

		if (!response.ok) {
			const error = await response.text().catch(() => response.statusText);
			throw new Error(`Anthropic chat error: ${error}`);
		}

		const data = (await response.json()) as {
			content: Array<{ type: string; text: string }>;
			usage: { input_tokens: number; output_tokens: number };
		};
		const text = data.content?.find((c) => c.type === "text")?.text ?? "";
		return {
			content: text,
			usage: {
				inputTokens: data.usage?.input_tokens ?? 0,
				outputTokens: data.usage?.output_tokens ?? 0,
			},
		};
	}

	async *streamChat(options: StreamChatOptions): AsyncGenerator<StreamChunk> {
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
			"anthropic-version": "2023-06-01",
		};
		if (this.apiKey) headers["x-api-key"] = this.apiKey;

		const systemMsg = options.messages.find((m) => m.role === "system");
		const messages = options.messages
			.filter((m) => m.role !== "system")
			.map((m) => ({ role: m.role === "tool" ? "user" : m.role, content: m.content }));

		const response = await fetch(`${this.baseUrl}/messages`, {
			method: "POST",
			headers,
			signal: options.signal,
			body: JSON.stringify({
				model: options.model,
				max_tokens: options.maxTokens ?? 4096,
				system: systemMsg?.content,
				messages,
				stream: true,
			}),
		});

		if (!response.ok) {
			const error = await response.text().catch(() => response.statusText);
			throw new Error(`Anthropic stream error: ${error}`);
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
					if (!line.startsWith("data: ")) continue;
					const dataLine = line.slice(6);
					try {
						const data = JSON.parse(dataLine) as {
							type: string;
							delta?: { text?: string };
							message?: { usage?: { input_tokens: number; output_tokens: number } };
						};
						if (data.type === "content_block_delta" && data.delta?.text) {
							yield { type: "text", text: data.delta.text };
						}
						if (data.type === "message_stop") {
							yield { type: "done" };
						}
						if (data.type === "message_start" && data.message?.usage) {
							yield {
								type: "usage",
								usage: {
									inputTokens: data.message.usage.input_tokens,
									outputTokens: data.message.usage.output_tokens,
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
