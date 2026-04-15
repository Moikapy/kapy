/**
 * streamOllama — native Ollama stream function using the ollama-js SDK.
 *
 * Uses the native /api/chat endpoint with the `think` parameter for proper
 * thinking/reasoning control. Matches kapy-ai's StreamFn signature so it
 * can be used as agent.streamFn for Ollama models.
 */

import { AssistantMessageEventStream } from "@moikapy/kapy-ai/event-stream";
import type { AssistantMessage, AssistantMessageEvent, Context, Message } from "@moikapy/kapy-ai/types";
import type { Model } from "@moikapy/kapy-ai";

/** Map kapy-ai thinking levels to Ollama's think parameter */
function mapThinkLevel(
	thinkingLevel: string | undefined,
): boolean | "low" | "medium" | "high" {
	if (!thinkingLevel || thinkingLevel === "off") return false;
	// GPT-OSS supports "low"/"medium"/"high" — other models just use boolean
	if (thinkingLevel === "low" || thinkingLevel === "medium" || thinkingLevel === "high") {
		return thinkingLevel;
	}
	// Minimal → low, xhigh → high
	if (thinkingLevel === "minimal") return "low";
	if (thinkingLevel === "xhigh") return "high";
	return true;
}

/** Convert kapy-ai Messages to Ollama chat messages */
function toOllamaMessages(messages: Message[], systemPrompt?: string): any[] {
	const result: any[] = [];

	if (systemPrompt) {
		result.push({ role: "system", content: systemPrompt });
	}

	for (const msg of messages) {
		if (msg.role === "user") {
			const text = typeof msg.content === "string" ? msg.content : extractText(msg.content);
			result.push({ role: "user", content: text });
		} else if (msg.role === "assistant") {
			const text = typeof msg.content === "string" ? msg.content : extractText(msg.content);
			const thinking = extractThinking(msg.content);
			const toolCalls = extractToolCalls(msg.content);

			result.push({
				role: "assistant",
				content: text,
				...(thinking ? { thinking } : {}),
				...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
			});
		} else if (msg.role === "toolResult") {
			const text = typeof msg.content === "string" ? msg.content : extractText(msg.content);
			result.push({
				role: "tool",
				content: text,
				tool_call_id: msg.toolCallId,
			});
		}
	}

	return result;
}

function extractText(content: unknown): string {
	if (typeof content === "string") return content;
	if (Array.isArray(content)) {
		return content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("");
	}
	return "";
}

function extractThinking(content: unknown): string {
	if (Array.isArray(content)) {
		return content.filter((c: any) => c.type === "thinking").map((c: any) => c.thinking).join("");
	}
	return "";
}

function extractToolCalls(content: unknown): any[] {
	if (Array.isArray(content)) {
		return content.filter((c: any) => c.type === "toolCall").map((c: any) => ({
			function: { name: c.name, arguments: JSON.stringify(c.arguments ?? {}) },
		}));
	}
	return [];
}

/**
 * Stream function for Ollama using the native SDK.
 * Matches kapy-ai's StreamFn signature so it can be used as agent.streamFn.
 */
