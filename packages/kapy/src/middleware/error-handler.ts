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

/** Catches unhandled errors and throws KapyError for top-level handling.
 *
 * Error classification:
 * - AbortError → ABORTED (10)
 * - KapyError → preserved exit code
 * - Network errors (ECONNREFUSED, ETIMEDOUT, ENOTFOUND) → NETWORK_ERROR (5)
 * - Auth errors (401, 403, EACCES) → EXTENSION_ERROR (3)
 * - Other errors → GENERAL_ERROR (1)
 */
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

		// Classify error type for better retry handling
		const exitCode = classifyError(err);

		if (err instanceof Error) {
			throw new KapyError(err.message, exitCode, { status: "error", message: err.message, exitCode });
		}

		// Unknown error
		throw new KapyError(String(err), exitCode, { status: "error", message: String(err), exitCode });
	}
};

/** Classify error type to determine appropriate exit code */
function classifyError(err: unknown): number {
	if (!(err instanceof Error)) return EXIT_CODES.GENERAL_ERROR;

	const message = err.message.toLowerCase();
	const code = (err as NodeJS.ErrnoException).code;

	// Network errors
	if (
		code === "ECONNREFUSED" ||
		code === "ETIMEDOUT" ||
		code === "ENOTFOUND" ||
		code === "ECONNRESET" ||
		message.includes("network") ||
		message.includes("timeout") ||
		message.includes("fetch failed")
	) {
		return EXIT_CODES.NETWORK_ERROR;
	}

	// Auth/permission errors
	if (
		code === "EACCES" ||
		code === "EPERM" ||
		message.includes("401") ||
		message.includes("403") ||
		message.includes("unauthorized") ||
		message.includes("forbidden") ||
		message.includes("permission denied")
	) {
		return EXIT_CODES.EXTENSION_ERROR;
	}

	return EXIT_CODES.GENERAL_ERROR;
}
