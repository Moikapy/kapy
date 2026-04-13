import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { buildRegistrySchema } from "../../../src/ai/schema.js";
import { CommandRegistry } from "../../../src/command/registry.js";
import { ToolRegistry } from "../../../src/tool/registry.js";

describe("buildRegistrySchema", () => {
	test("serializes empty registries", () => {
		const commands = new CommandRegistry();
		const tools = new ToolRegistry();
		const schema = buildRegistrySchema(commands, tools);
		expect(schema.commands).toEqual([]);
		expect(schema.tools).toEqual([]);
	});

	test("serializes commands with descriptions and flags", () => {
		const commands = new CommandRegistry();
		commands.register({
			name: "install",
			options: {
				description: "Install an extension",
				flags: {
					global: { type: "boolean", description: "Install globally" },
				},
			},
			handler: async () => {},
			agentHints: { purpose: "Install a kapy extension" },
		});

		const tools = new ToolRegistry();
		const schema = buildRegistrySchema(commands, tools);

		expect(schema.commands).toHaveLength(1);
		expect(schema.commands[0].name).toBe("install");
		expect(schema.commands[0].description).toBe("Install an extension");
		expect(schema.commands[0].agentHints?.purpose).toBe("Install a kapy extension");
		expect(schema.commands[0].flags).toBeDefined();
	});

	test("serializes tools with Zod→JSON Schema params", () => {
		const tools = new ToolRegistry();
		tools.register({
			name: "read-file",
			label: "Read File",
			description: "Read a file's contents",
			parameters: z.object({
				path: z.string().describe("File path"),
				offset: z.number().optional().describe("Line offset"),
			}),
			execute: async () => ({ content: [], details: {} }),
		});

		const commands = new CommandRegistry();
		const schema = buildRegistrySchema(commands, tools);

		expect(schema.tools).toHaveLength(1);
		expect(schema.tools[0].name).toBe("read-file");
		expect(schema.tools[0].label).toBe("Read File");
		expect(schema.tools[0].parameters).toEqual({
			type: "object",
			properties: {
				path: { type: "string", description: "File path" },
				offset: { type: "number", description: "Line offset" },
			},
			required: ["path"],
		});
	});

	test("includes promptSnippet and promptGuidelines in tool schema", () => {
		const tools = new ToolRegistry();
		tools.register({
			name: "my-tool",
			label: "My Tool",
			description: "Does something",
			parameters: z.object({ input: z.string() }),
			promptSnippet: "Summarize or transform text",
			promptGuidelines: ["Always use this for text operations"],
			execute: async () => ({ content: [], details: {} }),
		});

		const commands = new CommandRegistry();
		const schema = buildRegistrySchema(commands, tools);

		expect(schema.tools[0].promptSnippet).toBe("Summarize or transform text");
		expect(schema.tools[0].promptGuidelines).toEqual(["Always use this for text operations"]);
	});
});
