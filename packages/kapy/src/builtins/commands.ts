/** kapy commands — list all registered commands with agent mode support */
import type { CommandHandler } from "../command/parser.js";
import type { CommandRegistry } from "../command/registry.js";

export function createCommandsCommand(registry: CommandRegistry): CommandHandler {
	return async (ctx) => {
		const commands = registry.all();

		// Agent mode: output full manifest with agentHints, args, flags
		if (ctx.args.agent === true) {
			const manifest = commands.map((cmd) => {
				const entry: Record<string, unknown> = {
					name: cmd.name,
					description: cmd.options.description,
					args: cmd.options.args ?? [],
					flags: cmd.options.flags
						? Object.entries(cmd.options.flags).map(([key, def]) => ({
								name: key,
								...def,
							}))
						: [],
					hidden: cmd.options.hidden ?? false,
				};
				if (cmd.agentHints) {
					entry.agentHints = cmd.agentHints;
				}
				return entry;
			});

			// Schema mode: output JSON Schema format
			if (ctx.args.schema === true) {
				const schema = {
					$schema: "https://json-schema.org/draft/2020-12/schema",
					title: "KapyCommandManifest",
					type: "array",
					items: {
						type: "object",
						properties: {
							name: { type: "string", description: "Command name" },
							description: { type: "string", description: "Command description" },
							args: {
								type: "array",
								items: {
									type: "object",
									properties: {
										name: { type: "string" },
										description: { type: "string" },
										required: { type: "boolean" },
										variadic: { type: "boolean" },
									},
								},
							},
							flags: {
								type: "array",
								items: {
									type: "object",
									properties: {
										name: { type: "string" },
										type: { type: "string", enum: ["string", "boolean", "number"] },
										description: { type: "string" },
										alias: { type: "string" },
										required: { type: "boolean" },
									},
								},
							},
							hidden: { type: "boolean" },
							agentHints: {
								type: "object",
								properties: {
									purpose: { type: "string" },
									when: { type: "string" },
									output: { type: "string" },
									sideEffects: { type: "string" },
									requires: { type: "array", items: { type: "string" } },
								},
							},
						},
						required: ["name", "description"],
					},
				};

				ctx.setResult(schema);
				if (ctx.json) {
					ctx.markJsonEmitted();
					console.log(JSON.stringify(schema, null, 2));
				} else if (ctx.compact) {
					ctx.compactLine(JSON.stringify(schema));
				} else {
					console.log(JSON.stringify(schema, null, 2));
				}
				return;
			}

			// Agent mode (no schema): output full manifest
			ctx.setResult(manifest);
			if (ctx.compact) {
				ctx.compactLine(JSON.stringify(manifest));
			} else {
				ctx.markJsonEmitted();
				console.log(JSON.stringify(manifest, null, 2));
			}
			return;
		}

		// JSON mode (pre-existing): output full manifest
		if (ctx.json) {
			const output = commands.map((cmd) => ({
				name: cmd.name,
				description: cmd.options.description,
				args: cmd.options.args ?? [],
				flags: cmd.options.flags
					? Object.entries(cmd.options.flags).map(([key, def]) => ({
							name: key,
							...def,
						}))
					: [],
				hidden: cmd.options.hidden ?? false,
				agentHints: cmd.agentHints,
			}));
			ctx.setResult(output);
			ctx.markJsonEmitted();
			console.log(JSON.stringify(output, null, 2));
			return;
		}

		// Compact mode: condensed tabular output
		if (ctx.compact) {
			const compactData = commands
				.filter((cmd) => !cmd.options.hidden)
				.map((cmd) => ({ name: cmd.name, description: cmd.options.description }));
			ctx.setResult(compactData);
			for (const cmd of commands) {
				if (cmd.options.hidden) continue;
				ctx.compactLine(`${cmd.name}\t${cmd.options.description}`);
			}
			return;
		}

		// Default: human-readable output
		ctx.log("Available commands:");
		for (const cmd of commands) {
			if (cmd.options.hidden) continue;
			ctx.log(`  ${cmd.name.padEnd(20)} ${cmd.options.description}`);
		}
	};
}
