/**
 * example-kapy-ext — reference extension for kapy
 *
 * Demonstrates commands, hooks, middleware, and a TUI screen.
 */
import type { KapyExtensionAPI } from "kapy";

export async function register(api: KapyExtensionAPI): Promise<void> {
	// ─── Commands ────────────────────────────────────────────────────

	api.addCommand(
		"hello:ext",
		{
			description: "Say hello from the example extension",
			args: [{ name: "name", description: "Who to greet", default: "world" }],
		},
		async (ctx) => {
			ctx.log(`Hello, ${ctx.args.name}! 👋 (from example-kapy-ext)`);
		},
	);

	api.addCommand(
		"greet",
		{
			description: "Greet someone with style",
			args: [{ name: "name", description: "Person to greet", required: true }],
			flags: {
				enthusiasm: { type: "number", alias: "e", description: "Enthusiasm level (1-10)", default: 5 },
				formal: { type: "boolean", alias: "f", description: "Use formal greeting" },
			},
		},
		async (ctx) => {
			const name = ctx.args.name as string;
			const enthusiasm = ctx.args.enthusiasm as number;
			const formal = ctx.args.formal as boolean;
			const greeting = formal ? "Good day" : "Hey";
			const excl = "!".repeat(Math.min(Math.max(enthusiasm, 1), 10));
			ctx.log(`${greeting}, ${name}${excl}`);
		},
	);

	// ─── Hooks ─────────────────────────────────────────────────────────

	api.addHook("before:greet", async (ctx) => {
		ctx.log("📢 About to greet someone...");
	});

	api.addHook("after:greet", async (ctx) => {
		ctx.log("✅ Greeting complete.");
	});

	api.addHook("before:command", async (ctx) => {
		console.log(`[example-ext] before:command → ${ctx.command}`);
	});

	api.addHook("after:command", async (ctx) => {
		console.log(`[example-ext] after:command → ${ctx.command} (${ctx.duration}ms)`);
	});

	// ─── Middleware ────────────────────────────────────────────────────

	api.addMiddleware(async (ctx, next) => {
		const start = Date.now();
		ctx.log(`⏱ [example-ext] middleware: starting ${ctx.command}`);
		await next();
		const duration = Date.now() - start;
		ctx.log(`⏱ [example-ext] middleware: finished in ${duration}ms`);
	});

	// ─── TUI Screen ────────────────────────────────────────────────────

	api.addScreen({
		name: "example",
		label: "Example",
		icon: "🧩",
		render: () => {
			return "Example Extension Screen\n\nThis extension demonstrates:\n• Commands (hello:ext, greet)\n• Hooks (before:greet, after:greet)\n• Middleware (timing)\n• TUI screen (this!)\n\nUse 'kapy greet <name>' to try it out!";
		},
		keyBindings: { q: "quit" },
	});

	// ─── Config ────────────────────────────────────────────────────────

	api.declareConfig({
		greeting: { type: "string", description: "Default greeting style", default: "casual" },
		enthusiasm: { type: "number", description: "Default enthusiasm level", default: 5 },
	});
}

export const meta = {
	name: "example-kapy-ext",
	version: "0.1.0",
	dependencies: [],
};
