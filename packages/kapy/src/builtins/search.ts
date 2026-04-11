/** kapy search — search for extensions (post-MVP stub) */
import type { CommandContext } from "../command/context.js";

export const searchCommand = async (ctx: CommandContext): Promise<void> => {
	const positionalArgs = (ctx.args as Record<string, unknown>).rest as string[] | undefined;
	const query = positionalArgs?.[0];

	if (ctx.json) {
		console.log(
			JSON.stringify({
				status: "not_implemented",
				message: "kapy search is coming soon",
				...(query ? { query } : {}),
			}),
		);
		return;
	}

	if (query) {
		ctx.log(`🐹 kapy search is coming soon! (query: "${query}")`);
	} else {
		ctx.log("🐹 kapy search is coming soon!");
	}
};
