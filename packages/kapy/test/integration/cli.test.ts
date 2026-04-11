/**
 * CLI integration tests — spawn the kapy CLI as a subprocess and verify output.
 */
import { describe, expect, it } from "bun:test";
import { spawnCLI } from "../helpers.js";

/** Extract the first JSON value from output that may contain multiple JSON documents */
function parseFirstJSON(output: string): unknown {
	const trimmed = output.trim();
	// Try to find where the first JSON ends
	let depth = 0;
	let inString = false;
	let isEscaped = false;

	for (let i = 0; i < trimmed.length; i++) {
		const ch = trimmed[i];
		if (isEscaped) {
			isEscaped = false;
			continue;
		}
		if (ch === "\\") {
			isEscaped = true;
			continue;
		}
		if (ch === '"') {
			inString = !inString;
			continue;
		}
		if (inString) continue;

		if (ch === "{") depth++;
		if (ch === "}") depth--;
		if (ch === "[") depth++;
		if (ch === "]") depth--;

		if (depth === 0) {
			return JSON.parse(trimmed.slice(0, i + 1));
		}
	}

	return JSON.parse(trimmed);
}

describe("CLI Integration", () => {
	it("shows help when no command is given", async () => {
		const result = await spawnCLI([]);
		expect(result.exitCode).toBe(2);
		expect(result.stdout).toContain("kapy");
		expect(result.stdout).toContain("Available commands:");
	});

	it("shows help with 🐹 branding", async () => {
		const result = await spawnCLI([]);
		expect(result.stdout).toContain("🐹");
	});

	it("shows error for unknown command", async () => {
		const result = await spawnCLI(["nonexistent-command"]);
		expect(result.exitCode).toBe(2);
		expect(result.stdout).toContain("Available commands:");
	});

	it("outputs JSON error for unknown command with --json", async () => {
		const result = await spawnCLI(["--json", "nonexistent-command"]);
		expect(result.exitCode).toBe(0);
		const parsed = parseFirstJSON(result.stdout);
		expect(parsed).toHaveProperty("status", "error");
		expect(parsed).toHaveProperty("commands");
	});

	it("lists built-in commands", async () => {
		const result = await spawnCLI(["commands"]);
		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain("init");
		expect(result.stdout).toContain("install");
		expect(result.stdout).toContain("config");
	});

	it("outputs commands as JSON with --json flag", async () => {
		const result = await spawnCLI(["commands", "--json"]);
		expect(result.exitCode).toBe(0);
		const parsed = parseFirstJSON(result.stdout);
		expect(Array.isArray(parsed)).toBe(true);
		const names = (parsed as Array<{ name: string }>).map((c) => c.name);
		expect(names).toContain("init");
		expect(names).toContain("install");
		expect(names).toContain("commands");
		expect(names).toContain("inspect");
	});

	it("shows inspect output", async () => {
		const result = await spawnCLI(["inspect"]);
		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain("Commands:");
		expect(result.stdout).toContain("Middleware:");
	});

	it("outputs inspect as JSON with --json flag", async () => {
		const result = await spawnCLI(["inspect", "--json"]);
		expect(result.exitCode).toBe(0);
		const parsed = parseFirstJSON(result.stdout);
		expect(parsed).toHaveProperty("commands");
		expect(parsed).toHaveProperty("middlewareCount");
		expect(parsed).toHaveProperty("hooks");
	});

	it("shows version-like info in help", async () => {
		const result = await spawnCLI([]);
		expect(result.exitCode).toBe(2);
		expect(result.stdout).toContain("Scaffold");
		expect(result.stdout).toContain("Install");
	});
});
