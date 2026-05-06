#!/usr/bin/env bun
import { kapy } from "@moikapy/kapy";
import { keyGenerateCommand, keyRotateCommand } from "./commands/key.js";
import { packCommand, verifyCommand } from "./commands/pack.js";
import { publishCommand } from "./commands/publish.js";

const cli = kapy();

cli
	.command(
		"pack",
		{
			description: "Check what files will be included in the npm package",
			args: [{ name: "directory", description: "Package directory (default: .)" }],
			flags: {
				json: { type: "boolean", alias: "j", description: "JSON output", default: false },
			},
		},
		packCommand,
	)

	.command(
		"verify",
		{
			description: "Verify package build — check package.json, exports, files, build, dist/",
			args: [{ name: "directory", description: "Package directory (default: .)" }],
			flags: {
				json: { type: "boolean", alias: "j", description: "JSON output", default: false },
			},
		},
		verifyCommand,
	)

	.command(
		"publish",
		{
			description: "Build and publish an npm package with pre-flight checks",
			args: [{ name: "directory", description: "Package directory (default: .)" }],
			flags: {
				access: { type: "string", description: "Access level: public or restricted", default: "public" },
				tag: { type: "string", alias: "t", description: "Dist tag (latest, beta, next)", default: "latest" },
				dryRun: { type: "boolean", description: "Run without actually publishing", default: false },
				json: { type: "boolean", alias: "j", description: "JSON output", default: false },
			},
		},
		publishCommand,
	)

	.command(
		"key-generate",
		{
			description: "Generate a 256-bit encryption key (64 hex chars) for AES-256-GCM",
			flags: {
				json: { type: "boolean", alias: "j", description: "JSON output", default: false },
			},
		},
		keyGenerateCommand,
	)

	.command(
		"key-rotate",
		{
			description: "Generate a new encryption key with rotation instructions",
			flags: {
				currentEnv: { type: "string", description: "Current key env var name", default: "OPENROUTER_ENCRYPT_KEY" },
				previousEnv: {
					type: "string",
					description: "Previous key env var name",
					default: "OPENROUTER_ENCRYPT_KEY_PREVIOUS",
				},
				json: { type: "boolean", alias: "j", description: "JSON output", default: false },
			},
		},
		keyRotateCommand,
	);

cli.run().catch((err: Error) => {
	console.error(err.message);
	process.exit(1);
});
