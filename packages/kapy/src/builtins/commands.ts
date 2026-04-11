/** kapy commands — list all registered commands */
import type { CommandHandler } from "../command/parser.js";
import type { CommandRegistry } from "../command/registry.js";

export function createCommandsCommand(registry: CommandRegistry): CommandHandler {
	return async (ctx) => {
		const commands = registry.all();

		if (ctx.json) {
			const output = commands.map((cmd) => ({
				name: cmd.name,
				description: cmd.options.description,
				args: cmd.options.args ?? [],
				flags: cmd.options.flags
					? Object.entries(cmd.options.flags).map(([key, def]) => ({
							name: key,
							...def,
						}))
					: [],
				hidden: cmd.options.hidden ?? false,
				agentHints: cmd.agentHints,
			}));
			console.log(JSON.stringify(output, null, 2));
			return;
		}

		ctx.log("Available commands:");
		for (const cmd of commands) {
			if (cmd.options.hidden) continue;
			ctx.log(`  ${cmd.name.padEnd(20)} ${cmd.options.description}`);
		}
	};
}
