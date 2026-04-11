/** kapy init — scaffold a new kapy-powered CLI project */
import { execSync } from "node:child_process";
import { resolve } from "node:path";
import type { CommandContext } from "../command/context.js";

export const initCommand = async (ctx: CommandContext): Promise<void> => {
	const positionalArgs = (ctx.args as Record<string, unknown>).rest as string[] | undefined;
	const projectName = positionalArgs?.[0];
	const template = ctx.args.template as boolean;

	if (!projectName) {
		ctx.error("Usage: kapy init <name> [--template]");
		ctx.abort(2);
	}

	// Validate project name
	if (!/^[a-z0-9-]+$/.test(projectName)) {
		ctx.error(`Invalid project name: "${projectName}". Use lowercase letters, numbers, and hyphens only.`);
		ctx.abort(2);
	}

	const cwd = resolve(process.cwd(), projectName);
	const spinner = ctx.spinner(`Scaffolding project: ${projectName}`);
	spinner.start();

	try {
		// Try using create-kapy if available
		const cmd = template
			? `bun create kapy ${projectName} --template`
			: `bun create kapy ${projectName}`;

		try {
			execSync(cmd, { cwd: process.cwd(), stdio: ctx.json ? "pipe" : "inherit" });
			spinner.succeed(`Created ${projectName}`);
		} catch {
			// create-kapy not available — scaffold manually
			spinner.update(`create-kapy not found, scaffolding manually...`);
			await scaffoldManual(projectName, cwd, template);
			spinner.succeed(`Created ${projectName}`);
		}

		if (ctx.json) {
			console.log(JSON.stringify({ status: "success", project: projectName, path: cwd }));
		}
	} catch (err) {
		spinner.fail(`Failed to create ${projectName}`);
		throw err;
	}
};

async function scaffoldManual(name: string, dir: string, template: boolean): Promise<void> {
	const { mkdir, writeFile } = await import("node:fs/promises");
	const { join } = await import("node:path");

	await mkdir(join(dir, ".kapy"), { recursive: true });
	await mkdir(join(dir, ".kapy", "extensions"), { recursive: true });
	await mkdir(join(dir, "src"), { recursive: true });
	await mkdir(join(dir, "src", "commands"), { recursive: true });

	await writeFile(
		join(dir, "package.json"),
		JSON.stringify({
			name,
			version: "0.1.0",
			type: "module",
			main: "./dist/index.js",
			scripts: { dev: "bun run --watch src/index.ts", build: "bun build src/index.ts --outdir dist --target bun" },
			dependencies: { kapy: "^0.1.0" },
			devDependencies: { typescript: "^5.7.0" },
		}, null, 2),
	);

	await writeFile(join(dir, "kapy.config.ts"), `import { defineConfig } from "kapy";\n\nexport default defineConfig({\n  name: "${name}",\n  extensions: [],\n});\n`);

	await writeFile(join(dir, "src", "index.ts"), `import { kapy } from "kapy";\n\nkapy()\n  .command("hello", {\n    description: "Say hello",\n    args: [{ name: "name", description: "Who to greet", default: "world" }],\n  }, async (ctx) => {\n    ctx.log(\`Hello, \${ctx.args.name}! 👋\`);\n  })\n  .run();\n`);
}