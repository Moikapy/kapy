import { describe, expect, it } from "bun:test";
import { detectPackageManagers, getInstallArgs, PACKAGE_MANAGERS } from "../src/builtins/package-managers.js";

describe("package-managers", () => {
	describe("PACKAGE_MANAGERS", () => {
		it("lists all four package managers in preference order", () => {
			expect(PACKAGE_MANAGERS).toHaveLength(4);
			expect(PACKAGE_MANAGERS.map((pm) => pm.name)).toEqual(["bun", "npm", "yarn", "pnpm"]);
		});

		it("each PM has a name and args function", () => {
			for (const pm of PACKAGE_MANAGERS) {
				expect(pm.name).toBeTruthy();
				expect(typeof pm.args).toBe("function");
			}
		});
	});

	describe("detectPackageManagers", () => {
		it("returns an array of available package managers", () => {
			const available = detectPackageManagers();
			expect(Array.isArray(available)).toBe(true);
			// At least one PM should be available on a dev machine
			expect(available.length).toBeGreaterThan(0);
		});

		it("only returns known package managers", () => {
			const known = ["bun", "npm", "yarn", "pnpm"];
			const available = detectPackageManagers();
			for (const pm of available) {
				expect(known).toContain(pm);
			}
		});

		it("returns PMs in preference order", () => {
			const available = detectPackageManagers();
			for (let i = 1; i < available.length; i++) {
				const prevIndex = PACKAGE_MANAGERS.findIndex((p) => p.name === available[i - 1]);
				const currIndex = PACKAGE_MANAGERS.findIndex((p) => p.name === available[i]);
				expect(prevIndex).toBeLessThan(currIndex);
			}
		});
	});

	describe("getInstallArgs", () => {
		it("returns correct install args for bun", () => {
			expect(getInstallArgs("bun", "some-pkg")).toEqual(["add", "-g", "some-pkg"]);
		});

		it("returns correct install args for npm", () => {
			expect(getInstallArgs("npm", "some-pkg")).toEqual(["install", "-g", "some-pkg"]);
		});

		it("returns correct install args for yarn", () => {
			expect(getInstallArgs("yarn", "some-pkg")).toEqual(["global", "add", "some-pkg"]);
		});

		it("returns correct install args for pnpm", () => {
			expect(getInstallArgs("pnpm", "some-pkg")).toEqual(["add", "-g", "some-pkg"]);
		});

		it("returns null for unknown package manager", () => {
			expect(getInstallArgs("choco", "some-pkg")).toBeNull();
		});

		it("handles scoped package names", () => {
			expect(getInstallArgs("npm", "@moikapy/kapy@latest")).toEqual(["install", "-g", "@moikapy/kapy@latest"]);
		});

		it("handles package names with version specifiers", () => {
			expect(getInstallArgs("bun", "some-pkg@^1.0.0")).toEqual(["add", "-g", "some-pkg@^1.0.0"]);
		});
	});
});
