/**
 * Agent types — state, message types, thinking levels.
 */

/** Thinking/reasoning level (pi pattern) */
export type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh";

/** Model reference */
export interface ModelRef {
	id: string;
	provider: string;
	[key: string]: unknown;
}

/** Agent message (simplified — full message types from session) */
export interface AgentMessage {
	role: "user" | "assistant" | "tool" | "system" | "custom";
	content: string;
	timestamp?: number;
	toolCalls?: unknown[];
	customType?: string;
	display?: boolean;
	metadata?: Record<string, unknown>;
}

/** Agent state */
export interface AgentState {
	systemPrompt: string;
	model: ModelRef | null;
	thinkingLevel: ThinkingLevel;
	messages: AgentMessage[];
	isStreaming: boolean;
	pendingToolCalls: Set<string>;
	error?: string;
}

/** Agent event types */
export type AgentEvent =
	| { type: "agent_start" }
	| { type: "agent_end"; messages: AgentMessage[] }
	| { type: "turn_start" }
	| { type: "turn_end"; message: AgentMessage; toolResults: unknown[] }
	| { type: "message_start"; message: AgentMessage }
	| { type: "message_update"; message: AgentMessage }
	| { type: "message_end"; message: AgentMessage }
	| { type: "error"; error: string };

/** Steering mode (pi pattern) */
export type SteeringMode = "all" | "one-at-a-time";

/** Follow-up mode (pi pattern) */
export type FollowUpMode = "all" | "one-at-a-time";
