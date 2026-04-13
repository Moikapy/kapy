/** kapy help — show detailed help for a specific command */
import type { CommandHandler } from "../command/parser.js";
import type { CommandRegistry } from "../command/registry.js";

export function createHelpCommand(registry: CommandRegistry): CommandHandler {
	return async (ctx) => {
		const positionalArgs = (ctx.args as Record<string, unknown>).rest as string[] | undefined;
		const commandName = positionalArgs?.[0];

		if (!commandName) {
			// Show general help
			if (ctx.json) {
				console.log(
					JSON.stringify(
						{
							commands: registry.visible().map((cmd) => ({
								name: cmd.name,
								description: cmd.options.description,
								args: cmd.options.args ?? [],
								flags: cmd.options.flags ? Object.entries(cmd.options.flags).map(([k, v]) => ({ name: k, ...v })) : [],
								agentHints: cmd.agentHints,
							})),
						},
						null,
						2,
					),
				);
			} else {
				ctx.log("");
				ctx.log("  🐹 kapy — the agent-first CLI framework");
				ctx.log("");
				ctx.log("Usage: kapy <command> [flags]");
				ctx.log("");
				ctx.log("Available commands:");
				for (const cmd of registry.visible()) {
					ctx.log(`  ${cmd.name.padEnd(20)} ${cmd.options.description}`);
				}
				ctx.log("");
				ctx.log("Use 'kapy help <command>' for more information about a command.");
			}
			return;
		}

		// Show help for specific command
		const cmd = registry.get(commandName);
		if (!cmd) {
			ctx.error(`Unknown command: ${commandName}`);
			ctx.abort(2);
		}

		// After abort, TypeScript still thinks cmd could be undefined.
		// But abort() throws, so if we reach here, cmd is defined.
		const command = cmd!;

		const subs = registry.subcommands(commandName);

		if (ctx.json) {
			console.log(
				JSON.stringify(
					{
						name: command.name,
						description: command.options.description,
						args: command.options.args ?? [],
						flags: command.options.flags
							? Object.entries(command.options.flags).map(([k, v]) => ({ name: k, ...v }))
							: [],
						subcommands: subs.map((s) => s.name),
						hidden: command.options.hidden ?? false,
						agentHints: command.agentHints,
					},
					null,
					2,
				),
			);
		} else {
			ctx.log("");
			ctx.log(`  ${command.name} — ${command.options.description}`);
			ctx.log("");

			if (command.options.args?.length) {
				ctx.log("  Arguments:");
				for (const arg of command.options.args) {
					const req = arg.required ? "(required) " : "";
					const def = arg.default !== undefined ? ` [default: ${arg.default}]` : "";
					ctx.log(`    ${arg.name.padEnd(16)} ${req}${arg.description ?? ""}${def}`);
				}
				ctx.log("");
			}

			if (command.options.flags && Object.keys(command.options.flags).length > 0) {
				ctx.log("  Flags:");
				for (const [key, flag] of Object.entries(command.options.flags)) {
					const alias = flag.alias ? `-${flag.alias}, ` : "    ";
					const def = flag.default !== undefined ? ` [default: ${flag.default}]` : "";
					ctx.log(`    ${alias}--${key.padEnd(14)} ${flag.description ?? ""}${def}`);
				}
				ctx.log("");
			}

			if (subs.length > 0) {
				ctx.log("  Subcommands:");
				for (const sub of subs) {
					ctx.log(`    ${sub.name.padEnd(20)} ${sub.options.description}`);
				}
				ctx.log("");
			}

			if (command.agentHints) {
				ctx.log("  Agent hints:");
				if (command.agentHints.purpose) ctx.log(`    Purpose:      ${command.agentHints.purpose}`);
				if (command.agentHints.when) ctx.log(`    When:         ${command.agentHints.when}`);
				if (command.agentHints.output) ctx.log(`    Output:       ${command.agentHints.output}`);
				if (command.agentHints.sideEffects) ctx.log(`    Side effects: ${command.agentHints.sideEffects}`);
				if (command.agentHints.requires) ctx.log(`    Requires:     ${command.agentHints.requires.join(", ")}`);
				ctx.log("");
			}
		}
	};
}
