/**
 * Package manager detection and command generation.
 * Shared by install, upgrade, and any command that needs to run package managers.
 */
import { execSync } from "node:child_process";

export interface PackageManager {
	name: string;
	args: (pkg: string) => string[];
}

/** Package managers in preference order for global installs */
export const PACKAGE_MANAGERS: PackageManager[] = [
	{
		name: "bun",
		args: (pkg) => ["add", "-g", pkg],
	},
	{
		name: "npm",
		args: (pkg) => ["install", "-g", pkg],
	},
	{
		name: "yarn",
		args: (pkg) => ["global", "add", pkg],
	},
	{
		name: "pnpm",
		args: (pkg) => ["add", "-g", pkg],
	},
];

/** Detect which package managers are available on this system */
export function detectPackageManagers(): string[] {
	return PACKAGE_MANAGERS.filter((pm) => {
		try {
			execSync(`${pm.name} --version`, { stdio: "pipe" });
			return true;
		} catch {
			return false;
		}
	}).map((pm) => pm.name);
}

/** Get install args for a given package manager and package spec */
export function getInstallArgs(pmName: string, pkg: string): string[] | null {
	const pm = PACKAGE_MANAGERS.find((p) => p.name === pmName);
	return pm ? pm.args(pkg) : null;
}
