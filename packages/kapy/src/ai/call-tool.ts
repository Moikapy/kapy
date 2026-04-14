/**
 * Tool invocation — resolves, validates, and executes tools.
 * Used by `kapy call <tool> --input` and the agent loop.
 */

import type { ToolRegistry } from "../tool/registry.js";
import type { ToolResult } from "../tool/types.js";

export interface CallToolOptions {
	signal?: AbortSignal;
	cwd?: string;
	dryRun?: boolean;
}

/**
 * Call a tool by name with validated input.
 * Returns ToolResult, or a dry-run description if dryRun is true.
 */
export async function callTool(
	registry: ToolRegistry,
	toolName: string,
	input: Record<string, unknown>,
	options: CallToolOptions = {},
): Promise<ToolResult | Record<string, unknown>> {
	const tool = registry.get(toolName);
	if (!tool) {
		throw new Error(`Tool not found: ${toolName}`);
	}

	// Apply prepareArguments shim (pi pattern)
	let prepared = input;
	if (tool.prepareArguments) {
		prepared = tool.prepareArguments(input);
	}

	// Validate input against Zod schema
	const parsed = tool.parameters.safeParse(prepared);
	if (!parsed.success) {
		throw new Error(`Invalid input for tool "${toolName}": ${parsed.error.message}`);
	}

	// Dry-run mode: return description without executing
	if (options.dryRun) {
		return {
			dryRun: true,
			tool: toolName,
			input: prepared,
			description: tool.description,
		};
	}

	// Execute the tool
	const toolCallId = crypto.randomUUID();
	const ctx = {
		cwd: options.cwd ?? process.cwd(),
		signal: options.signal,
	};

	return tool.execute(toolCallId, parsed.data as Record<string, unknown>, options.signal, () => {}, ctx);
}
