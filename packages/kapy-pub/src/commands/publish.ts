import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { CommandContext } from "@moikapy/kapy";

export async function publishCommand(ctx: CommandContext): Promise<void> {
	const rest = (ctx.args.rest || []) as string[];
	const dir = rest[0] || ".";
	const access = (ctx.args.access as string) || "public";
	const tag = (ctx.args.tag as string) || "latest";
	const dryRun = ctx.args.dryRun as boolean;
	const json = ctx.args.json as boolean;

	// Build first
	const buildCmd = existsSync(join(dir, "bun.lock")) ? "bun run build" : "npm run build";
	const spinner = ctx.spinner("Building...");
	spinner.start();

	try {
		execSync(buildCmd, { cwd: dir, encoding: "utf-8", timeout: 60000, stdio: "pipe" });
		spinner.succeed("Build succeeded");
	} catch (err: any) {
		spinner.fail("Build failed");
		ctx.error(err.message);
		ctx.abort(1);
		return; // unreachable but satisfies TS
	}

	// Pack check
	let packOutput: string;
	try {
		packOutput = execSync("npm pack --dry-run 2>&1", { cwd: dir, encoding: "utf-8", timeout: 30000 });
	} catch (err: any) {
		ctx.error(`Pack check failed: ${err.message}`);
		ctx.abort(1);
		return;
	}

	if (!json) {
		console.log("\n### Package Contents");
		console.log(packOutput);
	}

	// Confirm
	const confirmMsg = `Publish ${tag !== "latest" ? `(${tag}) ` : ""}with ${access} access?`;
	if (!dryRun) {
		const ok = await ctx.confirm(confirmMsg);
		if (!ok) {
			ctx.warn("Publish cancelled");
			return;
		}
	}

	// Publish
	const tagArg = tag !== "latest" ? ` --tag ${tag}` : "";
	const dryArg = dryRun ? " --dry-run" : "";
	const cmd = `npm publish --access ${access}${tagArg}${dryArg}`;

	const pubSpinner = ctx.spinner("Publishing...");
	pubSpinner.start();

	try {
		const output = execSync(cmd, { cwd: dir, encoding: "utf-8", timeout: 120000 });
		pubSpinner.succeed("Published successfully!");
		if (json) {
			ctx.emit("result", { success: true, tag, access, dryRun });
		} else {
			console.log(output);
		}
	} catch (err: any) {
		pubSpinner.fail("Publish failed");
		ctx.error(err.message);
		ctx.abort(1);
	}
}
