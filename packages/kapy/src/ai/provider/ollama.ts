/**
 * Ollama provider — auto-detect, model listing, streaming chat.
 *
 * Works with kapy-agent via kapy-ai for remote providers,
 * but Ollama is handled locally because it needs runtime
 * auto-detection and model discovery that kapy-ai doesn't cover.
 */

// ── Local types (self-contained, no dependency on deleted provider/types) ──

/** Model info returned by OllamaAdapter */
export interface OllamaModelInfo {
	id: string;
	label: string;
	contextLength: number;
	supportsVision: boolean;
	supportsReasoning: boolean;
	provider: string;
	parameterSize?: string;
	family?: string;
}

/** Chat message for Ollama's OpenAI-compatible API */
export interface OllamaChatMessage {
	role: "system" | "user" | "assistant" | "tool";
	content: string;
}

/** Options for chat/streamChat calls */
export interface OllamaChatOptions {
	model: string;
	messages: OllamaChatMessage[];
	temperature?: number;
	maxTokens?: number;
	tools?: unknown[];
	signal?: AbortSignal;
}

/** Stream chunk from Ollama's SSE */
export type OllamaStreamChunk =
	| { type: "text"; text: string }
	| { type: "reasoning"; text: string }
	| { type: "tool_call"; toolCallId: string; toolName: string; toolArgs: string }
	| { type: "usage"; usage: { inputTokens: number; outputTokens: number } }
	| { type: "done" };

/** Token usage info */
export interface OllamaTokenUsage {
	inputTokens: number;
	outputTokens: number;
}

// ── Ollama model detail types ──

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

// ── OllamaAdapter ────────────────────────────────────────────────────

export class OllamaAdapter {
	baseUrl: string;
	apiKey?: string;

	constructor(options?: { baseUrl?: string; apiKey?: string }) {
		this.baseUrl = options?.baseUrl ?? process.env.OLLAMA_HOST ?? "http://localhost:11434";
		this.apiKey = options?.apiKey ?? process.env.OLLAMA_API_KEY;
	}

	/** Check if Ollama is running by attempting to list models */
	async isAvailable(): Promise<boolean> {
		try {
			const headers: Record<string, string> = {};
			if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`;

			const response = await fetch(`${this.baseUrl}/api/tags`, {
				headers,
				signal: AbortSignal.timeout(3000),
			});
			return response.ok;
		} catch {
			return false;
		}
	}

	/** List available models from /api/tags */
	async listModels(): Promise<OllamaModelInfo[]> {
		const headers: Record<string, string> = {};
		if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`;

		const response = await fetch(`${this.baseUrl}/api/tags`, { headers });
		if (!response.ok) {
			throw new Error(`Ollama list failed: ${response.status}`);
		}

		const data = (await response.json()) as { models: OllamaListedModel[] };
		const models: OllamaModelInfo[] = [];

		for (const model of data.models ?? []) {
			const details = await this.fetchModelDetails(model.name);
			models.push({
				id: model.name,
				label: model.name,
				contextLength: this.getContextLength(details, model.name),
				supportsVision: this.hasVisionCapability(details),
				supportsReasoning: this.hasReasoningCapability(model.name, details),
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

	/** Get context length from Ollama /api/show data, fallback to name-based estimation */
	getContextLength(modelInfo: OllamaModelDetails | null, modelName?: string): number {
		// 1. Local models have context_length in model_info (from GGUF metadata)
		if (modelInfo?.model_info) {
			const info = modelInfo.model_info as Record<string, unknown>;
			for (const key of Object.keys(info)) {
				if (key.endsWith(".context_length") && typeof info[key] === "number") {
					return info[key] as number;
				}
			}
		}

		// 2. Fallback: name-based estimation (covers cloud models with no model_info)
		if (modelName) return this.getContextLengthFromName(modelName);
		return 4096;
	}

	/** Estimate context length from model name patterns */
	private getContextLengthFromName(name: string): number {
		const lower = name.toLowerCase();
		// Cloud models (suffix :cloud or tag ending in -cloud) have larger context windows
		const isCloud = lower.endsWith(":cloud") || lower.includes("-cloud");
		if (isCloud) {
			if (lower.includes("qwen3.5")) return 262_144;
			if (lower.includes("kimi-k2.5")) return 262_144;
			if (lower.includes("glm-5")) return 202_752;
			if (lower.includes("deepseek")) return 163_840;
			if (lower.includes("qwen3-coder")) return 262_144;
			if (lower.includes("gpt-oss")) return 128_000;
			if (lower.includes("gemma4")) return 128_000;
			if (lower.includes("nemotron")) return 128_000;
			if (lower.includes("minimax")) return 128_000;
			return 128_000; // default for cloud models
		}
		// Local models
		if (lower.includes("llama3.2") || lower.includes("llama3.3") || lower.includes("llama3.1")) return 128_000;
		if (lower.includes("llama3")) return 8192;
		if (lower.includes("mistral") || lower.includes("mixtral")) return 32_768;
		if (lower.includes("qwen3")) return 262_144;
		if (lower.includes("qwen2.5") || lower.includes("qwen")) return 32_768;
		if (lower.includes("kimi")) return 262_144;
		if (lower.includes("deepseek")) return 128_000;
		if (lower.includes("phi")) return 16_384;
		if (lower.includes("nomic-embed")) return 8192;
		return 4096;
	}

	/** Check if model has vision capability — uses /api/show capabilities for cloud models, model_info for local */
	hasVisionCapability(modelInfo: OllamaModelDetails | null): boolean {
		if (!modelInfo) return false;
		// Cloud models expose capabilities array (e.g. ["completion", "tools", "thinking", "vision"])
		if (modelInfo.capabilities?.some((c) => c === "vision")) return true;
		// Local models have it in model_info
		if (modelInfo.model_info) {
			const info = modelInfo.model_info as Record<string, unknown>;
			if (info["clip.has_vision_encoder"] === true) return true;
		}
		return false;
	}

	/** Check if model supports reasoning — uses /api/show capabilities for cloud, name heuristic as fallback */
	hasReasoningCapability(modelName: string, modelInfo?: OllamaModelDetails | null): boolean {
		// Cloud models expose capabilities array (e.g. ["completion", "tools", "thinking"])
		if (modelInfo?.capabilities?.some((c) => c === "thinking")) return true;
		// Fallback: name heuristic
		const lower = modelName.toLowerCase();
		return (
			lower.includes("reason") ||
			lower.includes("r1") ||
			lower.includes("qwq") ||
			lower.includes("deepseek") ||
			lower.includes("glm") ||
			lower.includes("qwen3") ||
			lower.includes("gemma4")
		);
	}

	/** Strip provider prefix from model name (e.g., "ollama/llama3" → "llama3") */
	stripProviderPrefix(model: string): string {
		if (model.includes("/")) {
			return model.split("/")[1] ?? model;
		}
		return model;
	}

	/** Non-streaming chat (Ollama OpenAI-compatible /v1/chat/completions) */
	async chat(options: OllamaChatOptions): Promise<{ content: string; usage: OllamaTokenUsage }> {
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
	async *streamChat(options: OllamaChatOptions): AsyncGenerator<OllamaStreamChunk> {
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
									reasoning?: string;
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

						// Reasoning content — Ollama uses "reasoning", OpenAI spec uses "reasoning_content"
						const reasoningText = delta?.reasoning_content ?? delta?.reasoning;
						if (reasoningText) {
							yield { type: "reasoning", text: reasoningText };
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
