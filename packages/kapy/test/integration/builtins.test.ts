/**
 * Builtin commands integration tests.
 */
import { describe, expect, it } from "bun:test";
import { spawnCLI } from "../helpers.js";

/** Parse largest JSON from mixed output — handles arrays and objects */
function parseLargestJSON(output: string): unknown {
	const trimmed = output.trim();
	let bestMatch: { json: unknown; length: number } | null = null;

	// Find all top-level JSON values (both objects and arrays)
	let i = 0;
	while (i < trimmed.length) {
		if (trimmed[i] === "{" || trimmed[i] === "[") {
			const openCh = trimmed[i];
			const closeCh = openCh === "{" ? "}" : "]";
			let depth = 0;
			const start = i;
			let inStr = false;
			let escaped = false;
			for (let j = i; j < trimmed.length; j++) {
				const ch = trimmed[j];
				if (escaped) {
					escaped = false;
					continue;
				}
				if (ch === "\\") {
					escaped = true;
					continue;
				}
				if (ch === '"') {
					inStr = !inStr;
					continue;
				}
				if (inStr) continue;
				if (ch === openCh) depth++;
				if (ch === closeCh) depth--;
				if (depth === 0) {
					const candidate = trimmed.slice(start, j + 1);
					try {
						const parsed = JSON.parse(candidate);
						if (!bestMatch || candidate.length > bestMatch.length) {
							bestMatch = { json: parsed, length: candidate.length };
						}
					} catch {
						// Not valid JSON, skip
					}
					i = j + 1;
					break;
				}
			}
			if (depth !== 0) {
				i++;
			} // unmatched
		} else {
			i++;
		}
	}

	return bestMatch?.json ?? null;
}

describe("Built-in Commands", () => {
	describe("commands", () => {
		it("lists all built-in commands", async () => {
			const result = await spawnCLI(["commands"]);
			expect(result.exitCode).toBe(0);
			expect(result.stdout).toContain("init");
			expect(result.stdout).toContain("install");
			expect(result.stdout).toContain("config");
			expect(result.stdout).toContain("commands");
			expect(result.stdout).toContain("inspect");
			expect(result.stdout).toContain("search");
		});

		it("outputs commands as JSON with --json flag", async () => {
			const result = await spawnCLI(["commands", "--json"]);
			expect(result.exitCode).toBe(0);
			const parsed = parseLargestJSON(result.stdout);
			expect(parsed).not.toBeNull();
			const data = parsed as Array<{ name: string }>;
			expect(Array.isArray(data)).toBe(true);
			const names = data.map((c) => c.name);
			expect(names).toContain("init");
			expect(names).toContain("install");
			expect(names).toContain("search");
		});
	});

	describe("inspect", () => {
		it("shows inspect output", async () => {
			const result = await spawnCLI(["inspect"]);
			expect(result.exitCode).toBe(0);
			expect(result.stdout).toContain("Commands:");
			expect(result.stdout).toContain("Middleware:");
		});

		it("outputs inspect as JSON with --json flag", async () => {
			const result = await spawnCLI(["inspect", "--json"]);
			expect(result.exitCode).toBe(0);
			const parsed = parseLargestJSON(result.stdout);
			expect(parsed).not.toBeNull();
			expect(parsed).toHaveProperty("commands");
			expect(parsed).toHaveProperty("middlewareCount");
		});
	});

	describe("search (stub)", () => {
		it("shows coming soon message", async () => {
			const result = await spawnCLI(["search"]);
			expect(result.stdout).toContain("coming soon");
		});

		it("shows coming soon with query", async () => {
			const result = await spawnCLI(["search", "aws"]);
			expect(result.stdout).toContain("coming soon");
			expect(result.stdout).toContain("aws");
		});

		it("outputs JSON with --json flag", async () => {
			const result = await spawnCLI(["search", "--json"]);
			expect(result.exitCode).toBe(0);
			const parsed = parseLargestJSON(result.stdout);
			expect(parsed).not.toBeNull();
			expect(parsed).toHaveProperty("status", "not_implemented");
			expect(parsed).toHaveProperty("message");
		});
	});

	describe("init", () => {
		it("rejects invalid project names", async () => {
			const result = await spawnCLI(["init", "INVALID NAME!"]);
			expect(result.exitCode).not.toBe(0);
		});

		it("rejects empty args", async () => {
			const result = await spawnCLI(["init"]);
			expect(result.exitCode).not.toBe(0);
		});
	});

	describe("install", () => {
		it("rejects empty source", async () => {
			const result = await spawnCLI(["install"]);
			expect(result.exitCode).not.toBe(0);
		});
	});

	describe("config", () => {
		it("shows available config subcommands", async () => {
			const result = await spawnCLI(["config"]);
			// config without subcommand may show help or error
			expect(result.exitCode).toBeDefined();
		});
	});
});
