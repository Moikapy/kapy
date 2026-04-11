/** kapy remove — uninstall an extension */
import type { CommandContext } from "../command/context.js";

export const removeCommand = async (ctx: CommandContext): Promise<void> => {
	const positionalArgs = (ctx.args as Record<string, unknown[]>).rest ?? [];
	const name = positionalArgs[0] as string | undefined;
	if (!name) {
		ctx.error("Usage: kapy remove <extension-name>");
		ctx.abort(2);
	}
	ctx.log(`Removing extension: ${name}`);
	// TODO: implement extension removal
	ctx.log("Extension removal coming soon.");
};