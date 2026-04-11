/** kapy init — scaffold a new kapy-powered CLI project */
import type { CommandContext } from "../command/context.js";

export const initCommand = async (ctx: CommandContext): Promise<void> => {
	const positionalArgs = (ctx.args as Record<string, unknown[]>).rest ?? [];
	const projectName = positionalArgs[0] as string | undefined;
	const template = ctx.args.template as boolean;

	if (!projectName) {
		ctx.error("Usage: kapy init <name> [--template]");
		ctx.abort(2);
	}

	ctx.log(`Scaffolding project: ${projectName}${template ? " (with template)" : ""}`);
	// TODO: delegate to create-kapy scaffolding
	ctx.log("Project scaffolding coming soon.");
};