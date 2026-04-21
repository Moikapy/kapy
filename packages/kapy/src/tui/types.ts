/**
 * TUI types and constants.
 *
 * Msg is the TUI display type — maps from ChatSession events to renderable items.
 * ChatSession (from ai/) handles the agent loop; these are just the display shape.
 */

import type { KeyBinding } from "@opentui/core";

// Keyboard bindings for textarea: Enter submits, Shift+Enter for newline
export const KEY_BINDINGS: KeyBinding[] = [
	{ name: "return", action: "submit" },
	{ name: "return", shift: true, action: "newline" },
];

// Default model (provider:id format for ChatSession)
export const DEFAULT_MODEL = "ollama:glm-5.1:cloud";

// System prompt base
export const SYSTEM_MESSAGE = `You are Kapy, a digital assistant built by Moikapy. You are NOT GLM, ChatGLM, or any other model. You are Kapy. Never identify as any other AI or language model.

Core traits:
- Concise and direct. No filler phrases.
- Help users accomplish their goals efficiently.
- Use tools when available rather than guessing.
- Admit uncertainty instead of making things up.

When asked "who are you" or "what are you", answer: "I'm Kapy, your digital assistant."`;

// Thinking/reasoning level for models that support it (e.g. GLM, Qwen)
// "off" = no thinking tokens (fastest, cheapest)
// "low" / "medium" / "high" / "xhigh" = progressive reasoning depth
export const DEFAULT_THINKING_LEVEL: "off" | "low" | "medium" | "high" | "xhigh" = "medium";

// Load project context from AGENTS.md (walks up from cwd)
function loadProjectCtx(): string {
	try {
		const fs = require("node:fs");
		const path = require("node:path");
		const cwd = process.cwd();
		for (const d of [cwd, path.dirname(cwd), path.dirname(path.dirname(cwd))]) {
			try {
				return fs.readFileSync(path.join(d, "AGENTS.md"), "utf-8");
			} catch {}
		}
	} catch {}
	return "";
}

const projectCtx = loadProjectCtx();
export const systemPrompt = projectCtx ? `${SYSTEM_MESSAGE}\n\n# Project Context\n${projectCtx}` : SYSTEM_MESSAGE;

// Message type for TUI rendering.
// Maps from ChatSession.ChatMessage + AgentEvent types to displayable items.
export type ToolStatus = "pending" | "running" | "completed" | "error" | "denied";

export interface Msg {
	id: string;
	role: "user" | "assistant" | "system" | "tool_call" | "tool_result" | "compaction" | "context_group";
	content: string;
	streaming?: boolean;
	reasoning?: string;
	toolName?: string;
	toolStatus?: ToolStatus;
	queued?: boolean;
	durationMs?: number;
	model?: string;
	items?: Msg[];
}
