/**
 * Tests for parseArgs positional arg mapping, required arg validation,
 * and flag type coercion.
 */
import { describe, expect, it } from "bun:test";
import type { ArgDefinition, FlagDefinition } from "../../src/command/parser.js";
import { parseArgs } from "../../src/command/registry.js";

// ─── Positional arg mapping ──────────────────────────────────

describe("parseArgs positional args", () => {
	const argDefs: ArgDefinition[] = [
		{ name: "input", required: true, description: "Input file" },
		{ name: "output", description: "Output file" },
	];

	it("maps positional args to declared names in order", () => {
		const { args, rest } = parseArgs(["myfile.txt", "output.txt"], undefined, argDefs);
		expect(args.input).toBe("myfile.txt");
		expect(args.output).toBe("output.txt");
		expect(rest).toEqual([]);
	});

	it("falls back to default for missing optional args", () => {
		const argsWithDefault: ArgDefinition[] = [
			{ name: "input", required: true, description: "Input" },
			{ name: "output", default: "out.txt", description: "Output" },
		];
		const { args } = parseArgs(["myfile.txt"], undefined, argsWithDefault);
		expect(args.input).toBe("myfile.txt");
		expect(args.output).toBe("out.txt");
	});

	it("puts extra positional args into rest", () => {
		const { args, rest } = parseArgs(["myfile.txt", "output.txt", "extra1", "extra2"], undefined, argDefs);
		expect(args.input).toBe("myfile.txt");
		expect(args.output).toBe("output.txt");
		expect(rest).toEqual(["extra1", "extra2"]);
	});

	it("handles variadic args consuming all remaining positionals", () => {
		const variadicDefs: ArgDefinition[] = [
			{ name: "cmd", required: true, description: "Command" },
			{ name: "files", variadic: true, description: "Files" },
		];
		const { args, rest } = parseArgs(["build", "a.ts", "b.ts", "c.ts"], undefined, variadicDefs);
		expect(args.cmd).toBe("build");
		expect(args.files).toEqual(["a.ts", "b.ts", "c.ts"]);
		expect(rest).toEqual([]);
	});

	it("reports missing required args in _errors", () => {
		const { args } = parseArgs([], undefined, argDefs);
		const errors = (args as Record<string, unknown>)._errors as string[];
		expect(errors).toBeDefined();
		expect(errors?.length).toBeGreaterThan(0);
		expect(errors?.[0]).toContain("input");
	});

	it("does not report errors when all required args are present", () => {
		const { args } = parseArgs(["myfile.txt"], undefined, argDefs);
		expect((args as Record<string, unknown>)._errors).toBeUndefined();
	});
});

// ─── Flag type coercion ───────────────────────────────────────

describe("parseArgs flag type coercion", () => {
	const flags: Record<string, FlagDefinition> = {
		port: { type: "number", description: "Port number" },
		verbose: { type: "boolean", description: "Verbose output" },
		name: { type: "string", description: "Name" },
	};

	it("coerces --flag=value for number type", () => {
		const { args } = parseArgs(["--port=3000"], flags);
		expect(args.port).toBe(3000);
		expect(typeof args.port).toBe("number");
	});

	it("coerces --flag value for number type", () => {
		const { args } = parseArgs(["--port", "8080"], flags);
		expect(args.port).toBe(8080);
	});

	it("coerces boolean flags with --flag=value", () => {
		const { args } = parseArgs(["--verbose=true"], flags);
		expect(args.verbose).toBe(true);
	});

	it("coerces --no-flag as boolean false", () => {
		const { args } = parseArgs(["--no-verbose"], flags);
		expect(args.verbose).toBe(false);
	});

	it("leaves string type flags as strings", () => {
		const { args } = parseArgs(["--name=hello"], flags);
		expect(args.name).toBe("hello");
		expect(typeof args.name).toBe("string");
	});

	it("handles --flag value for string type", () => {
		const { args } = parseArgs(["--name", "world"], flags);
		expect(args.name).toBe("world");
	});

	it("does not consume next arg if it looks like a flag for known flag types", () => {
		const { args } = parseArgs(["--port", "--verbose"], flags);
		// --port should use default (undefined) since --verbose looks like a flag, not a value
		expect(args.port).toBeUndefined();
		expect(args.verbose).toBe(true);
	});
});

// ─── Short flag aliases with coercion ────────────────────────

describe("parseArgs short aliases with type coercion", () => {
	const flags: Record<string, FlagDefinition> = {
		port: { type: "number", alias: "p", description: "Port" },
		verbose: { type: "boolean", alias: "v", description: "Verbose" },
	};

	it("coerces short alias value for number type", () => {
		const { args } = parseArgs(["-p", "3000"], flags);
		expect(args.port).toBe(3000);
	});

	it("handles boolean short aliases", () => {
		const { args } = parseArgs(["-v"], flags);
		expect(args.verbose).toBe(true);
	});
});
