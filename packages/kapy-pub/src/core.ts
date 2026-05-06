/**
 * Core logic for npm package publishing.
 * Shared between kapy CLI and pi extension.
 */

import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// ── Types ─────────────────────────────────────────────────────────────

export interface PackResult {
	files: string[];
	totalSize: string;
	output: string;
}

export interface VerifyResult {
	checks: string[];
	issues: string[];
	buildOk: boolean;
}

export interface KeyResult {
	key: string;
	keyLength: number;
}

export interface RotateResult {
	newKey: string;
	currentEnv: string;
	previousEnv: string;
	instructions: string;
}

// ── Pack check ────────────────────────────────────────────────────────

export function packCheck(directory: string): PackResult {
	const output = execSync("npm pack --dry-run 2>&1", {
		cwd: directory,
		encoding: "utf-8",
		timeout: 30000,
	});

	const files: string[] = [];
	let totalSize = "";
	for (const line of output.split("\n")) {
		const trimmed = line.trim();
		if (trimmed.startsWith("npm notice")) {
			const sizeMatch = trimmed.match(/(\d+\.?\d*\s*[kKmMgG]?B)/);
			if (sizeMatch && trimmed.includes("package size")) {
				totalSize = sizeMatch[1];
			}
			// Extract file entries: "npm notice <size> <filename>"
			const fileMatch = trimmed.match(/npm notice\s+\S+\s+(.+)/);
			if (fileMatch && !trimmed.includes("Tarball") && !trimmed.includes("package size")) {
				files.push(fileMatch[1].trim());
			}
		}
	}

	return { files, totalSize, output };
}

// ── Verify build ──────────────────────────────────────────────────────

export function verifyBuild(directory: string): VerifyResult {
	const issues: string[] = [];
	const checks: string[] = [];
	let buildOk = false;

	// Read package.json
	const pkgPath = join(directory, "package.json");
	if (!existsSync(pkgPath)) {
		return { checks: [], issues: ["No package.json found"], buildOk: false };
	}

	const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));

	// Check exports
	if (pkg.exports) {
		checks.push("Has exports map");
		for (const [exportPath, exp] of Object.entries(pkg.exports as Record<string, unknown>)) {
			if (typeof exp === "object" && exp !== null) {
				const e = exp as Record<string, unknown>;
				if (!e.types && !e.typings) issues.push(`Missing "types" in exports["${exportPath}"]`);
				if (!e.import) issues.push(`Missing "import" in exports["${exportPath}"]`);
			}
		}
	} else {
		issues.push("No exports map");
	}

	// Check files
	if (pkg.files) {
		checks.push(`files: [${pkg.files.join(", ")}]`);
		if (existsSync(join(directory, "SKILL.md")) && !pkg.files.includes("SKILL.md")) {
			issues.push("SKILL.md exists but not in files array");
		}
	} else {
		issues.push("No files array — npm will include everything");
	}

	// Check main/types
	if (!pkg.main) issues.push("Missing 'main' field");
	if (!pkg.types && !pkg.typings) issues.push("Missing 'types' field");

	// Check prepublishOnly
	if (!pkg.scripts?.prepublishOnly && !pkg.scripts?.prepack) {
		issues.push("No prepublishOnly or prepack script");
	}

	// Run build — detect bun vs npm from lockfile (check package dir and ancestors)
	let hasBunLock = false;
	for (const dir of [directory, join(directory, ".."), join(directory, "..", "..")]) {
		if (existsSync(join(dir, "bun.lock")) || existsSync(join(dir, "bun.lockb"))) {
			hasBunLock = true;
			break;
		}
	}
	const buildCmd = hasBunLock ? "bun run build" : "npm run build";
	try {
		execSync(buildCmd, { cwd: directory, encoding: "utf-8", timeout: 60000, stdio: "pipe" });
		buildOk = true;
		checks.push("Build succeeded");
	} catch (err: any) {
		issues.push(`Build failed: ${err.message?.slice(0, 200)}`);
	}

	// Check dist
	if (buildOk && !existsSync(join(directory, "dist"))) {
		issues.push("No dist/ directory after build");
	}

	return { checks, issues, buildOk };
}

// ── Key generation ────────────────────────────────────────────────────

export function generateKey(): KeyResult {
	const key = randomBytes(32).toString("hex");
	return { key, keyLength: key.length };
}

// ── Key rotation ──────────────────────────────────────────────────────

export function rotateKey(
	currentEnv = "OPENROUTER_ENCRYPT_KEY",
	previousEnv = "OPENROUTER_ENCRYPT_KEY_PREVIOUS",
): RotateResult {
	const { key: newKey } = generateKey();

	const instructions = [
		`1. Set ${previousEnv} to the current value of ${currentEnv}`,
		`2. Set ${currentEnv} to the new key`,
		"3. Wait for sessions to expire (your sessionMaxAge, default 30 days)",
		`4. Remove ${previousEnv}`,
		"",
		"Cloudflare Workers:",
		`  wrangler secret put ${currentEnv}      # set to new key`,
		`  wrangler secret put ${previousEnv}     # set to old key`,
		`  # After expiry: wrangler secret delete ${previousEnv}`,
		"",
		".env:",
		`  ${currentEnv}=${newKey}`,
		`  ${previousEnv}=<paste_current_key_here>`,
	].join("\n");

	return { newKey, currentEnv, previousEnv, instructions };
}
