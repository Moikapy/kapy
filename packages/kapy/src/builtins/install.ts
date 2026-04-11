/** kapy install — install an extension from npm, git, or local path */
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { CommandContext } from "../command/context.js";

/** Run a command safely without shell injection */
async function runCommand(
	command: string,
	args: string[],
	options?: { cwd?: string; stdio?: "pipe" | "inherit" },
): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
	return new Promise((resolve) => {
		const proc = spawn(command, args, {
			cwd: options?.cwd,
			stdio: options?.stdio ?? "pipe",
		});
		let stdout = "";
		let stderr = "";
		proc.stdout?.on("data", (data: Buffer) => {
			stdout += data.toString();
		});
		proc.stderr?.on("data", (data: Buffer) => {
			stderr += data.toString();
		});
		proc.on("close", (code) => {
			resolve({ stdout, stderr, exitCode: code });
		});
		proc.on("error", (err) => {
			resolve({ stdout, stderr: stderr + err.message, exitCode: 1 });
		});
	});
}

export const installCommand = async (ctx: CommandContext): Promise<void> => {
	const positionalArgs = (ctx.args as Record<string, unknown>).rest as string[] | undefined;
	const source = positionalArgs?.[0];
	const trust = ctx.args.trust as boolean;

	if (!source) {
		ctx.error("Usage: kapy install <npm:@scope/pkg | git:repo | ./path>");
		ctx.abort(2);
	}

	const spinner = ctx.spinner(`Installing extension: ${source}`);
	spinner.start();

	try {
		const kapyDir = join(homedir(), ".kapy");
		const configPath = join(kapyDir, "config.json");
		const manifestPath = join(kapyDir, "extensions.json");

		// Ensure ~/.kapy exists
		await mkdir(kapyDir, { recursive: true });

		// Parse source type and derive package name
		let pkgName: string;
		let installResult: { stdout: string; stderr: string; exitCode: number | null };

		if (source.startsWith("npm:")) {
			// npm package: e.g., "npm:@foo/kapy-ext@1.2.3" or "npm:@foo/kapy-ext"
			const fullPkg = source.slice(4);
			pkgName = fullPkg.split("@")[0] || fullPkg;
			installResult = await runCommand("bun", ["add", "-g", fullPkg], {
				stdio: ctx.json ? "pipe" : "inherit",
			});
		} else if (source.startsWith("git:")) {
			// git repo: e.g., "git:github.com/user/repo" or "git:github.com/user/repo@v2"
			const gitUrl = source.slice(4);
			const repoName = gitUrl.split("/").pop()?.replace(".git", "") ?? gitUrl;
			pkgName = repoName;
			const extDir = join(kapyDir, "extensions", repoName);
			installResult = await runCommand("git", ["clone", gitUrl, extDir], {
				stdio: ctx.json ? "pipe" : "inherit",
			});
		} else if (source.startsWith("./") || source.startsWith("../") || source.startsWith("/")) {
			// Local path — no install needed, just validate it exists
			pkgName = source.split("/").pop()?.replace(".ts", "").replace(".js", "") ?? source;
			installResult = { stdout: "", stderr: "", exitCode: 0 };
		} else {
			// Bare package name — treat as npm package
			pkgName = source;
			installResult = await runCommand("bun", ["add", "-g", source], {
				stdio: ctx.json ? "pipe" : "inherit",
			});
		}

		// Trust prompt
		if (!trust) {
			spinner.stop();
			ctx.log(`Extension will install: ${pkgName}`);
			ctx.log(`Source: ${source}`);
			const confirmed = await ctx.confirm("Continue?", true);
			if (!confirmed) {
				ctx.log("Installation cancelled.");
				return;
			}
			spinner.start();
		}

		// Check install result
		if (installResult.exitCode !== 0 && installResult.exitCode !== null) {
			spinner.fail(`Failed to install: ${source}`);
			ctx.error(installResult.stderr || `Install failed with exit code ${installResult.exitCode}`);
			ctx.abort(1);
		}

		// Update extensions manifest
		let manifest: Record<string, { version: string; source: string; checksum?: string; installedAt: string }> = {};
		try {
			const content = await readFile(manifestPath, "utf-8");
			manifest = JSON.parse(content);
		} catch {
			// First extension
		}

		manifest[pkgName] = {
			version: "latest",
			source,
			installedAt: new Date().toISOString(),
		};

		await writeFile(manifestPath, JSON.stringify(manifest, null, 2));

		// Update global config
		let globalConfig: Record<string, unknown> = {};
		try {
			const content = await readFile(configPath, "utf-8");
			globalConfig = JSON.parse(content);
		} catch {
			// No config yet
		}

		if (!globalConfig.extensions) globalConfig.extensions = {};
		(globalConfig.extensions as Record<string, unknown>)[pkgName] = { source, version: "latest" };
		await writeFile(configPath, JSON.stringify(globalConfig, null, 2));

		spinner.succeed(`Installed extension: ${pkgName}`);

		if (ctx.json) {
			console.log(JSON.stringify({ status: "success", installed: pkgName, source }));
		}
	} catch (err) {
		spinner.fail(`Failed to install: ${source}`);
		throw err;
	}
};
