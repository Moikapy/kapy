/**
 * Ollama provider adapter — pi-ollama pattern.
 *
 * Auto-detects installed models via /api/tags,
 * fetches model details via /api/show,
 * estimates context length, vision, and reasoning capabilities.
 * No dependency on 'ollama' npm package — uses fetch directly.
 */

import type { ModelInfo, ProviderAdapter, StreamChatOptions, StreamChunk, TokenUsage } from "./types.js";

export interface OllamaModelDetails {
	model_info?: Record<string, unknown>;
	details?: {
		families?: string[];
		parameter_size?: string;
		quantization_level?: string;
		[key: string]: unknown;
	};
	capabilities?: string[];
	parameter_size?: string;
	quantization_level?: string;
	families?: string[];
}

export interface OllamaListedModel {
	name: string;
	size?: number;
	modified_at?: string;
	digest?: string;
	details?: {
		parameter_size?: string;
		family?: string;
		families?: string[];
		variant?: string;
		quantization_level?: string;
		[key: string]: unknown;
	};
}

export class OllamaAdapter implements ProviderAdapter {
	baseUrl: string;
	apiKey?: string;

	constructor(options?: { baseUrl?: string; apiKey?: string }) {
		this.baseUrl = options?.baseUrl ?? process.env.OLLAMA_HOST ?? "http://localhost:11434";
		this.apiKey = options?.apiKey ?? process.env.OLLAMA_API_KEY;
	}

	/** Check if Ollama is running by attempting to list models */
	async isAvailable(): Promise<boolean> {
		try {
			const response = await fetch(`${this.baseUrl}/api/tags`, {
				signal: AbortSignal.timeout(3000),
			});
			return response.ok;
		} catch {
			return false;
		}
	}

