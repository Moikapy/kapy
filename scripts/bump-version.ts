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

// Publish order matters — dependencies first
const PACKAGES = ["kapy-components", "kapy", "create-kapy"];

function readPkg(name: string) {
  const path = resolve(rootDir, "packages", name, "package.json");
  return { path, pkg: JSON.parse(readFileSync(path, "utf-8")) };
}

function writePkg(name: string, pkg: Record<string, unknown>) {
  const { path } = readPkg(name);
  writeFileSync(path, JSON.stringify(pkg, null, "\t") + "\n");
}

function bumpVersion(current: string, semver: string): string {
  if (/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(semver)) return semver;

  const [major, minor, patch] = current.split(".").map(Number);
  const base = current.includes("-") ? current.split("-")[0] : current;
  const [bMajor, bMinor] = base.split(".").map(Number);
  const bPatch = Number(base.split(".")[2]);

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

  // Update all three packages
  for (const name of PACKAGES) {
    const { pkg } = readPkg(name);

    // Update own version
    pkg.version = newVersion;

    // Update internal dependencies that reference other kapy packages
    for (const depField of ["dependencies", "devDependencies", "peerDependencies"] as const) {
      const deps = pkg[depField] as Record<string, string> | undefined;
      if (!deps) continue;
      for (const depName of PACKAGES) {
        if (deps[depName] && deps[depName].startsWith("^")) {
          deps[depName] = `^${newVersion}`;
        } else if (deps[depName]) {
          deps[depName] = newVersion;
        }
      }
    }

    writePkg(name, pkg);
    console.log(`  ✓ ${name}@${newVersion}`);
  }

  console.log(`\nDone! Next steps:`);
  console.log(`  1. Review the changes: git diff`);
  console.log(`  2. Commit: git commit -am "chore: bump version to ${newVersion}"`);
  console.log(`  3. Tag: git tag v${newVersion} -m "v${newVersion}"`);
  console.log(`  4. Push: git push origin master v${newVersion}`);
}

main();