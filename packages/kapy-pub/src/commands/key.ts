import type { CommandContext } from "@moikapy/kapy";
import { generateKey, rotateKey } from "../core.js";

export async function keyGenerateCommand(ctx: CommandContext): Promise<void> {
	const json = ctx.args.json as boolean;
	const result = generateKey();

	if (json) {
		ctx.emit("result", result);
		return;
	}

	console.log(`Generated 256-bit encryption key:\n`);
	console.log(result.key);
	console.log(`\nSet as OPENROUTER_ENCRYPT_KEY environment variable.`);
}

export async function keyRotateCommand(ctx: CommandContext): Promise<void> {
	const rest = (ctx.args.rest || []) as string[];
	const currentEnv = (ctx.args.currentEnv as string) || rest[0] || "OPENROUTER_ENCRYPT_KEY";
	const previousEnv = (ctx.args.previousEnv as string) || "OPENROUTER_ENCRYPT_KEY_PREVIOUS";
	const json = ctx.args.json as boolean;

	const result = rotateKey(currentEnv, previousEnv);

	if (json) {
		ctx.emit("result", result);
		return;
	}

	console.log(`## Encryption Key Rotation\n`);
	console.log(`### New Key (set as ${result.currentEnv})`);
	console.log("```");
	console.log(result.newKey);
	console.log("```\n");
	console.log("### Rotation Steps");
	console.log(result.instructions);
}
