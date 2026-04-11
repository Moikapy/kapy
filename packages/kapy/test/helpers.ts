/**
 * Test helpers for kapy integration tests.
 *
 * Provides utilities for spawning the CLI, creating temp directories,
 * and cleaning up after tests.
 */
import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Result of spawning a CLI command */
export interface CLIResult {
	stdout: string;
	stderr: string;
	exitCode: number | null;
}

/** Spawn the kapy CLI with given arguments */
export function spawnCLI(args: string[], options?: { cwd?: string; env?: Record<string, string> }): Promise<CLIResult> {
	const cliPath = join(import.meta.dir, "..", "src", "cli.ts");

	return new Promise((resolve) => {
		const proc = spawn("bun", ["run", cliPath, ...args], {
			cwd: options?.cwd,
			env: { ...process.env, ...options?.env },
			stdio: ["pipe", "pipe", "pipe"],
		});

		let stdout = "";
		let stderr = "";

		proc.stdout.on("data", (data: Buffer) => {
			stdout += data.toString();
		});

		proc.stderr.on("data", (data: Buffer) => {
			stderr += data.toString();
		});

		proc.on("close", (code) => {
			resolve({ stdout, stderr, exitCode: code });
		});

		proc.on("error", (err) => {
			stderr += err.message;
			resolve({ stdout, stderr, exitCode: 1 });
		});
	});
}

/** Create a temp project directory with given files */
export async function createTempProject(files: Record<string, string>): Promise<string> {
	const dir = join(tmpdir(), `kapy-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
	await mkdir(dir, { recursive: true });

	for (const [name, content] of Object.entries(files)) {
		const filePath = join(dir, name);
		const dirPath = join(filePath, "..");
		await mkdir(dirPath, { recursive: true });
		await writeFile(filePath, content);
	}

	return dir;
}

/** Clean up a temp directory */
export async function cleanupTemp(dir: string): Promise<void> {
	await rm(dir, { recursive: true, force: true });
}

/** Sleep for a given number of milliseconds */
export function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Default kapy.config.ts for testing — using plain object export since relative imports won't resolve from temp dirs */
export const DEFAULT_CONFIG_TS = `// @ts-nocheck
export default {
  name: "test-cli",
  extensions: [],
};
`;

/** Minimal package.json for testing */
export const MINIMAL_PACKAGE_JSON = JSON.stringify(
	{
		name: "test-project",
		version: "0.0.1",
		type: "module",
	},
	null,
	2,
);
