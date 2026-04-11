/** kapy config — view/edit configuration */
import { readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { CommandContext } from "../command/context.js";

export const configCommand = async (ctx: CommandContext): Promise<void> => {
	const positionalArgs = (ctx.args as Record<string, unknown>).rest as string[] | undefined;
	const key = positionalArgs?.[0];
	const value = positionalArgs?.[1];
	const global = ctx.args.global as boolean;

	if (key && value) {
		// Set a config value
		const targetPath = global ? join(homedir(), ".kapy", "config.json") : join(process.cwd(), ".kapy", "config.json");

		let config: Record<string, unknown> = {};
		try {
			const content = await readFile(targetPath, "utf-8");
			config = JSON.parse(content);
		} catch {
			// No config file yet
		}

		// Parse dot-notation keys: "ext.region" => { ext: { region: value } }
		const parts = key.split(".");
		let current: Record<string, unknown> = config;
		for (let i = 0; i < parts.length - 1; i++) {
			if (!current[parts[i]] || typeof current[parts[i]] !== "object") {
				current[parts[i]] = {};
			}
			current = current[parts[i]] as Record<string, unknown>;
		}
		current[parts[parts.length - 1]] = parseValue(value);

		const { mkdir } = await import("node:fs/promises");
		await mkdir(join(targetPath, ".."), { recursive: true });
		await writeFile(targetPath, JSON.stringify(config, null, 2));

		if (ctx.json) {
			console.log(JSON.stringify({ status: "success", key, value: parseValue(value) }));
		} else {
			ctx.log(`Set ${key} = ${value}${global ? " (global)" : ""}`);
		}
	} else if (key) {
		// Get a config value
		const config = ctx.config;
		const parts = key.split(".");
		let result: unknown = config;
		for (const part of parts) {
			if (result && typeof result === "object") {
				result = (result as Record<string, unknown>)[part];
			} else {
				result = undefined;
				break;
			}
		}

		if (ctx.json) {
			console.log(JSON.stringify({ key, value: result ?? null }));
		} else {
			ctx.log(`${key}: ${JSON.stringify(result) ?? "(not set)"}`);
		}
	} else {
		// Show all config
		if (ctx.json) {
			console.log(JSON.stringify(ctx.config));
		} else {
			ctx.log("Current configuration:");
			for (const [ns, values] of Object.entries(ctx.config)) {
				ctx.log(`  [${ns}]`);
				if (typeof values === "object" && values !== null) {
					for (const [k, v] of Object.entries(values as Record<string, unknown>)) {
						ctx.log(`    ${k} = ${JSON.stringify(v)}`);
					}
				}
			}
		}
	}
};

/** Parse a string value into the appropriate type */
function parseValue(value: string): unknown {
	if (value === "true") return true;
	if (value === "false") return false;
	if (value === "null") return null;
	if (!Number.isNaN(Number(value))) return Number(value);
	if (value.startsWith("[") || value.startsWith("{")) {
		try {
			return JSON.parse(value);
		} catch {
			return value;
		}
	}
	return value;
}
