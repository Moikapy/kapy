import { describe, expect, it } from "bun:test";
import { AbortError, CommandContext } from "../src/command/context.js";
import { CommandRegistry, parseArgs } from "../src/command/index.js";
import { parseEnvConfig } from "../src/config/loader.js";
import { deepMergeConfigs } from "../src/config/loader-merge.js";
import { ExtensionEmitter } from "../src/hooks/emitter.js";
import { HookPhase, parseHookEvent } from "../src/hooks/types.js";
import { composeMiddleware } from "../src/middleware/pipeline.js";

// ─── Command Registry ──────────────────────────────────────────
describe("CommandRegistry", () => {
	it("registers and retrieves commands", () => {
		const registry = new CommandRegistry();
		registry.register({
			name: "hello",
			options: { description: "Say hello" },
			handler: async () => {},
		});

		const cmd = registry.get("hello");
		expect(cmd).toBeDefined();
		expect(cmd?.name).toBe("hello");
		expect(cmd?.options.description).toBe("Say hello");
	});

	it("lists visible commands", () => {
		const registry = new CommandRegistry();
		registry.register({ name: "visible", options: { description: "Shown" }, handler: async () => {} });
		registry.register({ name: "hidden", options: { description: "Hidden", hidden: true }, handler: async () => {} });

		const visible = registry.visible();
		expect(visible).toHaveLength(1);
		expect(visible[0].name).toBe("visible");
	});

	it("resolves subcommands with : separator", () => {
		const registry = new CommandRegistry();
		registry.register({ name: "deploy", options: { description: "Deploy" }, handler: async () => {} });
		registry.register({ name: "deploy:aws", options: { description: "Deploy to AWS" }, handler: async () => {} });

		const result = registry.resolve(["deploy", "aws"]);
		expect(result).not.toBeNull();
		expect(result?.command.name).toBe("deploy:aws");
		expect(result?.remaining).toEqual([]);

		const baseResult = registry.resolve(["deploy"]);
		expect(baseResult).not.toBeNull();
		expect(baseResult?.command.name).toBe("deploy");
	});

	it("finds subcommands", () => {
		const registry = new CommandRegistry();
		registry.register({ name: "deploy", options: { description: "Deploy" }, handler: async () => {} });
		registry.register({ name: "deploy:aws", options: { description: "AWS" }, handler: async () => {} });
		registry.register({ name: "deploy:gcp", options: { description: "GCP" }, handler: async () => {} });

		const subs = registry.subcommands("deploy");
		expect(subs).toHaveLength(2);
		expect(subs.map((s) => s.name).sort()).toEqual(["deploy:aws", "deploy:gcp"]);
	});

	it("warns on duplicate command and uses last-loaded", () => {
		const registry = new CommandRegistry();
		registry.register({ name: "test", options: { description: "First" }, handler: async () => {} });
		registry.register({ name: "test", options: { description: "Second" }, handler: async () => {} });

		const cmd = registry.get("test");
		expect(cmd?.options.description).toBe("Second");
	});

	it("returns null for unknown command", () => {
		const registry = new CommandRegistry();
		expect(registry.resolve(["nonexistent"])).toBeNull();
	});
});

// ─── Arg Parser ────────────────────────────────────────────────
describe("parseArgs", () => {
	it("parses long flags", () => {
		const { args, rest } = parseArgs(["--verbose", "--env", "production"], {
			env: { type: "string", description: "Environment" },
		});
		expect(args.verbose).toBe(true);
		expect(args.env).toBe("production");
		expect(rest).toEqual([]);
	});

	it("parses short flags", () => {
		const { args } = parseArgs(["-v"], { verbose: { type: "boolean", alias: "v", description: "" } });
		expect(args.verbose).toBe(true);
	});

	it("parses --no- prefix as false", () => {
		const { args } = parseArgs(["--no-input"]);
		expect(args.input).toBe(false);
	});

	it("parses --flag=value", () => {
		const { args } = parseArgs(["--region=us-east-1"]);
		expect(args.region).toBe("us-east-1");
	});

	it("separates positional args from flags", () => {
		const { args, rest } = parseArgs(["myapp", "--verbose", "production"]);
		expect(args.verbose).toBe(true);
		expect(rest).toEqual(["myapp", "production"]);
	});

	it("parses --json and --no-input flags", () => {
		const { args } = parseArgs(["--json", "--no-input"]);
		expect(args.json).toBe(true);
		expect(args.input).toBe(false);
	});

	it("unknown flags default to boolean true", () => {
		const { args } = parseArgs(["--debug"]);
		expect(args.debug).toBe(true);
	});
});

