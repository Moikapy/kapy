/**
 * Chat backend — bridges TUI to OllamaAdapter + tool registry.
 *
 * This module provides the streaming chat function used by the TUI,
 * plus tool registration and model listing. Keeps the TUI component
 * (app.tsx) clean of provider internals.
 */

import { OllamaAdapter } from "../ai/provider/ollama.js";
import { ToolRegistry } from "../tool/registry.js";
import { readFileTool, writeFileTool, bashTool, globTool, grepTool } from "../tool/builtin/index.js";
import type { StreamChatOptions, StreamChunk } from "../ai/provider/types.js";

/** Singleton Ollama adapter */
export const ollama = new OllamaAdapter();

/** Tool registry with built-in tools pre-registered */
export const tools = new ToolRegistry();
tools.register(readFileTool);
tools.register(writeFileTool);
tools.register(bashTool);
tools.register(globTool);
tools.register(grepTool);

/** Fetch available models from Ollama */
export async function fetchModels(): Promise<string[]> {
	try {
		const models = await ollama.listModels();
		return models.map(m => m.id).sort();
	} catch {
		return [];
	}
}

/** Message format for TUI rendering */
export interface ChatMsg {
	id: string;
	role: "user" | "assistant" | "system";
	content: string;
	streaming?: boolean;
	reasoning?: string;
}

/** System prompt with optional project context */
export function buildSystemPrompt(projectCtx: string): string {
	const base = "You are Kapy, an agent-first CLI assistant. Be concise and direct.";
	return projectCtx ? `${base}\n\n# Project Context\n${projectCtx}` : base;
}

/** Load AGENTS.md from project directory */
export function loadProjectContext(): string {
	try {
		const fs = require("fs") as typeof import("fs");
		const path = require("path") as typeof import("path");
		const cwd = process.cwd();
		for (const d of [cwd, path.dirname(cwd), path.dirname(path.dirname(cwd))]) {
			try { return fs.readFileSync(path.join(d, "AGENTS.md"), "utf-8"); } catch {}
		}
	} catch {}
	return "";
}

/**
 * Stream a chat completion from Ollama. Yields content chunks.
 * Handles reasoning_content from GLM models separately.
 * Returns { content, reasoning } pairs for the TUI to display.
 */
export async function* streamChat(
	model: string,
	messages: Array<{ role: string; content: string }>,
	signal?: AbortSignal,
): AsyncGenerator<{ type: "content" | "reasoning"; text: string }> {
	const options: StreamChatOptions = {
		model: ollama.stripProviderPrefix(model),
		messages: messages.map(m => ({ role: m.role as "system" | "user" | "assistant", content: m.content })),
		stream: true,
		signal,
		temperature: 0.7,
		maxTokens: 4096,
	};

	for await (const chunk of ollama.streamChat(options)) {
		if (chunk.type === "text" && chunk.text) {
			yield { type: "content", text: chunk.text };
		}
		if (chunk.type === "done") {
			return;
		}
	}
}

/**
 * Stream a chat using raw fetch (fallback for models that return reasoning_content).
 * This handles the GLM-5.1 style delta.reasoning_content field.
 */
export async function* streamChatRaw(
	model: string,
	messages: Array<{ role: string; content: string }>,
	signal?: AbortSignal,
): AsyncGenerator<{ type: "content" | "reasoning"; text: string }> {
	const res = await fetch("http://localhost:11434/v1/chat/completions", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ model, messages, stream: true }),
		signal,
	});

	if (!res.ok) throw new Error("Ollama: " + (await res.text().catch(() => res.statusText)));
	if (!res.body) throw new Error("No body");

	const reader = res.body.getReader();
	const dec = new TextDecoder();
	let buf = "";

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			buf += dec.decode(value, { stream: true });
			const lines = buf.split("\n");
			buf = lines.pop() || "";
			for (const line of lines) {
				const data = line.startsWith("data: ") ? line.slice(6) : line;
				if (data === "[DONE]") return;
				try {
					const p = JSON.parse(data);
					const delta = p.choices?.[0]?.delta;
					if (delta?.content) yield { type: "content", text: delta.content };
					if (delta?.reasoning_content) yield { type: "reasoning", text: delta.reasoning_content };
					// Also handle OpenAI-compatible tool_calls if present
					if (delta?.tool_calls) {
						for (const tc of delta.tool_calls) {
							if (tc.function?.name) {
								yield { type: "content", text: `\n[Tool: ${tc.function.name}]` };
							}
						}
					}
				} catch {}
			}
		}
	} finally {
		reader.releaseLock();
	}
}