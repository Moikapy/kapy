/**
 * Overflow detection — recognizes context window overflow from LLM error responses.
 *
 * Ported from pi-mono's overflow detection logic. Covers 18+ regex patterns
 * across providers: Anthropic, OpenAI, Google, xAI, Groq, OpenRouter,
 * llama.cpp, LM Studio, Ollama, Cerebras, Mistral, etc.
 *
 * Two detection paths:
 * 1. Error-based: stopReason="error" + errorMessage matches a known provider pattern
 * 2. Silent: stopReason="stop" but actual input tokens exceed contextWindow
 */

import type { AssistantMessage } from "@moikapy/kapy-ai";

const OVERFLOW_PATTERNS: RegExp[] = [
	/your request exceeded the context window/i,
	/request too large.*context/i,
	/input too long.*model.s maximum context length/i,
	/max.*context.*length.*exceeded/i,
	/context.*window.*exceeded/i,
	/input.*exceeds.*token limit/i,
	/maximum context length exceeded/i,
	/token limit reached/i,
	/reduce the length of the messages/i,
	/reduce the length of your prompt/i,
	/prompt has too many tokens/i,
	/token count exceeded/i,
	/content size exceeds model limit/i,
	/400.*context_length_exceeded/i,
	/400.*request_too_large/i,
	/413.*request entity too large/i,
	/context length exceeded.*try/i,
	/input is too long/i,
];

const NOT_OVERFLOW_PATTERNS: RegExp[] = [
	/rate.limit/i,
	/throttl/i,
	/429/,
	/quota/i,
	/payment/i,
	/billing/i,
	/insufficient_quota/i,
	/plan.limit/i,
];

export function isContextOverflow(message: AssistantMessage, contextWindow?: number): boolean {
	if (message.stopReason === "error" && message.errorMessage) {
		const err = message.errorMessage;
		if (NOT_OVERFLOW_PATTERNS.some((p) => p.test(err))) return false;
		if (OVERFLOW_PATTERNS.some((p) => p.test(err))) return true;
	}

	if (contextWindow && contextWindow > 0 && message.stopReason === "stop" && message.usage) {
		const { input, cacheRead, cacheWrite } = message.usage;
		if (input + cacheRead + cacheWrite > contextWindow) return true;
	}

	return false;
}
