/**
 * Publish all packages to npm in dependency order.
 *
 * Usage:
 *   bun run release              # publish all 3 packages (latest tag)
 *   bun run release --dry-run     # dry run (no actual publish)
 *   bun run release --tag next     # publish with "next" tag (prerelease)
 *   bun run release kapy           # publish only the named package
 *
 * Prerequisites:
 *   - Must be logged in: npm whoami
 *   - Build must pass: bun run build && bun test
 *
 * Publish order: kapy-components → kapy → create-kapy
 *   (kapy depends on kapy-components, create-kapy depends on kapy)
 */

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

const PACKAGES = ["kapy-components", "kapy", "create-kapy"];

function getPkgVersion(name: string): string {
  const path = resolve(rootDir, "packages", name, "package.json");
  const pkg = JSON.parse(readFileSync(path, "utf-8"));
  return pkg.version;
}

function npmPublish(name: string, tag: string, dryRun: boolean): boolean {
  const pkgDir = resolve(rootDir, "packages", name);
  const version = getPkgVersion(name);
  const cmd = dryRun
    ? `npm publish --dry-run --access public${tag !== "latest" ? ` --tag ${tag}` : ""}`
    : `npm publish --access public${tag !== "latest" ? ` --tag ${tag}` : ""}`;

  console.log(`\n📦 Publishing ${name}@${version}${dryRun ? " (dry run)" : ""}${tag !== "latest" ? ` [${tag}]` : ""}`);

  try {
    execSync(cmd, { cwd: pkgDir, stdio: "inherit" });
    console.log(`  ✓ ${name}@${version} published${dryRun ? " (simulated)" : ""}`);
    return true;
  } catch (error) {
    console.error(`  ✗ Failed to publish ${name}@${version}`);
    return false;
  }
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run") || args.includes("-n");
  const tagIdx = args.indexOf("--tag");
  const tag = tagIdx !== -1 ? args[tagIdx + 1] : "latest";
  const onlyPkg = args.find((a) => !a.startsWith("-") && a !== tag);

  // Validate npm auth
  if (!dryRun) {
    try {
      const whoami = execSync("npm whoami", { encoding: "utf-8" }).trim();
      console.log(`🔑 Publishing as: ${whoami}`);
    } catch {
      console.error("❌ Not authenticated with npm. Run: npm login");
      console.error("   Or check ~/.npmrc for a valid auth token.");
      process.exit(1);
    }
  }

  // Determine which packages to publish
  const toPublish = onlyPkg
    ? PACKAGES.filter((p) => p === onlyPkg)
    : PACKAGES;

  if (toPublish.length === 0) {
    console.error(`❌ Unknown package: "${onlyPkg}". Available: ${PACKAGES.join(", ")}`);
    process.exit(1);
  }

  console.log(`🚀 Kapy Release${dryRun ? " (dry run)" : ""}`);
  console.log(`   Tag: ${tag}`);
  console.log(`   Packages: ${toPublish.join(", ")}`);

  // Verify build is fresh
  console.log(`\n🔨 Building...`);
  try {
    execSync("bun run build", { cwd: rootDir, stdio: "inherit" });
  } catch {
    console.error("❌ Build failed. Fix errors before publishing.");
    process.exit(1);
  }

  // Verify tests pass
  console.log(`\n🧪 Running tests...`);
  try {
    execSync("bun test packages/kapy/test/ packages/create-kapy/test/", { cwd: rootDir, stdio: "inherit" });
  } catch {
    console.error("❌ Tests failed. Fix failures before publishing.");
    process.exit(1);
  }

  // Publish in order
  let failed = false;
  for (const name of toPublish) {
    const ok = npmPublish(name, tag, dryRun);
    if (!ok) {
      failed = true;
      break; // stop — later packages depend on earlier ones
    }
  }

  if (failed) {
    console.error("\n❌ Release failed. Some packages were not published.");
    process.exit(1);
  }

  if (!dryRun) {
    console.log(`\n✅ Successfully published ${toPublish.length} package(s)!`);
    console.log(`\nNext steps:`);
    console.log(`  git push origin master`);
    console.log(`  git tag v${getPkgVersion(toPublish[0])} -m "v${getPkgVersion(toPublish[0])}"`);
    console.log(`  git push origin v${getPkgVersion(toPublish[0])}`);
  } else {
    console.log(`\n✅ Dry run complete. No packages were published.`);
    console.log(`   Run without --dry-run to publish for real.`);
  }
}

main();