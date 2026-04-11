/**
 * Middleware pipeline — wraps command execution like Express middleware.
 *
 * Middleware runs in registration order. Each calls `next()` to pass control.
 * Can transform ctx before next() or transform output after.
 * Can short-circuit by calling ctx.abort() instead of next().
 */
import type { CommandContext } from "../command/context.js";

/** Middleware function type */
export type Middleware = (ctx: CommandContext, next: () => Promise<void>) => Promise<void> | void;

/** Compose an array of middleware into a single function */
export function composeMiddleware(
	middlewares: Middleware[],
): (ctx: CommandContext, final: () => Promise<void>) => Promise<void> {
	if (middlewares.length === 0) {
		return (_ctx, final) => final();
	}

	return async (ctx, final) => {
		let index = -1;

		async function dispatch(i: number): Promise<void> {
			if (i <= index) {
				throw new Error("next() called multiple times");
			}
			index = i;

			if (i >= middlewares.length) {
				return final();
			}

			const middleware = middlewares[i];
			await middleware(ctx, async () => dispatch(i + 1));
		}

		await dispatch(0);
	};
}
