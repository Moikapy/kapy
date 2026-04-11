/**
 * Scaffold — creates a new kapy-powered CLI project.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface ScaffoldOptions {
	template?: boolean;
}

export async function scaffold(name: string, options: ScaffoldOptions = {}): Promise<void> {
	const dir = join(process.cwd(), name);

	// Create directory structure
	await mkdir(join(dir, ".kapy"), { recursive: true });
	await mkdir(join(dir, ".kapy", "extensions"), { recursive: true });
	await mkdir(join(dir, "src", "commands"), { recursive: true });
	if (options.template) {
		await mkdir(join(dir, "src", "extensions"), { recursive: true });
	}

	// Write files
	await writeConfigJson(dir);
	await writePackageJson(dir, name);
	await writeKapyConfig(dir, name);
	await writeTsConfig(dir);
	await writeGitignore(dir);
	await writeSrcIndex(dir, name);
	await writeDeployCommand(dir);

	if (options.template) {
		await writeExtension(dir, name);
	}

	// Write .kapy/config.json
	await writeFile(join(dir, ".kapy", "config.json"), `${JSON.stringify({ extensions: {} }, null, 2)}\n`);
}

async function writeConfigJson(dir: string): Promise<void> {
	await writeFile(join(dir, ".kapy", "config.json"), `${JSON.stringify({ extensions: {} }, null, 2)}\n`);
}

async function writePackageJson(dir: string, name: string): Promise<void> {
	const pkg = {
		name,
		version: "0.1.0",
		type: "module",
		main: "./dist/index.js",
		bin: { [name]: "./dist/index.js" },
		scripts: {
			dev: "bun run --watch src/index.ts",
			build: "bun build src/index.ts --outdir dist --target bun",
			test: "bun test",
		},
		dependencies: {
			kapy: "^0.1.0",
			"kapy-components": "^0.1.0",
		},
		devDependencies: {
			typescript: "^5.7.0",
			"@types/bun": "^1.2.0",
		},
	};
	await writeFile(join(dir, "package.json"), `${JSON.stringify(pkg, null, 2)}\n`);
}

async function writeKapyConfig(dir: string, name: string): Promise<void> {
	const config = `import { defineConfig } from "kapy";

export default defineConfig({
  name: "${name}",
  extensions: [],
  middleware: [],
});
`;
	await writeFile(join(dir, "kapy.config.ts"), config);
}

async function writeTsConfig(dir: string): Promise<void> {
	const tsconfig = {
		extends: "./node_modules/kapy/tsconfig.json",
		compilerOptions: {
			outDir: "./dist",
			rootDir: "./src",
		},
		include: ["src"],
	};
	await writeFile(join(dir, "tsconfig.json"), `${JSON.stringify(tsconfig, null, 2)}\n`);
}

async function writeGitignore(dir: string): Promise<void> {
	await writeFile(
		join(dir, ".gitignore"),
		`node_modules/
dist/
.kapy/
*.tsbuildinfo
`,
	);
}

async function writeSrcIndex(dir: string, name: string): Promise<void> {
	const index = `import { kapy } from "kapy";

kapy()
  .command("hello", {
    description: "Say hello from ${name}",
    args: [{ name: "name", description: "Who to greet", default: "world" }],
  }, async (ctx) => {
    ctx.log(\`Hello, \${ctx.args.name}! 👋\`);
  })
  .run();
`;
	await writeFile(join(dir, "src", "index.ts"), index);
}

async function writeDeployCommand(dir: string): Promise<void> {
	const deploy = `import type { CommandHandler } from "kapy";

export const deployCommand: CommandHandler = async (ctx) => {
  const env = (ctx.args.env as string) ?? "staging";
  ctx.log(\`Deploying to \${env}...\`);

  // Your deployment logic here
  ctx.log("✓ Deployment complete!");
};
`;
	await writeFile(join(dir, "src", "commands", "deploy.ts"), deploy);
}

async function writeExtension(dir: string, name: string): Promise<void> {
	const ext = `import type { KapyExtensionAPI } from "kapy";

export async function register(api: KapyExtensionAPI) {
  api.addCommand("hello:ext", {
    description: "Hello from the ${name} extension",
  }, async (ctx) => {
    ctx.log("Hello from extension! 🎉");
  });

  api.addHook("before:hello", async (ctx) => {
    ctx.log("Hook: About to say hello...");
  });
}

export const meta = {
  name: "${name}-extension",
  version: "0.1.0",
  dependencies: [],
};
`;
	await writeFile(join(dir, "src", "extensions", "index.ts"), ext);
}
