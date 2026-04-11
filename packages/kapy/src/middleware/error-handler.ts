/**
 * Built-in middleware: error handler.
 *
 * Catches unhandled errors in the command pipeline, formats the output,
 * and sets the appropriate exit code. Throws KapyError instead of calling
 * process.exit() so the CLI runner can handle exits at the top level.
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

/** Custom error with exit code for CLI error handling */
export class KapyError extends Error {
	constructor(
		message: string,
		public readonly exitCode: number,
		public readonly jsonOutput?: object,
	) {
		super(message);
		this.name = "KapyError";
	}
}

/** Catches unhandled errors and throws KapyError for top-level handling */
export const errorHandler: Middleware = async (_ctx, next) => {
	try {
		await next();
	} catch (err) {
		if (err instanceof AbortError) {
			throw new KapyError(`Command aborted (exit code ${err.exitCode})`, err.exitCode, {
				status: "aborted",
				exitCode: err.exitCode,
			});
		}

		if (err instanceof KapyError) {
			throw err;
		}

		if (err instanceof Error) {
			throw new KapyError(err.message, EXIT_CODES.GENERAL_ERROR, { status: "error", message: err.message });
		}

		// Unknown error
		throw new KapyError(String(err), EXIT_CODES.GENERAL_ERROR, { status: "error", message: String(err) });
	}
};
