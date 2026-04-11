/** kapy install — install an extension */
import type { CommandContext } from "../command/context.js";

export const installCommand = async (ctx: CommandContext): Promise<void> => {
	const positionalArgs = (ctx.args as Record<string, unknown[]>).rest ?? [];
	const source = positionalArgs[0] as string | undefined;
	const trust = ctx.args.trust as boolean;

	if (!source) {
		ctx.error("Usage: kapy install <npm:@scope/pkg | git:repo | ./path>");
		ctx.abort(2);
	}

	ctx.log(`Installing extension: ${source}${trust ? " (trusted)" : ""}`);

	if (!trust) {
		ctx.log("Trust prompt: This extension will register the following commands and hooks:");
		// TODO: show trust prompt with what the extension registers
		ctx.log("[trust prompt coming soon — use --trust to skip]");
	}

	// TODO: implement extension installation (npm install, git clone, local link)
	ctx.log("Extension installation coming soon.");
};