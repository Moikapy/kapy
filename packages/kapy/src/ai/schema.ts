/**
 * Schema serialization — builds JSON schema from command + tool registries.
 * Used by `kapy schema --json` for agent tool discovery.
 */

import type { CommandRegistry } from "../command/registry.js";
import type { ToolRegistry } from "../tool/registry.js";
import { zodToJsonSchema } from "../tool/zod-to-json-schema.js";

interface CommandSchema {
	name: string;
	description: string;
	args?: unknown[];
	flags?: Record<string, unknown>;
	hidden?: boolean;
	agentHints?: Record<string, unknown>;
}

interface ToolSchema {
	name: string;
	label: string;
	description: string;
	parameters: Record<string, unknown>;
	promptSnippet?: string;
	promptGuidelines?: string[];
	isReadOnly?: boolean;
	isConcurrencySafe?: boolean;
}

interface RegistrySchema {
	commands: CommandSchema[];
	tools: ToolSchema[];
}

/**
 * Build a JSON-serializable schema from command and tool registries.
 */
export function buildRegistrySchema(commands: CommandRegistry, tools: ToolRegistry): RegistrySchema {
	const commandSchemas: CommandSchema[] = commands.all().map((cmd) => ({
		name: cmd.name,
		description: cmd.options.description,
		args: cmd.options.args?.map((a) => ({
			name: a.name,
			description: a.description,
			required: a.required,
			default: a.default,
			variadic: a.variadic,
		})),
		flags: cmd.options.flags
			? Object.fromEntries(
					Object.entries(cmd.options.flags).map(([key, def]) => [
						key,
						{
							type: def.type,
							description: def.description,
							default: def.default,
							alias: def.alias,
							required: def.required,
						},
					]),
				)
			: undefined,
		hidden: cmd.options.hidden,
		agentHints: cmd.agentHints as Record<string, unknown> | undefined,
	}));

	const toolSchemas: ToolSchema[] = tools.all().map((tool) => ({
		name: tool.name,
		label: tool.label,
		description: tool.description,
		parameters: zodToJsonSchema(tool.parameters),
		promptSnippet: tool.promptSnippet,
		promptGuidelines: tool.promptGuidelines,
		isReadOnly: tool.isReadOnly ? true : undefined,
		isConcurrencySafe: tool.isConcurrencySafe ? true : undefined,
	}));

	return { commands: commandSchemas, tools: toolSchemas };
}
