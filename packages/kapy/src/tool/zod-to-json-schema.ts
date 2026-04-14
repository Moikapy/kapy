import type { z } from "zod";

/**
 * Convert a Zod v4 schema to JSON Schema for tool definitions.
 *
 * Zod v4 uses `_def.type` (string) instead of v3's `_def.typeName`.
 * Shape fields in objects have `.def` and `.type` properties.
 */
export function zodToJsonSchema(schema: z.ZodType): Record<string, unknown> {
	return convert(schema);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function convert(schema: any): Record<string, unknown> {
	const def = schema._def || schema.def;
	if (!def) return {};

	const result = convertDef(def, schema);

	// Attach description if present (from .describe())
	if (schema.description) {
		result.description = schema.description;
	}

	return result;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function convertDef(def: any, _schema?: any): Record<string, unknown> {
	const type = def.type;

	switch (type) {
		case "string":
			return { type: "string" };

		case "number":
			return { type: "number" };

		case "boolean":
			return { type: "boolean" };

		case "array": {
			// Zod v4: def.element or def.elementType
			const element = def.element || def.elementType;
			return {
				type: "array",
				items: element ? convert(element) : {},
			};
		}

		case "object": {
			const shape = typeof def.shape === "function" ? def.shape() : def.shape;
			const properties: Record<string, unknown> = {};
			const required: string[] = [];

			for (const [key, value] of Object.entries(shape)) {
				// Zod v4 wraps shape values with .def and .type
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const fieldSchema = value as any;
				properties[key] = convert(fieldSchema);

				// Optional and default fields are not required
				const fieldType = fieldSchema._def?.type || fieldSchema.def?.type || fieldSchema.type;
				if (fieldType !== "optional" && fieldType !== "default") {
					required.push(key);
				}
			}

			const result: Record<string, unknown> = {
				type: "object",
				properties,
			};
			if (required.length > 0) {
				result.required = required;
			}
			return result;
		}

		case "optional":
			return convert(def.innerType);

		case "default": {
			const inner = convert(def.innerType);
			if (def.defaultValue !== undefined) {
				inner.default = typeof def.defaultValue === "function" ? def.defaultValue() : def.defaultValue;
			}
			return inner;
		}

		case "enum": {
			// Zod v4: def.entries is an object { a: "a", b: "b" }
			const entries = def.entries || def.values;
			const values = Array.isArray(entries) ? entries : Object.values(entries || {});
			return { type: "string", enum: values };
		}

		case "literal": {
			// Zod v4: def.values is an array
			const values = def.values || [def.value];
			if (values.length === 1) {
				return { const: values[0] };
			}
			return { enum: values };
		}

		case "union":
			return { anyOf: (def.options || []).map(convert) };

		case "record": {
			// Zod v4: def.keyType, def.valueType
			return {
				type: "object",
				additionalProperties: def.valueType ? convert(def.valueType) : {},
			};
		}

		case "tuple":
			return {
				type: "array",
				prefixItems: (def.items || []).map(convert),
				items: false,
			};

		case "nullable":
			return {
				anyOf: [convert(def.innerType), { type: "null" }],
			};

		case "any":
		case "unknown":
		case "undefined":
		case "null":
			return {};

		case "effects": {
			// .describe(), .default(), .transform() wrap in ZodEffects
			// The inner schema has the real type
			return convert(def.schema);
		}

		default:
			// Try to get inner type for wrappers we don't recognize
			if (def.innerType) return convert(def.innerType);
			return {};
	}
}
