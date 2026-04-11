/** kapy install — install an extension from npm, git, or local path */
import { execSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { CommandContext } from "../command/context.js";

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

		// Parse source type
		let pkgName: string;
		let installCmd: string;

		if (source.startsWith("npm:")) {
			pkgName = source.slice(4).split("@")[0] || source.slice(4);
			const fullPkg = source.slice(4);
			installCmd = `bun add -g ${fullPkg}`;
		} else if (source.startsWith("git:")) {
			const gitUrl = source.slice(4);
			const repoName = gitUrl.split("/").pop()?.replace(".git", "") ?? gitUrl;
			pkgName = repoName;
			const extDir = join(kapyDir, "extensions", repoName);
			installCmd = `git clone ${gitUrl} ${extDir}`;
		} else if (source.startsWith("./") || source.startsWith("../") || source.startsWith("/")) {
			pkgName = source.split("/").pop()?.replace(".ts", "").replace(".js", "") ?? source;
			installCmd = ""; // local — no install needed
		} else {
			// Treat as npm package name
			pkgName = source;
			installCmd = `bun add -g ${source}`;
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

		// Run install
		if (installCmd) {
			try {
				execSync(installCmd, { stdio: ctx.json ? "pipe" : "inherit" });
			} catch (err) {
				spinner.fail(`Failed to install: ${source}`);
				throw err;
			}
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
