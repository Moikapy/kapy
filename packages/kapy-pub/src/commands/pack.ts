import type { CommandContext } from "@moikapy/kapy";
import { packCheck, verifyBuild } from "../core.js";

export async function packCommand(ctx: CommandContext): Promise<void> {
	const rest = (ctx.args.rest || []) as string[];
	const dir = rest[0] || ".";
	const json = ctx.args.json as boolean;

	try {
		const result = packCheck(dir);

		if (json) {
			ctx.emit("result", result);
			return;
		}

		if (result.files.length > 0) {
			ctx.log("Files to be published:");
			for (const f of result.files) {
				console.log(`  ${f}`);
			}
			if (result.totalSize) {
				console.log(`\nTotal: ${result.totalSize}`);
			}
		} else {
			ctx.warn("No files found — check package.json files array");
		}
	} catch (err: any) {
		ctx.error(`Pack check failed: ${err.message}`);
		ctx.abort(1);
	}
}

export async function verifyCommand(ctx: CommandContext): Promise<void> {
	const rest = (ctx.args.rest || []) as string[];
	const dir = rest[0] || ".";
	const json = ctx.args.json as boolean;

	const spinner = ctx.spinner("Verifying package...");
	spinner.start();

	try {
		const result = verifyBuild(dir);
		spinner.stop();

		if (json) {
			ctx.emit("result", result);
			return;
		}

		console.log("\n## Package Verification\n");

		if (result.checks.length > 0) {
			console.log("### Checks Passed");
			for (const c of result.checks) {
				console.log(`  ✓ ${c}`);
			}
		}

		console.log();
		if (result.issues.length > 0) {
			console.log("### Issues Found");
			for (const i of result.issues) {
				console.log(`  ✗ ${i}`);
			}
		} else {
			console.log("### No Issues 🎉");
		}

		if (!result.buildOk) {
			ctx.abort(1);
		}
	} catch (err: any) {
		spinner.fail("Verification failed");
		ctx.error(err.message);
		ctx.abort(1);
	}
}
