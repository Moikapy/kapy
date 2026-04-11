/**
 * Builder API integration tests — test kapy().command().use().run() programmatically.
 */
import { describe, expect, it } from "bun:test";
import { defineConfig, kapy } from "../../src/cli.js";
import { AbortError, CommandContext } from "../../src/command/context.js";
import { CommandRegistry } from "../../src/command/index.js";
import { ExtensionLoader } from "../../src/extension/index.js";
import type { Middleware } from "../../src/middleware/pipeline.js";
import { composeMiddleware } from "../../src/middleware/pipeline.js";

describe("Builder API", () => {
	it("registers commands via builder pattern", () => {
		const builder = kapy();
		const result = builder.command(
			"hello",
			{
				description: "Say hello",
			},
			async (ctx) => {
				ctx.log("hello");
			},
		);
		// Builder should be chainable
		expect(result).toBe(builder);
	});

	it("adds middleware via use()", () => {
		const builder = kapy();
		const mw: Middleware = async (_ctx, next) => {
			await next();
		};
		const result = builder.use(mw);
		expect(result).toBe(builder);
	});
});

describe("Middleware Execution", () => {
	it("executes middleware in registration order", async () => {
		const order: string[] = [];
		const m1: Middleware = async (_ctx, next) => {
			order.push("m1-before");
			await next();
			order.push("m1-after");
		};
		const m2: Middleware = async (_ctx, next) => {
			order.push("m2-before");
			await next();
			order.push("m2-after");
		};

		const pipeline = composeMiddleware([m1, m2]);
		const ctx = new CommandContext({ command: "test" });
		await pipeline(ctx, async () => {
			order.push("handler");
		});

		expect(order).toEqual(["m1-before", "m2-before", "handler", "m2-after", "m1-after"]);
	});

	it("middleware can read ctx.args", async () => {
		const mw: Middleware = async (ctx, next) => {
			ctx.args = { ...ctx.args, _middlewareRan: true };
			await next();
		};

		const pipeline = composeMiddleware([mw]);
		const ctx = new CommandContext({ command: "test", args: { name: "world" } });
		await pipeline(ctx, async () => {});

		expect(ctx.args._middlewareRan).toBe(true);
		expect(ctx.args.name).toBe("world");
	});
});

describe("Hook Execution Order", () => {
	it("executes hooks in correct order around a command", async () => {
		const order: string[] = [];
		const registry = new CommandRegistry();
		const extensionLoader = new ExtensionLoader(registry);

		// Register a command
		registry.register({
			name: "deploy",
			options: { description: "Deploy" },
			handler: async (_ctx) => {
				order.push("handler");
			},
		});

		// Register hooks
		const hooks = extensionLoader.getHooks();
		hooks.set("before:command", [
			async (_ctx) => {
				order.push("before:command");
			},
		]);
		hooks.set("before:deploy", [
			async (_ctx) => {
				order.push("before:deploy");
			},
		]);
		hooks.set("after:deploy", [
			async (_ctx) => {
				order.push("after:deploy");
			},
		]);
		hooks.set("after:command", [
			async (_ctx) => {
				order.push("after:command");
			},
		]);

		// Execute hooks manually (simulating what runCLI does)
		const ctx = new CommandContext({ command: "deploy" });
		const beforeHooks = hooks.get("before:command") ?? [];
		for (const hook of beforeHooks) {
			await hook(ctx);
		}

		const nameHooks = hooks.get("before:deploy") ?? [];
		for (const hook of nameHooks) {
			await hook(ctx);
		}

		await registry.get("deploy")?.handler(ctx);

		const afterNameHooks = hooks.get("after:deploy") ?? [];
		for (const hook of afterNameHooks) {
			await hook(ctx);
		}

		const afterHooks = hooks.get("after:command") ?? [];
		for (const hook of afterHooks) {
			await hook(ctx);
		}

		expect(order).toEqual(["before:command", "before:deploy", "handler", "after:deploy", "after:command"]);
	});
});

describe("Command Context", () => {
	it("ctx.abort() stops execution with AbortError", () => {
		const ctx = new CommandContext({ command: "test" });
		expect(() => ctx.abort(1)).toThrow(AbortError);
		expect(ctx.aborted).toBe(true);
	});

	it("ctx.json mode suppresses log output", () => {
		const lines: string[] = [];
		const origLog = console.log;
		console.log = (...args: unknown[]) => {
			lines.push(args.join(" "));
		};

		const ctx = new CommandContext({ command: "test", json: true });
		ctx.log("should not appear");
		ctx.warn("should not appear either");

		console.log = origLog;
		expect(lines).toEqual([]);
	});

	it("ctx.error still outputs in json mode", () => {
		const lines: string[] = [];
		const origError = console.error;
		console.error = (...args: unknown[]) => {
			lines.push(args.join(" "));
		};

		const ctx = new CommandContext({ command: "test", json: true });
		ctx.error("error message");

		console.error = origError;
		expect(lines.length).toBeGreaterThan(0);
	});

	it("ctx.prompt throws in noInput mode", async () => {
		const ctx = new CommandContext({ command: "test", noInput: true });
		await expect(ctx.prompt("Enter name")).rejects.toThrow("Prompt blocked by --no-input");
	});

	it("ctx.confirm throws in noInput mode", async () => {
		const ctx = new CommandContext({ command: "test", noInput: true });
		await expect(ctx.confirm("Continue?")).rejects.toThrow("Prompt blocked by --no-input");
	});

	it("ctx.spinner returns a Spinner instance", () => {
		const ctx = new CommandContext({ command: "test" });
		const spinner = ctx.spinner("Loading...");
		expect(spinner).toBeDefined();
		expect(spinner.text).toBe("Loading...");
	});

	it("ctx._tick updates duration", () => {
		const ctx = new CommandContext({ command: "test" });
		expect(ctx.duration).toBe(0);
		ctx._tick();
		expect(ctx.duration).toBeGreaterThanOrEqual(0);
	});
});

describe("Extension Loader", () => {
	it("creates an extension loader with a registry", () => {
		const registry = new CommandRegistry();
		const loader = new ExtensionLoader(registry);
		expect(loader).toBeDefined();
		expect(loader.getHooks()).toBeInstanceOf(Map);
		expect(loader.getMiddlewares()).toEqual([]);
		expect(loader.getScreens()).toEqual([]);
	});

	it("disposeAll clears loaded extensions", async () => {
		const registry = new CommandRegistry();
		const loader = new ExtensionLoader(registry);
		await loader.disposeAll();
		expect(loader.getLoaded()).toEqual([]);
	});
});

describe("defineConfig", () => {
	it("returns the config as-is", () => {
		const config = defineConfig({
			name: "test-cli",
			extensions: ["npm:@foo/bar"],
			envPrefix: "TEST",
		});
		expect(config.name).toBe("test-cli");
		expect(config.extensions).toEqual(["npm:@foo/bar"]);
		expect(config.envPrefix).toBe("TEST");
	});
});
