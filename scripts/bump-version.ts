/**
 * Bump version across all packages in the monorepo.
 *
 * Usage:
 *   bun run version:bump [patch|minor|major|<exact-version>]
 *
 * Examples:
 *   bun run version:bump patch     # 0.1.0 → 0.1.1
 *   bun run version:bump minor     # 0.1.0 → 0.2.0
 *   bun run version:bump major     # 0.1.0 → 1.0.0
 *   bun run version:bump 0.2.0     # exact version
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

// Scoped package names → directory names
const PACKAGES = {
	"@moikapy/kapy-components": "kapy-components",
	"@moikapy/kapy": "kapy",
};

function readPkg(pkgDir: string) {
	const path = resolve(rootDir, "packages", pkgDir, "package.json");
	return { path, pkg: JSON.parse(readFileSync(path, "utf-8")) };
}

function writePkg(pkgDir: string, pkg: Record<string, unknown>) {
	const { path } = readPkg(pkgDir);
	writeFileSync(path, JSON.stringify(pkg, null, "\t") + "\n");
}

function bumpVersion(current: string, semver: string): string {
	if (/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(semver)) return semver;

	const base = current.includes("-") ? current.split("-")[0] : current;
	const [bMajor, bMinor, bPatch] = base.split(".").map(Number);

	switch (semver) {
		case "patch": return `${bMajor}.${bMinor}.${bPatch + 1}`;
		case "minor": return `${bMajor}.${bMinor + 1}.0`;
		case "major": return `${bMajor + 1}.0.0`;
		default:
			console.error(`Invalid version bump: "${semver}"`);
			console.error("Use: patch, minor, major, or an exact version like 0.2.0");
			process.exit(1);
	}
}

function main() {
	const semver = process.argv[2];
	if (!semver) {
		console.error("Usage: bun run version:bump <patch|minor|major|0.2.0>");
		process.exit(1);
	}

	// Get current version from kapy (canonical package)
	const { pkg: kapyPkg } = readPkg("kapy");
	const currentVersion = kapyPkg.version as string;
	const newVersion = bumpVersion(currentVersion, semver);

	console.log(`Bumping: ${currentVersion} → ${newVersion}`);

	const scopedNames = Object.keys(PACKAGES);

	// Update all three packages
	for (const [scopedName, pkgDir] of Object.entries(PACKAGES)) {
		const { pkg } = readPkg(pkgDir);

		// Update own version
		pkg.version = newVersion;

		// Update internal dependencies that reference other kapy packages
		for (const depField of ["dependencies", "devDependencies", "peerDependencies"] as const) {
			const deps = pkg[depField] as Record<string, string> | undefined;
			if (!deps) continue;
			for (const internalPkg of scopedNames) {
				if (deps[internalPkg] && deps[internalPkg].startsWith("^")) {
					deps[internalPkg] = `^${newVersion}`;
				} else if (deps[internalPkg]) {
					deps[internalPkg] = newVersion;
				}
			}
		}

		writePkg(pkgDir, pkg);
		console.log(`  ✓ ${scopedName}@${newVersion}`);
	}

	console.log(`\nDone! Next steps:`);
	console.log(`  1. Review the changes: git diff`);
	console.log(`  2. Commit: git commit -am "chore: bump version to ${newVersion}"`);
	console.log(`  3. Tag: git tag v${newVersion} -m "v${newVersion}"`);
	console.log(`  4. Push: git push origin master v${newVersion}`);
}

main();