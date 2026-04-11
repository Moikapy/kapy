/**
 * Built-in middleware: structured logging.
 */
import type { Middleware } from "./pipeline.js";

/** Log command start and completion with structured output */
export const logging: Middleware = async (ctx, next) => {
	const startTime = Date.now();
	if (ctx.json) {
		await next();
		ctx._tick();
		// JSON output is handled by the command itself
		return;
	}

	ctx.log(`→ ${ctx.command}`);
	try {
		await next();
		ctx._tick();
		ctx.log(`✓ ${ctx.command} (${ctx.duration}ms)`);
	} catch (err) {
		ctx._tick();
		ctx.error(`✗ ${ctx.command} (${ctx.duration}ms)`);
		throw err;
	}
};