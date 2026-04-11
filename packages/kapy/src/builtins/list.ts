/** kapy list — show installed extensions */
import type { CommandContext } from "../command/context.js";

export const listCommand = async (ctx: CommandContext): Promise<void> => {
	// TODO: read installed extensions from ~/.kapy/extensions.json
	ctx.log("Installed extensions:");
	ctx.log("  (none)");
};