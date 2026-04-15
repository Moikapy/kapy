/** kapy install — install an extension from npm, git, or local path */

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import type { CommandContext } from "../command/context.js";
import { ensureKapyDirs } from "../config/defaults.js";
import type { ExtensionMeta } from "../extension/types.js";
import { detectPackageManagers, getInstallArgs } from "./package-managers.js";

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
		(proc as any).on("close", (code: number | null) => {
			resolve({ stdout, stderr, exitCode: code });
		});
		(proc as any).on("error" as never, (err: Error) => {
			resolve({ stdout, stderr: stderr + err.message, exitCode: 1 });
		});
	});
}

/** Try to inspect an extension's meta before installing */
async function inspectExtensionMeta(source: string, extensionsDir: string): Promise<ExtensionMeta | null> {
	try {
		const { resolveExtensionSource } = await import("../extension/loader.js");
		const resolvedPath = await resolveExtensionSource(source, extensionsDir);
		const mod = await import(resolvedPath);
		return mod.meta ?? mod.default?.meta ?? null;
	} catch {
		// Can't load it yet — that's fine, we'll install first
		return null;
	}
}

/** Compute SHA-512 checksum of a file or directory */
async function computeChecksum(targetPath: string): Promise<string> {
	const { stat: statAsync, readFile: readFileAsync, readdir } = await import("node:fs/promises");
	const hash = createHash("sha512");

	try {
		const s = await statAsync(targetPath);
		if (s.isFile()) {
			const content = await readFileAsync(targetPath);
			hash.update(content);
		} else if (s.isDirectory()) {
			const files = await readdir(targetPath, { recursive: true, withFileTypes: true });
			const filePaths = files
				.filter((f) => f.isFile())
				.map((f) => join(f.parentPath ?? (f as unknown as { path: string }).path, f.name))
				.sort();
			for (const fp of filePaths) {
				const content = await readFileAsync(fp);
				hash.update(fp.replace(targetPath, ""));
				hash.update(content);
			}
		}
	} catch {
		return "sha512-unknown";
	}

	return `sha512-${hash.digest("hex")}`;
}

export const installCommand = async (ctx: CommandContext): Promise<void> => {
	const positionalArgs = (ctx.args as Record<string, unknown>).rest as string[] | undefined;
	const source = positionalArgs?.[0];
	const trust = ctx.args.trust as boolean;

	if (!source) {
		ctx.error("Usage: kapy install <npm:@scope/pkg | git:repo | ./path>");
		ctx.abort(2);
	}

	// In --no-input mode, require --trust
	if (ctx.noInput && !trust) {
		ctx.error("Cannot install in --no-input mode without --trust flag.");
		ctx.abort(10);
	}

	// Ensure ~/.kapy directory structure exists
	await ensureKapyDirs();

	const spinner = ctx.spinner(`Installing extension: ${source}`);
	spinner.start();

	try {
		const kapyDir = join(homedir(), ".kapy");
		const configPath = join(kapyDir, "config.json");
		const manifestPath = join(kapyDir, "extensions.json");

		// Ensure ~/.kapy exists
		await mkdir(kapyDir, { recursive: true });

		// Try to inspect extension meta before installing
		const extensionsDir = join(kapyDir, "extensions");
		const preInstallMeta = await inspectExtensionMeta(source, extensionsDir);

		// Parse source type and derive package name
		let pkgName: string;
		let installResult: { stdout: string; stderr: string; exitCode: number | null };

		if (source.startsWith("npm:")) {
			const fullPkg = source.slice(4);
			pkgName = fullPkg.split("@")[0] || fullPkg;
			const available = detectPackageManagers();
			const pm = available[0] ?? "npm";
			installResult = await runCommand(pm, getInstallArgs(pm, fullPkg) ?? ["install", "-g", fullPkg], {
				stdio: ctx.json ? "pipe" : "inherit",
			});
		} else if (source.startsWith("git:")) {
			const gitUrl = source.slice(4);
			const repoName = gitUrl.split("/").pop()?.replace(".git", "") ?? gitUrl;
			pkgName = repoName;
			const extDir = join(extensionsDir, repoName);
			installResult = await runCommand("git", ["clone", gitUrl, extDir], {
				stdio: ctx.json ? "pipe" : "inherit",
			});
		} else if (source.startsWith("./") || source.startsWith("../") || source.startsWith("/")) {
			pkgName = source.split("/").pop()?.replace(".ts", "").replace(".js", "") ?? source;
			installResult = { stdout: "", stderr: "", exitCode: 0 };
		} else {
			pkgName = source;
			const available = detectPackageManagers();
			const pm = available[0] ?? "npm";
			installResult = await runCommand(pm, getInstallArgs(pm, source) ?? ["install", "-g", source], {
				stdio: ctx.json ? "pipe" : "inherit",
			});
		}

		// Trust prompt — show what the extension will register
		if (!trust) {
			spinner.stop();

			ctx.log("");
			ctx.log(`📦 Extension: ${pkgName}`);
			ctx.log(`   Source: ${source}`);

			if (preInstallMeta) {
				ctx.log(`   Version: ${preInstallMeta.version ?? "unknown"}`);
				if (preInstallMeta.dependencies?.length) {
					ctx.log(`   Dependencies: ${preInstallMeta.dependencies.join(", ")}`);
				}
				if (preInstallMeta.permissions?.length) {
					ctx.log(`   ⚠️  Permissions: ${preInstallMeta.permissions.join(", ")}`);
					ctx.log(`   (Permissions are documentation-only — not enforced at runtime)`);
				}
			} else {
				ctx.log(`   Version: unknown (will inspect after install)`);
			}

			ctx.log("");
			const confirmed = await ctx.confirm("Continue with install?", true);
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

		// Compute checksum of installed extension
		let checksum = "";
		try {
			let checkTarget: string | undefined;
			if (source.startsWith("npm:")) {
				try {
					const resolved = require.resolve(pkgName, { paths: [process.cwd()] });
					checkTarget = resolved;
				} catch {}
			} else if (source.startsWith("git:")) {
				checkTarget = join(extensionsDir, pkgName);
			} else if (source.startsWith("./") || source.startsWith("../") || source.startsWith("/")) {
				checkTarget = resolve(process.cwd(), source);
			}
			if (checkTarget) {
				checksum = await computeChecksum(checkTarget);
			}
		} catch {
			// Checksum computation is best-effort
		}

		manifest[pkgName] = {
			version: preInstallMeta?.version ?? "latest",
			source,
			...(checksum ? { checksum } : {}),
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
		(globalConfig.extensions as Record<string, unknown>)[pkgName] = {
			source,
			version: preInstallMeta?.version ?? "latest",
		};
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
