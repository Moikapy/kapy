import type { z } from "zod";

/** Text content in tool results */
export interface TextContent {
	type: "text";
	text: string;
}

/** Image content in tool results */
export interface ImageContent {
	type: "image";
	data: string; // base64
	mimeType: string;
}

/** Tool result returned from execute() */
export interface ToolResult {
	content: (TextContent | ImageContent)[];
	details: Record<string, unknown>;
}

/** Callback for streaming partial results during tool execution */
export type ToolUpdateCallback = (partialResult: ToolResult) => void;

/** Context passed to tool execute() */
export interface ToolExecutionContext {
	cwd: string;
	signal: AbortSignal | undefined;
}

/** Tool registration definition (pi-aligned) */
export interface KapyToolRegistration {
	/** Tool name — lowercase, hyphens/underscores allowed */
	name: string;
	/** Display name */
	label: string;
	/** What this tool does */
	description: string;
	/** One-liner for system prompt "Available tools" section (pi pattern) */
	promptSnippet?: string;
	/** Guidelines appended to system prompt when tool is active (pi pattern) */
	promptGuidelines?: string[];
	/** Zod schema for parameters */
	parameters: z.ZodType;
	/** Compatibility shim before validation (pi pattern) */
	prepareArguments?: (args: Record<string, unknown>) => Record<string, unknown>;
	/** Execute the tool */
	execute: (
		toolCallId: string,
		params: Record<string, unknown>,
		signal: AbortSignal | undefined,
		onUpdate: ToolUpdateCallback,
		ctx: ToolExecutionContext,
	) => Promise<ToolResult>;
	/** Whether this tool only reads data (no side effects) */
	isReadOnly?: (params: Record<string, unknown>) => boolean;
	/** Whether this tool is safe to run concurrently */
	isConcurrencySafe?: (params: Record<string, unknown>) => boolean;
}
