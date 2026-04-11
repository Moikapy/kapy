/** kapy update — update all or a specific extension */
import type { CommandContext } from "../command/context.js";

export const updateCommand = async (ctx: CommandContext): Promise<void> => {
	const positionalArgs = (ctx.args as Record<string, unknown[]>).rest ?? [];
	const name = positionalArgs[0] as string | undefined;
	if (name) {
		ctx.log(`Updating extension: ${name}`);
	} else {
		ctx.log("Updating all extensions...");
	}
	// TODO: implement extension update
	ctx.log("Extension updates coming soon.");
};