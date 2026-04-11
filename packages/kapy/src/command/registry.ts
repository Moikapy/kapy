/**
 * Command registry — registration, lookup, and listing of commands.
 *
 * Commands use the `:` separator convention for nesting.
 * Extensions adding `deploy:aws` automatically register as a subcommand of `deploy`.
 */
import type { CommandDefinition, CommandOptions, ArgDefinition, FlagDefinition, CommandHandler, AgentHints } from "./parser.js";

export class CommandRegistry {
	private commands = new Map<string, CommandDefinition>();

	/** Register a command definition */
	register(definition: CommandDefinition): void {
		const existing = this.commands.get(definition.name);
		if (existing) {
			console.warn(`[kapy] Command "${definition.name}" is already registered by "${existing.options.description}". Overriding.`);
		}
		this.commands.set(definition.name, definition);
	}

	/** Get a command by name */
	get(name: string): CommandDefinition | undefined {
		return this.commands.get(name);
	}

	/** Check if a command exists */
	has(name: string): boolean {
		return this.commands.has(name);
	}

	/** Get all registered commands */
	all(): CommandDefinition[] {
		return [...this.commands.values()];
	}

	/** Get subcommands of a parent command (e.g., all `deploy:*` for `deploy`) */
	subcommands(parent: string): CommandDefinition[] {
		const prefix = `${parent}:`;
		return this.all().filter((cmd) => cmd.name.startsWith(prefix));
	}

	/** List visible (non-hidden) commands */
	visible(): CommandDefinition[] {
		return this.all().filter((cmd) => !cmd.options.hidden);
	}

	/** Find the best matching command for a given argv */
	resolve(argv: string[]): { command: CommandDefinition; remaining: string[] } | null {
		// Try longest prefix match with `:` separator
		// e.g., ["deploy", "aws"] matches "deploy:aws" if registered, else "deploy"
		for (let i = argv.length; i > 0; i--) {
			const candidate = argv.slice(0, i).join(":");
			const cmd = this.commands.get(candidate);
			if (cmd) {
				return { command: cmd, remaining: argv.slice(i) };
			}
		}
		return null;
	}
}

/** Parse CLI args and flags from argv */
export function parseArgs(argv: string[], flagDefs?: Record<string, FlagDefinition>): {
	args: Record<string, unknown>;
	rest: string[];
} {
	const args: Record<string, unknown> = {};
	const rest: string[] = [];
	let argIndex = 0;

	for (let i = 0; i < argv.length; i++) {
		const token = argv[i];

		// --flag=value or --flag value or --no-flag
		if (token.startsWith("--")) {
			const eqIndex = token.indexOf("=");
			if (eqIndex !== -1) {
				// --flag=value
				const key = token.slice(2, eqIndex);
				const value = token.slice(eqIndex + 1);
				args[key] = value;
			} else if (token.startsWith("--no-")) {
				// --no-flag => flag: false
				args[token.slice(5)] = false;
			} else {
				// --flag value (or --flag for boolean)
				const key = token.slice(2);
				const flagDef = flagDefs?.[key];
				if (flagDef?.type === "boolean" || !flagDef) {
					// No flagDef means assume boolean if no next arg or next starts with -
					const nextToken = argv[i + 1];
					if (nextToken && !nextToken.startsWith("-") && flagDef?.type !== "boolean") {
						args[key] = nextToken;
						i++;
					} else {
						args[key] = true;
					}
				} else {
					const nextToken = argv[i + 1];
					args[key] = nextToken ?? flagDef.default;
					if (nextToken) i++;
				}
			}
		} else if (token.startsWith("-") && token.length === 2) {
			// -f value (short alias)
			const alias = token.slice(1);
			const flagDef = flagDefs
				? Object.entries(flagDefs).find(([, def]) => def.alias === alias)
				: undefined;
			if (flagDef) {
				const [key] = flagDef;
				if (flagDef[1].type === "boolean") {
					args[key] = true;
				} else {
					const nextToken = argv[i + 1];
					args[key] = nextToken ?? flagDef[1].default;
					if (nextToken) i++;
				}
			} else {
				rest.push(token);
			}
		} else {
			rest.push(token);
		}
	}

	return { args, rest };
}

export type { CommandDefinition, CommandOptions, ArgDefinition, FlagDefinition, CommandHandler, AgentHints };