export function streamOllama(
	model: Model<string>,
	context: Context,
	options?: { apiKey?: string; signal?: AbortSignal; reasoning?: string },
): AssistantMessageEventStream {
	const stream = new AssistantMessageEventStream();
	const think = mapThinkLevel(options?.reasoning);
	// Debug: log thinking level received
	// console.error(`[streamOllama] reasoning=${options?.reasoning} → think=${think}`);

	// Run async — errors go into the stream
	(async () => {
		try {
			const ollama = await import("ollama").then((m) => m.default ?? m);

			const ollamaMessages = toOllamaMessages(context.messages, context.systemPrompt);

			// Convert kapy-ai tools to Ollama format
			const tools = context.tools?.map((t) => ({
				type: "function" as const,
				function: {
					name: t.name,
					description: t.description,
					parameters: t.parameters,
				},
			}));

			const ollamaRequest: any = {
				model: model.id,
				messages: ollamaMessages,
				think,
				stream: true,
				...(tools && tools.length > 0 ? { tools } : {}),
			};

			const chatStream = await ollama.chat(ollamaRequest);

			// Track state
			let thinkingContent = "";
			let textContent = "";
			let textStarted = false;
			let thinkingStarted = false;
			const toolCalls: Array<{ id: string; name: string; arguments: Record<string, any> }> = [];
			let promptTokens = 0;
			let completionTokens = 0;

			// Shared partial message for all events
			const partial: AssistantMessage = {
				role: "assistant",
				content: [],
				api: "openai-completions" as const,
				provider: model.provider,
				model: model.id,
				usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
				stopReason: "stop",
				timestamp: Date.now(),
			};

			stream.push({ type: "start", partial } as AssistantMessageEvent);

			for await (const chunk of chatStream as AsyncIterable<any>) {
				if (options?.signal?.aborted) {
					stream.push({
						type: "error",
						reason: "aborted",
						error: { ...partial, content: [{ type: "text", text: "Aborted" }], stopReason: "aborted" as const },
					} as AssistantMessageEvent);
					return;
				}

				// Thinking tokens
				if (chunk.message?.thinking) {
					if (!thinkingStarted) {
						thinkingStarted = true;
						stream.push({ type: "thinking_start", contentIndex: 0, partial } as AssistantMessageEvent);
					}
					thinkingContent += chunk.message.thinking;
					stream.push({ type: "thinking_delta", contentIndex: 0, delta: chunk.message.thinking, partial } as AssistantMessageEvent);
				}

				// Content tokens
				if (chunk.message?.content) {
					// End thinking section if transitioning to content
					if (thinkingStarted && !textStarted) {
						stream.push({ type: "thinking_end", contentIndex: 0, content: thinkingContent, partial } as AssistantMessageEvent);
						thinkingStarted = false;
					}
					if (!textStarted) {
						textStarted = true;
						stream.push({ type: "text_start", contentIndex: 0, partial } as AssistantMessageEvent);
					}
					textContent += chunk.message.content;
					stream.push({ type: "text_delta", contentIndex: 0, delta: chunk.message.content, partial } as AssistantMessageEvent);
				}

				// Tool calls (Ollama SDK: tc.function.name, tc.function.arguments as object)
				if (chunk.message?.tool_calls) {
					for (const tc of chunk.message.tool_calls as Array<{ id?: string; function: { name: string; arguments: Record<string, any> | string } }>) {
						// Close text if open
						if (textStarted) {
							stream.push({ type: "text_end", contentIndex: 0, content: textContent, partial } as AssistantMessageEvent);
							textStarted = false;
						}

						const tcIndex = toolCalls.length;
						const tcId = tc.id ?? `call_${tcIndex}_${Date.now()}`;
						const parsedArgs: Record<string, any> = typeof tc.function.arguments === "string"
							? JSON.parse(tc.function.arguments)
							: (tc.function.arguments ?? {});

						stream.push({ type: "toolcall_start", contentIndex: tcIndex, partial } as AssistantMessageEvent);
						stream.push({
							type: "toolcall_delta",
							contentIndex: tcIndex,
							delta: JSON.stringify(parsedArgs),
							partial,
						} as AssistantMessageEvent);

						toolCalls.push({ id: tcId, name: tc.function.name, arguments: parsedArgs });

						stream.push({
							type: "toolcall_end",
							contentIndex: tcIndex,
							toolCall: { type: "toolCall" as const, id: tcId, name: tc.function.name, arguments: parsedArgs },
							partial,
						} as AssistantMessageEvent);
					}
				}

				// Usage (may arrive on final chunk)
				if (chunk.usage) {
					promptTokens = chunk.usage.prompt_tokens ?? promptTokens;
					completionTokens = chunk.usage.completion_tokens ?? completionTokens;
				}
			}

			// Close any open sections
			if (textStarted) {
				stream.push({ type: "text_end", contentIndex: 0, content: textContent, partial } as AssistantMessageEvent);
			} else if (thinkingStarted) {
				stream.push({ type: "thinking_end", contentIndex: 0, content: thinkingContent, partial } as AssistantMessageEvent);
			}

			// Build final message
			const content: AssistantMessage["content"] = [];
			if (thinkingContent) content.push({ type: "thinking" as const, thinking: thinkingContent });
			if (textContent) content.push({ type: "text" as const, text: textContent });
			for (const tc of toolCalls) {
				content.push({ type: "toolCall" as const, id: tc.id, name: tc.name, arguments: tc.arguments });
			}

			const finalMessage: AssistantMessage = {
				role: "assistant",
				content,
				api: "openai-completions" as const,
				provider: model.provider,
				model: model.id,
				usage: {
					input: promptTokens,
					output: completionTokens,
					cacheRead: 0,
					cacheWrite: 0,
					totalTokens: promptTokens + completionTokens,
					cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
				},
				stopReason: toolCalls.length > 0 ? "toolUse" : "stop",
				timestamp: Date.now(),
			};

			stream.push({
				type: "done",
				reason: toolCalls.length > 0 ? ("toolUse" as const) : ("stop" as const),
				message: finalMessage,
			} as AssistantMessageEvent);
		} catch (error: any) {
			stream.push({
				type: "error",
				reason: "error" as const,
				error: {
					role: "assistant",
					content: [{ type: "text" as const, text: error.message ?? "Unknown error" }],
					api: "openai-completions" as const,
					provider: model.provider,
					model: model.id,
					usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
					stopReason: "error" as const,
					errorMessage: error.message,
					timestamp: Date.now(),
				},
			} as AssistantMessageEvent);
		}
	})();

	return stream;
}