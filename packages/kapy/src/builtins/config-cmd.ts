/** kapy config — view/edit configuration */
import type { CommandContext } from "../command/context.js";

export const configCommand = async (ctx: CommandContext): Promise<void> => {
	const positionalArgs = (ctx.args as Record<string, unknown[]>).rest ?? [];
	const key = positionalArgs[0] as string | undefined;
	const value = positionalArgs[1] as string | undefined;

	if (key && value) {
		ctx.log(`Setting ${key} = ${value}`);
		// TODO: implement config set
	} else if (key) {
		ctx.log(`${key}: ${JSON.stringify(ctx.config[key]) ?? "(not set)"}`);
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
};