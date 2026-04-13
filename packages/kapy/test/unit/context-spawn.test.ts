/**
 * Tests for CommandContext process-aware additions:
 * - ctx.spawn (subprocess helper)
 * - ctx.isInteractive (TTY detection)
 * - ctx.exitCode (exit code propagation)
 * - ctx.teardown (cleanup registration)
 */
import { describe, expect, it } from "bun:test";
import { CommandContext } from "../../src/command/context.js";

// ─── ctx.isInteractive ──────────────────────────────────────────

describe("ctx.isInteractive", () => {
	it("returns false when --json mode is active", () => {
		const ctx = new CommandContext({ command: "test", json: true });
		expect(ctx.isInteractive).toBe(false);
	});

	it("returns false when --no-input mode is active", () => {
		const ctx = new CommandContext({ command: "test", noInput: true });
		expect(ctx.isInteractive).toBe(false);
	});

	it("returns false when both json and noInput", () => {
		const ctx = new CommandContext({ command: "test", json: true, noInput: true });
		expect(ctx.isInteractive).toBe(false);
	});
});

// ─── ctx.exitCode ───────────────────────────────────────────────

describe("ctx.exitCode", () => {
	it("defaults to 0", () => {
		const ctx = new CommandContext({ command: "test" });
		expect(ctx.exitCode).toBe(0);
	});

	it("can be set to a non-zero code", () => {
		const ctx = new CommandContext({ command: "test" });
		ctx.exitCode = 1;
		expect(ctx.exitCode).toBe(1);
	});

	it("can be set multiple times (last wins)", () => {
		const ctx = new CommandContext({ command: "test" });
		ctx.exitCode = 2;
		ctx.exitCode = 0;
		expect(ctx.exitCode).toBe(0);
	});

	it("user-set exitCode takes priority over abort exit code", () => {
		const ctx = new CommandContext({ command: "test" });
		ctx.exitCode = 42;
		try {
			ctx.abort(10);
		} catch {
			/* abort throws, that's expected */
		}
		// abort sets _abortExitCode=10 but _userExitCode=42 still wins
		expect(ctx.exitCode).toBe(42);
	});

	it("returns abort code when no user code is set", () => {
		const ctx = new CommandContext({ command: "test" });
		try {
			ctx.abort(10);
		} catch {
			/* expected */
		}
		expect(ctx.exitCode).toBe(10);
	});
});

// ─── ctx.teardown ───────────────────────────────────────────────

describe("ctx.teardown", () => {
	it("runs teardown callbacks in LIFO (reverse) order", async () => {
		const ctx = new CommandContext({ command: "test" });
		const order: string[] = [];
		ctx.teardown(() => {
			order.push("first");
		});
		ctx.teardown(() => {
			order.push("second");
		});
		ctx.teardown(() => {
			order.push("third");
		});

		await ctx.runTeardowns();
		expect(order).toEqual(["third", "second", "first"]);
	});

	it("runs async teardown callbacks in LIFO order", async () => {
		const ctx = new CommandContext({ command: "test" });
		const order: number[] = [];
		ctx.teardown(async () => {
			await new Promise((r) => setTimeout(r, 5));
			order.push(1);
		});
		ctx.teardown(async () => {
			order.push(2);
		});

		await ctx.runTeardowns();
		expect(order).toEqual([2, 1]);
	});

	it("continues running teardowns even if one throws", async () => {
		const ctx = new CommandContext({ command: "test" });
		const called: string[] = [];
		ctx.teardown(() => {
			called.push("a");
			throw new Error("boom");
		});
		ctx.teardown(() => {
			called.push("b");
		});

		// LIFO: b runs first, then a (which throws)
		await ctx.runTeardowns();
		expect(called).toEqual(["b", "a"]);
	});

	it("clears teardown callbacks after running", async () => {
		const ctx = new CommandContext({ command: "test" });
		let count = 0;
		ctx.teardown(() => {
			count++;
		});

		await ctx.runTeardowns();
		expect(count).toBe(1);

		// Second call is a no-op
		await ctx.runTeardowns();
		expect(count).toBe(1);
	});
});

// ─── ctx.spawn ──────────────────────────────────────────────────

describe("ctx.spawn", () => {
	it("spawns a command and returns exit code + output", async () => {
		const ctx = new CommandContext({ command: "test" });
		const result = await ctx.spawn(["echo", "hello world"]);

		expect(result.exitCode).toBe(0);
		expect(result.stdout.trim()).toBe("hello world");
		expect(result.aborted).toBe(false);
	});

	it("captures stderr separately", async () => {
		const ctx = new CommandContext({ command: "test" });
		const result = await ctx.spawn(["bash", "-c", "echo out && echo err >&2"]);

		expect(result.exitCode).toBe(0);
		expect(result.stdout.trim()).toBe("out");
		expect(result.stderr.trim()).toBe("err");
	});

	it("returns non-zero exit code on failure", async () => {
		const ctx = new CommandContext({ command: "test" });
		const result = await ctx.spawn(["bash", "-c", "exit 42"]);

		expect(result.exitCode).toBe(42);
		expect(result.aborted).toBe(false);
	});

	it("passes custom environment variables", async () => {
		const ctx = new CommandContext({ command: "test" });
		const result = await ctx.spawn(["bash", "-c", "echo $KAPY_TEST_VAR"], {
			env: { KAPY_TEST_VAR: "from-kapy" },
		});

		expect(result.stdout.trim()).toBe("from-kapy");
	});

	it("passes custom working directory", async () => {
		const ctx = new CommandContext({ command: "test" });
		const result = await ctx.spawn(["pwd"], { cwd: "/tmp" });

		expect(result.stdout.trim()).toBe("/tmp");
	});

	it("captures output even when suppressOutput is true", async () => {
		const ctx = new CommandContext({ command: "test", json: true });

		const result = await ctx.spawn(["echo", "captured"], {
			suppressOutput: true,
		});

		expect(result.exitCode).toBe(0);
		expect(result.stdout.trim()).toBe("captured");
	});

	it("works with no options (defaults)", async () => {
		const ctx = new CommandContext({ command: "test" });
		const result = await ctx.spawn(["echo", "defaults work"]);

		expect(result.exitCode).toBe(0);
		expect(result.stdout.trim()).toBe("defaults work");
	});

	it("returns aborted=true when process is killed via abort signal", async () => {
		const ctx = new CommandContext({ command: "test" });

		// Spawn a long-running process with abortOnError
		const resultPromise = ctx.spawn(["sleep", "30"], { abortOnError: true });

		// Trigger abort after short delay
		setTimeout(() => {
			try {
				ctx.abort(10);
			} catch {
				/* expected to throw */
			}
		}, 50);

		const result = await resultPromise;
		expect(result.aborted).toBe(true);
	});
});