	/** List available models from /api/tags */
	async listModels(): Promise<ModelInfo[]> {
		const headers: Record<string, string> = {};
		if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`;

		const response = await fetch(`${this.baseUrl}/api/tags`, { headers });
		if (!response.ok) {
			throw new Error(`Ollama list failed: ${response.status}`);
		}

		const data = (await response.json()) as { models: OllamaListedModel[] };
		const models: ModelInfo[] = [];

		for (const model of data.models ?? []) {
			const details = await this.fetchModelDetails(model.name);
			models.push({
				id: model.name,
				label: model.name,
				contextLength: this.getContextLength(details, model.name),
				supportsVision: this.hasVisionCapability(details),
				supportsReasoning: this.hasReasoningCapability(model.name),
				provider: "ollama",
				parameterSize: model.details?.parameter_size ?? details?.parameter_size,
				family: model.details?.family ?? details?.families?.[0],
			});
		}

		return models;
	}

	/** Fetch model details from /api/show */
	async fetchModelDetails(modelName: string): Promise<OllamaModelDetails | null> {
		try {
			const response = await fetch(`${this.baseUrl}/api/show`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: modelName }),
			});
			if (!response.ok) return null;
			return (await response.json()) as OllamaModelDetails;
		} catch {
			return null;
		}
	}

	/** Get context length from model details or fallback to name-based estimation */
	getContextLength(modelInfo: OllamaModelDetails | null, modelName?: string): number {
		if (!modelInfo) {
			return modelName ? this.getContextLengthFromName(modelName) : 4096;
		}

		const info = (modelInfo.model_info ?? modelInfo) as Record<string, unknown>;

		// Check for context_length in model_info keys
		for (const key of Object.keys(info)) {
			if (key.endsWith(".context_length") && typeof info[key] === "number") {
				return info[key] as number;
			}
		}

		// Fallback to name-based estimation
		if (modelName) return this.getContextLengthFromName(modelName);
		return 4096;
	}

	/** Estimate context length from model name patterns */
	private getContextLengthFromName(name: string): number {
		const lower = name.toLowerCase();
		if (lower.includes("llama3.2") || lower.includes("llama3.3") || lower.includes("llama3.1")) return 128_000;
		if (lower.includes("llama3")) return 8192;
		if (lower.includes("mistral") || lower.includes("mixtral")) return 32_768;
		if (lower.includes("qwen3")) return 262_144;
		if (lower.includes("qwen2.5") || lower.includes("qwen")) return 32_768;
		if (lower.includes("kimi")) return 262_144;
		if (lower.includes("deepseek")) return 128_000;
		if (lower.includes("phi")) return 16_384;
		return 4096;
	}

	/** Check if model has vision capability */
	hasVisionCapability(modelInfo: OllamaModelDetails | null): boolean {
		if (!modelInfo) return false;
		const caps = modelInfo.capabilities ?? [];
		if (caps.some((c) => c.toLowerCase().includes("vision"))) return true;
		if (modelInfo.model_info) {
			const info = modelInfo.model_info as Record<string, unknown>;
			if (info["clip.has_vision_encoder"] === true) return true;
		}
		return false;
	}

	/** Check if model supports reasoning (name-based heuristic) */
	hasReasoningCapability(modelName: string): boolean {
		const lower = modelName.toLowerCase();
		return lower.includes("reason") || lower.includes("r1") || lower.includes("qwq") || lower.includes("deepseek");
	}

	/** Strip provider prefix from model name (e.g., "ollama/llama3" → "llama3") */
	stripProviderPrefix(model: string): string {
		if (model.includes("/")) {
			return model.split("/")[1] ?? model;
		}
		return model;
	}

	/** Non-streaming chat (Ollama OpenAI-compatible /v1/chat/completions) */
	async chat(options: StreamChatOptions): Promise<{ content: string; usage: TokenUsage }> {
		const headers: Record<string, string> = { "Content-Type": "application/json" };
		if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`;

		const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
			method: "POST",
			headers,
			signal: options.signal,
			body: JSON.stringify({
				model: this.stripProviderPrefix(options.model),
				messages: options.messages,
				temperature: options.temperature ?? 0.7,
				max_tokens: options.maxTokens ?? 4096,
				stream: false,
			}),
		});

		if (!response.ok) {
			const error = await response.text().catch(() => response.statusText);
			throw new Error(`Ollama chat error: ${error}`);
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

	/** Streaming chat (SSE from /v1/chat/completions) */
	async *streamChat(options: StreamChatOptions): AsyncGenerator<StreamChunk> {
		const headers: Record<string, string> = { "Content-Type": "application/json" };
		if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`;

		const body: Record<string, unknown> = {
			model: this.stripProviderPrefix(options.model),
			messages: options.messages,
			temperature: options.temperature ?? 0.7,
			max_tokens: options.maxTokens ?? 4096,
			stream: true,
		};

		// Pass tool schemas if provided
		if (options.tools && options.tools.length > 0) {
			body.tools = options.tools;
		}

		const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
			method: "POST",
			headers,
			signal: options.signal,
			body: JSON.stringify(body),
		});

		if (!response.ok) {
			const error = await response.text().catch(() => response.statusText);
			throw new Error(`Ollama stream error: ${error}`);
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
							choices: Array<{
								delta: {
									content?: string;
									reasoning_content?: string;
									tool_calls?: Array<{ id?: string; function?: { name?: string; arguments?: string } }>;
								};
							}>;
							usage?: { prompt_tokens: number; completion_tokens: number };
						};
						const delta = data.choices?.[0]?.delta;

						// Text content
						if (delta?.content) {
							yield { type: "text", text: delta.content };
						}

						// Reasoning content (GLM, DeepSeek, QwQ)
						if (delta?.reasoning_content) {
							yield { type: "reasoning", text: delta.reasoning_content };
						}

						// Tool calls (streaming function calls)
						if (delta?.tool_calls) {
							for (const tc of delta.tool_calls) {
								yield {
									type: "tool_call" as const,
									toolCallId: tc.id ?? `call_${Date.now()}`,
									toolName: tc.function?.name ?? "",
									toolArgs: tc.function?.arguments ?? "{}",
								};
							}
						}

						// Usage
						if (data.usage) {
							yield {
								type: "usage" as const,
								usage: {
									inputTokens: data.usage.prompt_tokens,
									outputTokens: data.usage.completion_tokens,
								},
							};
						}
					} catch {
						// Skip malformed SSE lines
					}
				}
			}
		} finally {
			reader.releaseLock();
		}
	}
}