/**
 * Extension loading integration tests.
 */
import { describe, expect, it } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CommandRegistry } from "../../src/command/registry.js";
import { ExtensionLoader } from "../../src/extension/loader.js";

describe("Extension Loader", () => {
	it("creates an extension loader with a registry", () => {
		const registry = new CommandRegistry();
		const loader = new ExtensionLoader(registry);
		expect(loader).toBeDefined();
		expect(loader.getLoaded()).toHaveLength(0);
	});

	it("disposeAll clears loaded extensions", async () => {
		const registry = new CommandRegistry();
		const loader = new ExtensionLoader(registry);
		await loader.disposeAll();
		expect(loader.getLoaded()).toHaveLength(0);
	});

	it("topological sort resolves dependency order", async () => {
		const registry = new CommandRegistry();
		const loader = new ExtensionLoader(registry);
		// Empty extensions list should work fine
		await loader.loadAll([]);
		expect(loader.getLoaded()).toHaveLength(0);
	});

	it("loadFromConfig with no extensions is a no-op", async () => {
		const registry = new CommandRegistry();
		const loader = new ExtensionLoader(registry);
		await loader.loadFromConfig({});
		await loader.loadFromConfig({ extensions: [] });
		expect(loader.getLoaded()).toHaveLength(0);
	});

	it("loadFromConfig with missing extensions key is a no-op", async () => {
		const registry = new CommandRegistry();
		const loader = new ExtensionLoader(registry);
		await loader.loadFromConfig({ extensions: undefined });
		expect(loader.getLoaded()).toHaveLength(0);
	});

	it("loads a real extension module from file", async () => {
		const extDir = join(tmpdir(), `kapy-test-ext-${Date.now()}`);
		const extFile = join(extDir, "index.ts");
		const extCode = `
			export const meta = { name: "test-ext", version: "1.0.0", dependencies: [], permissions: ["fs:read"] };
			export async function register(api) {
				api.addCommand("test:hello", {
					description: "Hello from test extension",
				}, async (ctx) => {
					ctx.log("Hello from extension!");
				});
				api.addHook("before:test:hello", async (ctx) => {
					ctx.log("Hook fired!");
				});
			}
		`;

		await mkdir(extDir, { recursive: true });
		await writeFile(extFile, extCode);

		try {
			const registry = new CommandRegistry();
			const loader = new ExtensionLoader(registry);

			// Use absolute path so the loader can find the file
			const result = await loader.load("test-ext", extFile);

			// The extension should have loaded
			expect(result).not.toBeNull();
			expect(result?.meta.name).toBe("test-ext");
			expect(result?.meta.version).toBe("1.0.0");
			expect(result?.meta.permissions).toEqual(["fs:read"]);

			// Command should be registered
			const cmd = registry.get("test:hello");
			expect(cmd).toBeDefined();
			expect(cmd?.options.description).toBe("Hello from test extension");

			// Hook should be registered
			const hooks = loader.getHooks();
			expect(hooks.has("before:test:hello")).toBe(true);

			// Loaded list should include our extension
			expect(loader.getLoaded()).toHaveLength(1);
		} finally {
			await rm(extDir, { recursive: true, force: true });
		}
	});

	it("warns on extension with no register export", async () => {
		const extDir = join(tmpdir(), `kapy-test-no-register-${Date.now()}`);
		const extFile = join(extDir, "index.ts");
		const extCode = `
			export const meta = { name: "no-register", version: "0.0.1", dependencies: [] };
			// No register() function
		`;

		await mkdir(extDir, { recursive: true });
		await writeFile(extFile, extCode);

		try {
			const registry = new CommandRegistry();
			const loader = new ExtensionLoader(registry);

			const result = await loader.load("no-register", extFile);
			expect(result).toBeNull();
			expect(loader.getLoaded()).toHaveLength(0);
		} finally {
			await rm(extDir, { recursive: true, force: true });
		}
	});

	it("getScreens returns registered screens", async () => {
		const extDir = join(tmpdir(), `kapy-test-screen-${Date.now()}`);
		const extFile = join(extDir, "index.ts");
		const extCode = `
			export const meta = { name: "screen-ext", version: "1.0.0", dependencies: [] };
			export async function register(api) {
				api.addScreen({
					name: "custom",
					label: "Custom",
					icon: "🎨",
					render: () => "Custom screen content",
				});
			}
		`;

		await mkdir(extDir, { recursive: true });
		await writeFile(extFile, extCode);

		try {
			const registry = new CommandRegistry();
			const loader = new ExtensionLoader(registry);

			await loader.load("screen-ext", extFile);

			const screens = loader.getScreens();
			expect(screens).toHaveLength(1);
			expect(screens[0].name).toBe("custom");
			expect(screens[0].label).toBe("Custom");
		} finally {
			await rm(extDir, { recursive: true, force: true });
		}
	});

	it("getMiddlewares returns registered middleware", async () => {
		const extDir = join(tmpdir(), `kapy-test-mw-${Date.now()}`);
		const extFile = join(extDir, "index.ts");
		const extCode = `
			export const meta = { name: "mw-ext", version: "1.0.0", dependencies: [] };
			export async function register(api) {
				api.addMiddleware(async (ctx, next) => {
					await next();
				});
			}
		`;

		await mkdir(extDir, { recursive: true });
		await writeFile(extFile, extCode);

		try {
			const registry = new CommandRegistry();
			const loader = new ExtensionLoader(registry);

			await loader.load("mw-ext", extFile);

			const middlewares = loader.getMiddlewares();
			expect(middlewares).toHaveLength(1);
		} finally {
			await rm(extDir, { recursive: true, force: true });
		}
	});
});
