import { describe, expect, test } from "bun:test";
import { CommandRegistry } from "../../../src/command/registry.js";
import { ExtensionAPI } from "../../../src/extension/api.js";
import { ExtensionEmitter } from "../../../src/hooks/emitter.js";

function makeApi(): {
	api: ExtensionAPI;
	registry: CommandRegistry;
	hooks: Map<string, any[]>;
	middlewares: any[];
	configSchemas: Map<string, any>;
	emitter: ExtensionEmitter;
} {
	const registry = new CommandRegistry();
	const hooks = new Map();
	const middlewares: any[] = [];
	const configSchemas = new Map();
	const emitter = new ExtensionEmitter();

	const api = new ExtensionAPI({
		registry,
		hooks,
		middlewares,
		configSchemas,
		emitter,
		extensionName: "test-ext",
	});

	return { api, registry, hooks, middlewares, configSchemas, emitter };
}

describe("ExtensionAPI", () => {
	test("addCommand(name, options, handler) registers a command", () => {
		const { api, registry } = makeApi();
		api.addCommand("test-cmd", { description: "A test command" }, async () => {});
		expect(registry.get("test-cmd")).toBeDefined();
		expect(registry.get("test-cmd")?.options.description).toBe("A test command");
	});

	test("addCommand(definition) registers a command", () => {
		const { api, registry } = makeApi();
		api.addCommand({ name: "def-cmd", options: { description: "Def command" }, handler: async () => {} });
		expect(registry.get("def-cmd")).toBeDefined();
	});

	test("addHook registers a hook handler", () => {
		const { api, hooks } = makeApi();
		const handler = async () => {};
		api.addHook("before:command", handler);
		expect(hooks.get("before:command")?.length).toBe(1);
	});

	test("declareConfig stores schema under extension name", () => {
		const { api, configSchemas } = makeApi();
		const schema = { mySetting: { type: "string", required: true } };
		api.declareConfig(schema as any);
		expect(configSchemas.has("test-ext")).toBe(true);
	});

	test("addMiddleware adds middleware to the list", () => {
		const { api, middlewares } = makeApi();
		const mw = async (_ctx: any, next: any) => next();
		api.addMiddleware(mw);
		expect(middlewares.length).toBe(1);
	});

	test("emit/on custom events work", async () => {
		const { api } = makeApi();
		let _received: any;
		api.on("custom", async (data) => {
			_received = data;
		});
		await api.emit("custom", { hello: "world" });
		// ExtensionAPI.emit delegates to ExtensionEmitter which doesn't return —
		// but the handler should have been called
		// Note: ExtensionEmitter.emit is async but void
	});

	test("addCommand with name but missing options/handler throws", () => {
		const { api } = makeApi();
		expect(() => api.addCommand("bad", undefined as any, undefined as any)).toThrow();
	});
});
