/**
 * Built-in middleware: timing/tracking.
 */
import type { Middleware } from "./pipeline.js";

/** Track command duration and make it available via ctx.duration */
export const timing: Middleware = async (ctx, next) => {
	await next();
	ctx._tick();
};