// ─── Command Context ────────────────────────────────────────────
describe("CommandContext", () => {
	it("tracks duration with _tick", () => {
		const ctx = new CommandContext({ command: "test" });
		expect(ctx.duration).toBe(0);
		ctx._tick();
		expect(ctx.duration).toBeGreaterThanOrEqual(0);
	});

	it("log/warn suppress output in json mode", () => {
		const ctx = new CommandContext({ command: "test", json: true });
		ctx.log("hello");
		ctx.warn("warning");
	});

	it("error always outputs", () => {
		const ctx = new CommandContext({ command: "test", json: true });
		ctx.error("error");
	});

	it("abort throws AbortError", () => {
		const ctx = new CommandContext({ command: "test" });
		expect(() => ctx.abort(1)).toThrow(AbortError);
		expect(ctx.aborted).toBe(true);
	});

	it("prompt throws in noInput mode", async () => {
		const ctx = new CommandContext({ command: "test", noInput: true });
		await expect(ctx.prompt("test")).rejects.toThrow("Prompt blocked by --no-input");
	});
});

// ─── Middleware Pipeline ────────────────────────────────────────
describe("composeMiddleware", () => {
	it("chains middleware with next()", async () => {
		const order: string[] = [];
		const m1 = async (_ctx: CommandContext, next: () => Promise<void>) => {
			order.push("m1-before");
			await next();
			order.push("m1-after");
		};
		const m2 = async (_ctx: CommandContext, next: () => Promise<void>) => {
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

	it("short-circuits if middleware doesn't call next()", async () => {
		const order: string[] = [];
		const blocker = async (_ctx: CommandContext, _next: () => Promise<void>) => {
			order.push("blocked");
			// Don't call next()
		};

		const pipeline = composeMiddleware([blocker]);
		const ctx = new CommandContext({ command: "test" });
		await pipeline(ctx, async () => {
			order.push("should not reach");
		});

		expect(order).toEqual(["blocked"]);
	});

	it("catches errors from handler", async () => {
		const errors: string[] = [];
		const catcher = async (_ctx: CommandContext, next: () => Promise<void>) => {
			try {
				await next();
			} catch {
				errors.push("caught");
			}
		};

		const pipeline = composeMiddleware([catcher]);
		const ctx = new CommandContext({ command: "test" });
		await pipeline(ctx, async () => {
			throw new Error("test error");
		});

		expect(errors).toEqual(["caught"]);
	});
});

// ─── Config ─────────────────────────────────────────────────────
describe("deepMergeConfigs", () => {
	it("merges nested configs", () => {
		const result = deepMergeConfigs(
			{ deploy: { region: "us-east-1", env: "staging" } },
			{ deploy: { region: "eu-west-1" } },
		);
		expect(result).toEqual({ deploy: { region: "eu-west-1", env: "staging" } });
	});

	it("overrides primitives", () => {
		const result = deepMergeConfigs({ debug: { verbose: false } }, { debug: { verbose: true } });
		expect(result).toEqual({ debug: { verbose: true } });
	});

	it("handles empty configs", () => {
		const result = deepMergeConfigs({}, { key: "value" });
		expect(result).toEqual({ key: "value" });
	});
});

describe("parseEnvConfig", () => {
	it("parses env vars with prefix", () => {
		process.env.TEST_KAPY_REGION = "us-east-1";
		const config = parseEnvConfig("TEST_KAPY");
		expect(config).toHaveProperty("region", "us-east-1");
		delete process.env.TEST_KAPY_REGION;
	});

	it("ignores env vars without prefix", () => {
		process.env.OTHER_VAR = "should-not-appear";
		const config = parseEnvConfig("TEST_KAPY");
		expect(config).not.toHaveProperty("OTHER_VAR");
		delete process.env.OTHER_VAR;
	});
});

// ─── Extension Emitter ──────────────────────────────────────────
describe("ExtensionEmitter", () => {
	it("emits events to listeners", async () => {
		const emitter = new ExtensionEmitter();
		const received: unknown[] = [];
		emitter.on("test:event", async (data) => {
			received.push(data);
		});
		await emitter.emit("test:event", { msg: "hello" });
		expect(received).toEqual([{ msg: "hello" }]);
	});

	it("supports multiple listeners", async () => {
		const emitter = new ExtensionEmitter();
		const calls: string[] = [];
		emitter.on("evt", async () => {
			calls.push("a");
		});
		emitter.on("evt", async () => {
			calls.push("b");
		});
		await emitter.emit("evt");
		expect(calls).toEqual(["a", "b"]);
	});
});

// ─── Hooks ──────────────────────────────────────────────────────
describe("parseHookEvent", () => {
	it("parses before hooks", () => {
		const result = parseHookEvent("before:deploy");
		expect(result).toEqual({ phase: HookPhase.Before, command: "deploy" });
	});

	it("parses after hooks", () => {
		const result = parseHookEvent("after:deploy:aws");
		expect(result).toEqual({ phase: HookPhase.After, command: "deploy:aws" });
	});

	it("parses generic hooks", () => {
		const result = parseHookEvent("before:command");
		expect(result).toEqual({ phase: HookPhase.Before, command: "command" });
	});

	it("returns null for unknown events", () => {
		expect(parseHookEvent("unknown")).toBeNull();
	});
});
