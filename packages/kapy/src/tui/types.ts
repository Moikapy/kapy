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
export const SYSTEM_MESSAGE = "You are Kapy, a human-first Digital Assistant. Be concise and direct.";

// Load project context from AGENTS.md (walks up from cwd)
function loadProjectCtx(): string {
	try {
		const fs = require("fs");
		const path = require("path");
		const cwd = process.cwd();
		for (const d of [cwd, path.dirname(cwd), path.dirname(path.dirname(cwd))]) {
			try { return fs.readFileSync(path.join(d, "AGENTS.md"), "utf-8"); } catch { }
		}
	} catch { }
	return "";
}

const projectCtx = loadProjectCtx();
export const systemPrompt = projectCtx ? `${SYSTEM_MESSAGE}\n\n# Project Context\n${projectCtx}` : SYSTEM_MESSAGE;

// Message type for TUI rendering.
// Maps from ChatSession.ChatMessage + AgentEvent types to displayable items.
export interface Msg {
	id: string;
	role: "user" | "assistant" | "system" | "tool_call" | "tool_result";
	content: string;
	streaming?: boolean;
	reasoning?: string;
	toolName?: string;
}