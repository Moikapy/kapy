/**
 * Tool bridge — converts kapy's Zod-based KapyToolRegistration to kapy-agent's TypeBox AgentTool.
 *
 * Kapy uses Zod for parameter schemas. kapy-agent uses TypeBox (from kapy-ai).
 * This bridge handles the conversion at registration time.
 */

import type { AgentTool, AgentToolResult } from "@moikapy/kapy-agent";
import type { KapyToolRegistration, ToolResult } from "../tool/types.js";
import { zodToJsonSchema } from "../tool/zod-to-json-schema.js";
import { Type } from "@sinclair/typebox";

/**
 * Convert a KapyToolRegistration to an AgentTool for use with kapy-agent.
 */
export function kapyToolToAgentTool(tool: KapyToolRegistration): AgentTool {
	// Convert Zod → JSON Schema → TypeBox-compatible schema
	const jsonSchema = zodToJsonSchema(tool.parameters);

	// Build TypeBox Object schema from JSON Schema properties
	const properties: Record<string, unknown> = {};
	if (jsonSchema.properties && typeof jsonSchema.properties === "object") {
		for (const [key, value] of Object.entries(jsonSchema.properties as Record<string, unknown>)) {
			properties[key] = value;
		}
	}
	const parameters = Type.Object(properties as any);

	return {
		name: tool.name,
		label: tool.label,
		description: tool.description,
		parameters,
		prepareArguments: tool.prepareArguments
			? (args: unknown) => tool.prepareArguments!(args as Record<string, unknown>)
			: undefined,
		execute: async (toolCallId, params, signal, onUpdate) => {
			const result = await tool.execute(
				toolCallId,
				params as Record<string, unknown>,
				signal,
				onUpdate
					? (partialResult: ToolResult) => {
							onUpdate({
								content: partialResult.content,
								details: partialResult.details,
							});
						}
					: () => {},
				{ cwd: process.cwd(), signal: signal ?? new AbortController().signal },
			);

			return {
				content: result.content,
				details: result.details,
			} as AgentToolResult<unknown>;
		},
	};
}

/**
 * Convert all registered kapy tools to AgentTool format.
 */
export function kapyToolsToAgentTools(tools: KapyToolRegistration[]): AgentTool[] {
	return tools.map(kapyToolToAgentTool);
}