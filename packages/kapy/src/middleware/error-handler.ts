/**
 * Built-in middleware: error handler.
 *
 * Catches unhandled errors in the command pipeline, formats the output,
 * and sets the appropriate exit code.
 */

import { AbortError } from "../command/context.js";
import type { Middleware } from "./pipeline.js";

/** Exit codes */
export const EXIT_CODES = {
	SUCCESS: 0,
	GENERAL_ERROR: 1,
	INVALID_ARGS: 2,
	EXTENSION_ERROR: 3,
	CONFIG_ERROR: 4,
	NETWORK_ERROR: 5,
	ABORTED: 10,
} as const;

/** Catches unhandled errors and formats output */
export const errorHandler: Middleware = async (ctx, next) => {
	try {
		await next();
	} catch (err) {
		if (err instanceof AbortError) {
			if (ctx.json) {
				console.log(JSON.stringify({ status: "aborted", exitCode: err.exitCode }));
			} else {
				ctx.warn(`Command aborted (exit code ${err.exitCode})`);
			}
			process.exit(err.exitCode);
		}

		if (err instanceof Error) {
			if (ctx.json) {
				console.log(JSON.stringify({ status: "error", message: err.message }));
			} else {
				ctx.error(`Error: ${err.message}`);
			}
			process.exit(EXIT_CODES.GENERAL_ERROR);
		}

		// Unknown error
		if (ctx.json) {
			console.log(JSON.stringify({ status: "error", message: String(err) }));
		} else {
			ctx.error(`Unknown error: ${err}`);
		}
		process.exit(EXIT_CODES.GENERAL_ERROR);
	}
};
