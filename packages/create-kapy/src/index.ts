/**
 * create-kapy — scaffold a new kapy-powered CLI project.
 *
 * Usage: bun create kapy <project-name> [--template]
 */
import { scaffold } from "./scaffold.js";

const args = process.argv.slice(2);
const projectName = args[0];
const template = args.includes("--template") || args.includes("-t");

if (!projectName) {
	console.error("Usage: bun create kapy <project-name> [--template]");
	console.error("");
	console.error("Options:");
	console.error("  --template, -t    Include example commands and extension");
	process.exit(1);
}

// Validate project name
if (!/^[a-z0-9-]+$/.test(projectName)) {
	console.error(`Invalid project name: "${projectName}"`);
	console.error("Use lowercase letters, numbers, and hyphens only.");
	process.exit(2);
}

// Check if directory already exists
try {
	const stat = await Bun.file(`./${projectName}`).stat();
	if (stat) {
		console.error(`Directory "${projectName}" already exists.`);
		process.exit(3);
	}
} catch {
	// Directory doesn't exist, proceed
}

console.log(`Creating kapy project: ${projectName}${template ? " (with template)" : ""}`);

await scaffold(projectName, { template });

console.log("");
console.log("✓ Project created!");
console.log("");
console.log("Next steps:");
console.log(`  cd ${projectName}`);
console.log("  bun install");
console.log("  bun run dev");
console.log("");
console.log("Happy coding! 🐉");
