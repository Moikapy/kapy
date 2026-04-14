import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { zodToJsonSchema } from "../../../src/tool/zod-to-json-schema.js";

describe("zodToJsonSchema", () => {
	test("converts z.string()", () => {
		expect(zodToJsonSchema(z.string())).toEqual({ type: "string" });
	});

	test("converts z.number()", () => {
		expect(zodToJsonSchema(z.number())).toEqual({ type: "number" });
	});

	test("converts z.boolean()", () => {
		expect(zodToJsonSchema(z.boolean())).toEqual({ type: "boolean" });
	});

	test("converts z.array(z.string())", () => {
		expect(zodToJsonSchema(z.array(z.string()))).toEqual({
			type: "array",
			items: { type: "string" },
		});
	});

	test("converts z.object with required fields", () => {
		const schema = z.object({
			name: z.string(),
			count: z.number(),
		});
		const result = zodToJsonSchema(schema);
		expect(result).toEqual({
			type: "object",
			properties: {
				name: { type: "string" },
				count: { type: "number" },
			},
			required: ["name", "count"],
		});
	});

	test("converts z.optional — omits from required", () => {
		const schema = z.object({
			name: z.string(),
			nick: z.optional(z.string()),
		});
		const result = zodToJsonSchema(schema);
		expect(result).toEqual({
			type: "object",
			properties: {
				name: { type: "string" },
				nick: { type: "string" },
			},
			required: ["name"],
		});
	});

	test("converts z.enum", () => {
		expect(zodToJsonSchema(z.enum(["a", "b"]))).toEqual({
			type: "string",
			enum: ["a", "b"],
		});
	});

	test("converts z.literal", () => {
		expect(zodToJsonSchema(z.literal("foo"))).toEqual({ const: "foo" });
	});

	test("converts z.literal number", () => {
		expect(zodToJsonSchema(z.literal(42))).toEqual({ const: 42 });
	});

	test("converts z.union", () => {
		expect(zodToJsonSchema(z.union([z.string(), z.number()]))).toEqual({
			anyOf: [{ type: "string" }, { type: "number" }],
		});
	});

	test("converts .describe()", () => {
		expect(zodToJsonSchema(z.string().describe("A name"))).toEqual({
			type: "string",
			description: "A name",
		});
	});

	test("converts .default()", () => {
		expect(zodToJsonSchema(z.string().default("hello"))).toEqual({
			type: "string",
			default: "hello",
		});
	});

	test("converts nested object", () => {
		const schema = z.object({
			config: z.object({
				port: z.number(),
			}),
		});
		const result = zodToJsonSchema(schema);
		expect(result).toEqual({
			type: "object",
			properties: {
				config: {
					type: "object",
					properties: {
						port: { type: "number" },
					},
					required: ["port"],
				},
			},
			required: ["config"],
		});
	});

	test("converts z.record", () => {
		expect(zodToJsonSchema(z.record(z.string(), z.string()))).toEqual({
			type: "object",
			additionalProperties: { type: "string" },
		});
	});

	test("converts z.tuple", () => {
		expect(zodToJsonSchema(z.tuple([z.string(), z.number()]))).toEqual({
			type: "array",
			prefixItems: [{ type: "string" }, { type: "number" }],
			items: false,
		});
	});

	test("converts z.nullable", () => {
		expect(zodToJsonSchema(z.string().nullable())).toEqual({
			anyOf: [{ type: "string" }, { type: "null" }],
		});
	});

	test("converts z.any / z.unknown passthrough", () => {
		// Should produce empty schema (anything goes)
		const result = zodToJsonSchema(z.any());
		expect(result).toEqual({});
	});

	test("converts complex tool schema", () => {
		const schema = z.object({
			path: z.string().describe("File path to read"),
			offset: z.number().optional().describe("Line offset"),
			limit: z.number().optional().describe("Max lines"),
		});
		const result = zodToJsonSchema(schema);
		expect(result).toEqual({
			type: "object",
			properties: {
				path: { type: "string", description: "File path to read" },
				offset: { type: "number", description: "Line offset" },
				limit: { type: "number", description: "Max lines" },
			},
			required: ["path"],
		});
	});
});
