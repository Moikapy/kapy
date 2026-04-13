/**
 * Provider types — model info, provider config, stream types.
 */

/** Information about a specific model */
export interface ModelInfo {
	/** Model identifier (e.g., "llama3.2", "gpt-4o") */
	id: string;
	/** Human-readable label */
	label?: string;
	/** Max context length in tokens */
	contextLength?: number;
	/** Whether model supports image inputs */
	supportsVision?: boolean;
	/** Whether model supports extended reasoning */
	supportsReasoning?: boolean;
	/** Which provider owns this model */
	provider: string;
	/** Parameter size (e.g., "7B", "70B") */
	parameterSize?: string;
	/** Model family (e.g., "llama", "gpt") */
	family?: string;
	/** Additional metadata */
	[key: string]: unknown;
}

/** Provider configuration */
export interface ProviderConfig {
	/** Unique provider ID (e.g., "ollama", "openai") */
	id: string;
	/** Human-readable provider name */
	name: string;
	/** Base URL for API calls */
	baseUrl?: string;
	/** API key (or env var name) */
	apiKey?: string;
	/** Provider type */
	type: "ollama" | "openai" | "anthropic" | "custom";
	/** Pre-configured models */
	models?: ModelInfo[];
	/** Whether this provider is available (detectable) */
	available?: boolean;
	/** Additional metadata */
	[key: string]: unknown;
}

/** Chat message format for provider calls */
export interface ChatMessage {
	role: "system" | "user" | "assistant" | "tool";
	content: string;
	toolCallId?: string;
}

/** Options for streaming chat */
export interface StreamChatOptions {
	model: string;
	messages: ChatMessage[];
	temperature?: number;
	maxTokens?: number;
	signal?: AbortSignal;
	tools?: unknown[];
}

/** Token usage info */
export interface TokenUsage {
	inputTokens: number;
	outputTokens: number;
}

/** Chunk from a streaming response */
export interface StreamChunk {
	type: "text" | "tool_call" | "usage" | "done";
	text?: string;
	toolCallId?: string;
	toolName?: string;
	toolArgs?: string;
	usage?: TokenUsage;
}

/** Provider adapter interface — implement for each provider */
export interface ProviderAdapter {
	/** List available models */
	listModels(): Promise<ModelInfo[]>;
	/** Check if provider is available */
	isAvailable(): Promise<boolean>;
	/** Stream chat completion */
	streamChat(options: StreamChatOptions): AsyncGenerator<StreamChunk>;
	/** Non-streaming chat */
	chat(options: StreamChatOptions): Promise<{ content: string; usage: TokenUsage }>;
}
