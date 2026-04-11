/** kapy upgrade — upgrade kapy itself to the latest version */
import type { CommandContext } from "../command/context.js";

export const upgradeCommand = async (ctx: CommandContext): Promise<void> => {
	ctx.log("Checking for kapy updates...");
	// TODO: implement self-upgrade via npm/bun
	ctx.log("Self-upgrade coming soon.");
};