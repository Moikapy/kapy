import { describe, expect, test } from "bun:test";
import { ProviderRegistry } from "../../../../src/ai/provider/registry.js";
import type { ModelInfo, ProviderConfig } from "../../../../src/ai/provider/types.js";

function makeProviderConfig(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
	return {
		id: "test-provider",
		name: "Test Provider",
		baseUrl: "http://localhost:11434",
		type: "ollama",
		models: [],
		...overrides,
	};
}

function makeModel(overrides: Partial<ModelInfo> = {}): ModelInfo {
	return {
		id: "test-model",
		label: "Test Model",
		contextLength: 4096,
		supportsVision: false,
		supportsReasoning: false,
		provider: "test-provider",
		...overrides,
	};
}

describe("ProviderRegistry", () => {
	test("registers a provider", () => {
		const reg = new ProviderRegistry();
		reg.register(makeProviderConfig());
		expect(reg.has("test-provider")).toBe(true);
	});

	test("get returns provider config", () => {
		const reg = new ProviderRegistry();
		const config = makeProviderConfig();
		reg.register(config);
		expect(reg.get("test-provider")).toBe(config);
	});

	test("unregister removes a provider", () => {
		const reg = new ProviderRegistry();
		reg.register(makeProviderConfig());
		reg.unregister("test-provider");
		expect(reg.has("test-provider")).toBe(false);
	});

	test("all() returns all providers", () => {
		const reg = new ProviderRegistry();
		reg.register(makeProviderConfig({ id: "a" }));
		reg.register(makeProviderConfig({ id: "b" }));
		expect(reg.all()).toHaveLength(2);
	});

	test("addModel adds model to provider", () => {
		const reg = new ProviderRegistry();
		reg.register(makeProviderConfig());
		const model = makeModel();
		reg.addModel("test-provider", model);
		const models = reg.getModels("test-provider");
		expect(models).toHaveLength(1);
		expect(models[0].id).toBe("test-model");
	});

	test("getAllModels returns models from all providers", () => {
		const reg = new ProviderRegistry();
		reg.register(makeProviderConfig({ id: "a" }));
		reg.register(makeProviderConfig({ id: "b" }));
		reg.addModel("a", makeModel({ id: "model-a", provider: "a" }));
		reg.addModel("b", makeModel({ id: "model-b", provider: "b" }));
		expect(reg.getAllModels()).toHaveLength(2);
	});

	test("getModel finds model across providers", () => {
		const reg = new ProviderRegistry();
		reg.register(makeProviderConfig({ id: "a" }));
		reg.addModel("a", makeModel({ id: "llama3" }));
		const model = reg.getModel("llama3");
		expect(model).toBeDefined();
		expect(model?.id).toBe("llama3");
	});

	test("getModel returns undefined for unknown model", () => {
		const reg = new ProviderRegistry();
		expect(reg.getModel("nonexistent")).toBeUndefined();
	});

	test("setDefaultModel sets the default", () => {
		const reg = new ProviderRegistry();
		reg.register(makeProviderConfig());
		reg.addModel("test-provider", makeModel({ id: "default-model" }));
		reg.setDefaultModel("default-model");
		expect(reg.getDefaultModel()?.id).toBe("default-model");
	});

	test("setDefaultModel throws for unknown model", () => {
		const reg = new ProviderRegistry();
		expect(() => reg.setDefaultModel("nonexistent")).toThrow();
	});

	test("providerCount returns count", () => {
		const reg = new ProviderRegistry();
		expect(reg.providerCount).toBe(0);
		reg.register(makeProviderConfig({ id: "a" }));
		expect(reg.providerCount).toBe(1);
	});

	test("modelCount returns total model count", () => {
		const reg = new ProviderRegistry();
		reg.register(makeProviderConfig({ id: "a" }));
		reg.addModel("a", makeModel({ id: "m1" }));
		reg.addModel("a", makeModel({ id: "m2" }));
		expect(reg.modelCount).toBe(2);
	});
});
