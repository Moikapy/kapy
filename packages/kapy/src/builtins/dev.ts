/** kapy dev — run CLI in dev mode with hot reload */
import type { CommandContext } from "../command/context.js";

export const devCommand = async (ctx: CommandContext): Promise<void> => {
	const debug = ctx.args.debug as boolean;
	ctx.log(`Starting dev mode${debug ? " (debug)" : ""}...`);
	// TODO: implement file watching with process restart
	ctx.log("Dev mode coming soon.");
};