import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { CommandRegistry } from "../../../src/command/registry.js";
import { ExtensionAPI } from "../../../src/extension/api.js";
import { ExtensionEmitter } from "../../../src/hooks/emitter.js";
import { ToolRegistry } from "../../../src/tool/registry.js";
import type { KapyToolRegistration } from "../../../src/tool/types.js";

function makeApi(): {
	api: ExtensionAPI;
	registry: CommandRegistry;
	tools: ToolRegistry;
	hooks: Map<string, any[]>;
	middlewares: any[];
	screens: any[];
	configSchemas: Map<string, any>;
	emitter: ExtensionEmitter;
	providers: Map<string, any>;
} {
	const registry = new CommandRegistry();
	const tools = new ToolRegistry();
	const hooks = new Map();
	const middlewares: any[] = [];
	const screens: any[] = [];
	const configSchemas = new Map();
	const emitter = new ExtensionEmitter();
	const providers = new Map();

	const api = new ExtensionAPI({
		registry,
		tools,
		hooks,
		middlewares,
		screens,
		configSchemas,
		emitter,
		providers,
		extensionName: "test-ext",
	});

	return { api, registry, tools, hooks, middlewares, screens, configSchemas, emitter, providers };
}

function makeTool(overrides: Partial<KapyToolRegistration> = {}): KapyToolRegistration {
	return {
		name: "test-tool",
		label: "Test Tool",
		description: "A test tool",
		parameters: z.object({ input: z.string() }),
		execute: async () => ({ content: [{ type: "text", text: "ok" }], details: {} }),
		...overrides,
	};
}

describe("ExtensionAPI.registerTool", () => {
	test("registers a tool via registerTool()", () => {
		const { api, tools } = makeApi();
		const tool = makeTool();
		api.registerTool(tool);
		expect(tools.has("test-tool")).toBe(true);
	});

	test("registerTool() validates the tool definition", () => {
		const { api } = makeApi();
		expect(() => api.registerTool(makeTool({ name: "BAD" }))).toThrow();
	});

	test("registerTool() delegates to ToolRegistry.register", () => {
		const { api, tools } = makeApi();
		const tool1 = makeTool({ name: "first" });
		const tool2 = makeTool({ name: "second" });
		api.registerTool(tool1);
		api.registerTool(tool2);
		expect(tools.toolCount).toBe(2);
	});
});

describe("ExtensionAPI.registerProvider", () => {
	test("registers a provider configuration", () => {
		const { api, providers } = makeApi();
		api.registerProvider("ollama", {
			name: "Ollama",
			baseUrl: "http://localhost:11434",
		});
		expect(providers.has("ollama")).toBe(true);
		expect(providers.get("ollama")?.name).toBe("Ollama");
	});

	test("unregisterProvider removes a provider", () => {
		const { api, providers } = makeApi();
		api.registerProvider("ollama", { name: "Ollama" });
		expect(providers.has("ollama")).toBe(true);
		api.unregisterProvider("ollama");
		expect(providers.has("ollama")).toBe(false);
	});
});
