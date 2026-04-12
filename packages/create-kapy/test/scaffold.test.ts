/**
 * create-kapy scaffold tests.
 */
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scaffold } from "../src/scaffold.js";

describe("scaffold", () => {
	let tempDir: string;

	// Create a fresh temp dir for each test
	beforeEach(async () => {
		tempDir = join(tmpdir(), `kapy-scaffold-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
	});

	afterEach(async () => {
		try {
			await rm(tempDir, { recursive: true, force: true });
		} catch {
			// ignore
		}
	});

	it("creates all expected files", async () => {
		await scaffold("test-project", { cwd: tempDir });

		const projectDir = join(tempDir, "test-project");

		const expectedFiles = [
			".kapy/config.json",
			"package.json",
			"kapy.config.ts",
			"tsconfig.json",
			".gitignore",
			"src/index.ts",
			"src/commands/deploy.ts",
		];

		for (const file of expectedFiles) {
			const filePath = join(projectDir, file);
			const content = await readFile(filePath, "utf-8");
			expect(content.length).toBeGreaterThan(0);
		}

		// Check directories exist
		const dirs = [".kapy", ".kapy/extensions", "src", "src/commands"];
		for (const dir of dirs) {
			const entries = await readdir(join(projectDir, dir));
			expect(entries).toBeDefined();
		}
	});

	it("creates template extension files with --template flag", async () => {
		await scaffold("test-project", { template: true, cwd: tempDir });

		const extFile = join(tempDir, "test-project", "src", "extensions", "index.ts");
		const content = await readFile(extFile, "utf-8");
		expect(content).toContain("register");
		expect(content).toContain("meta");
		expect(content).toContain("addCommand");
		expect(content).toContain("addHook");
	});

	it("package.json has correct fields", async () => {
		await scaffold("test-project", { cwd: tempDir });

		const pkgPath = join(tempDir, "test-project", "package.json");
		const content = await readFile(pkgPath, "utf-8");
		const pkg = JSON.parse(content);

		expect(pkg.name).toBe("test-project");
		expect(pkg.version).toBe("0.1.0");
		expect(pkg.type).toBe("module");
		expect(pkg.dependencies).toHaveProperty("@moikapy/kapy");
		expect(pkg.dependencies).toHaveProperty("@moikapy/kapy-components");
		expect(pkg.scripts).toHaveProperty("dev");
		expect(pkg.scripts).toHaveProperty("build");
		expect(pkg.scripts).toHaveProperty("test");
	});

	it("kapy.config.ts has correct project name", async () => {
		await scaffold("test-project", { cwd: tempDir });

		const configPath = join(tempDir, "test-project", "kapy.config.ts");
		const content = await readFile(configPath, "utf-8");
		expect(content).toContain("test-project");
		expect(content).toContain("defineConfig");
	});

	it(".gitignore contains expected entries", async () => {
		await scaffold("test-project", { cwd: tempDir });

		const gitignorePath = join(tempDir, "test-project", ".gitignore");
		const content = await readFile(gitignorePath, "utf-8");
		expect(content).toContain("node_modules");
		expect(content).toContain("dist");
		expect(content).toContain(".kapy");
	});
});
