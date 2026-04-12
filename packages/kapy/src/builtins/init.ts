/** kapy init — scaffold a new kapy-powered CLI project */

import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { CommandContext } from "../command/context.js";

/** Run a command safely */
async function runCommand(
	command: string,
	args: string[],
	options?: { cwd?: string; stdio?: "pipe" | "inherit" },
): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
	return new Promise((resolve) => {
		const proc = spawn(command, args, {
			cwd: options?.cwd,
			stdio: options?.stdio ?? "pipe",
		});
		let stdout = "";
		let stderr = "";
		proc.stdout?.on("data", (data: Buffer) => {
			stdout += data.toString();
		});
		proc.stderr?.on("data", (data: Buffer) => {
			stderr += data.toString();
		});
		proc.on("close", (code) => {
			resolve({ stdout, stderr, exitCode: code });
		});
		proc.on("error", (err) => {
			resolve({ stdout, stderr: stderr + err.message, exitCode: 1 });
		});
	});
}

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
		const cmd = template ? ["create", "@moikapy/kapy", projectName, "--template"] : ["create", "@moikapy/kapy", projectName];

		const result = await runCommand("bunx", cmd, {
			cwd: process.cwd(),
			stdio: ctx.json ? "pipe" : "inherit",
		});

		if (result.exitCode === 0) {
			spinner.succeed(`Created ${projectName}`);
		} else {
			// create-kapy not available — scaffold manually
			spinner.update("create-kapy not found, scaffolding manually...");
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

async function scaffoldManual(name: string, dir: string, _template: boolean): Promise<void> {
	await mkdir(join(dir, ".kapy"), { recursive: true });
	await mkdir(join(dir, ".kapy", "extensions"), { recursive: true });
	await mkdir(join(dir, "src"), { recursive: true });
	await mkdir(join(dir, "src", "commands"), { recursive: true });

	await writeFile(
		join(dir, "package.json"),
		`${JSON.stringify(
			{
				name,
				version: "0.1.0",
				type: "module",
				main: "./dist/index.js",
				scripts: { dev: "bun run --watch src/index.ts", build: "bun build src/index.ts --outdir dist --target bun" },
				dependencies: { kapy: "^0.1.0" },
				devDependencies: { typescript: "^5.7.0" },
			},
			null,
			2,
		)}\n`,
	);

	await writeFile(
		join(dir, "kapy.config.ts"),
		`import { defineConfig } from "@moikapy/kapy";

export default defineConfig({
  name: "${name}",
  extensions: [],
});
`,
	);

	await writeFile(
		join(dir, "src", "index.ts"),
		`import { kapy } from "@moikapy/kapy";

kapy()
  .command("hello", {
    description: "Say hello from ${name}",
    args: [{ name: "name", description: "Who to greet", default: "world" }],
  }, async (ctx) => {
    ctx.log(\`Hello, \${ctx.args.name}! 👋\`);
  })
  .run();
`,
	);
}
