/**
 * Command registry — registration, lookup, and listing of commands.
 *
 * Commands use the `:` separator convention for nesting.
 * Extensions adding `deploy:aws` automatically register as a subcommand of `deploy`.
 */
import type {
	AgentHints,
	ArgDefinition,
	CommandDefinition,
	CommandHandler,
	CommandOptions,
	FlagDefinition,
} from "./parser.js";
import { validateCommandName } from "./parser.js";

export class CommandRegistry {
	private commands = new Map<string, CommandDefinition>();

	/** Register a command definition. User commands take priority over builtins. */
	register(definition: CommandDefinition): void {
		const nameError = validateCommandName(definition.name);
		if (nameError) {
			console.warn(`[kapy] ${nameError}. Skipping.`);
			return;
		}
		const existing = this.commands.get(definition.name);
		if (existing) {
			return; // Already registered — first registration wins (user commands override builtins)
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

/** Parse CLI args and flags from argv.
 *
 * Positional arguments are mapped to declared `ArgDefinition` names in order.
 * Any remaining positional args beyond the declared ones go into `rest`.
 * Required arg validation is performed — missing required args produce errors in `args._errors`.
 */
export function parseArgs(
	argv: string[],
	flagDefs?: Record<string, FlagDefinition>,
	argDefs?: ArgDefinition[],
): {
	args: Record<string, unknown>;
	rest: string[];
} {
	const args: Record<string, unknown> = {};
	const positional: string[] = [];
	const errors: string[] = [];

	for (let i = 0; i < argv.length; i++) {
		const token = argv[i];

		// --flag=value or --flag value or --no-flag
		if (token.startsWith("--")) {
			const eqIndex = token.indexOf("=");
			if (eqIndex !== -1) {
				// --flag=value
				const key = token.slice(2, eqIndex);
				const value = token.slice(eqIndex + 1);
				args[key] = coerceFlagValue(key, value, flagDefs);
			} else if (token.startsWith("--no-")) {
				// --no-flag => flag: false
				args[token.slice(5)] = false;
			} else {
				// --flag value (or --flag for boolean)
				const key = token.slice(2);
				const flagDef = flagDefs?.[key];
				if (flagDef?.type === "boolean") {
					// Explicitly boolean flag
					args[key] = true;
				} else if (flagDef) {
					// Known flag with a type — consume next arg as value
					const nextToken = argv[i + 1];
					if (nextToken !== undefined && !nextToken.startsWith("-")) {
						args[key] = coerceFlagValue(key, nextToken, flagDefs);
						i++;
					} else {
						args[key] = flagDef.default;
					}
				} else {
					// Unknown flag — treat as boolean
					args[key] = true;
				}
			}
		} else if (token.startsWith("-") && token.length === 2) {
			// -f value (short alias)
			const alias = token.slice(1);
			const flagDef = flagDefs ? Object.entries(flagDefs).find(([, def]) => def.alias === alias) : undefined;
			if (flagDef) {
				const [key] = flagDef;
				if (flagDef[1].type === "boolean") {
					args[key] = true;
				} else {
					const nextToken = argv[i + 1];
					if (nextToken !== undefined && !nextToken.startsWith("-")) {
						args[key] = coerceFlagValue(key, nextToken, flagDefs);
						i++;
					} else {
						args[key] = flagDef[1].default;
					}
				}
			} else {
				positional.push(token);
			}
		} else {
			positional.push(token);
		}
	}

	// Map positional args to declared ArgDefinitions
	if (argDefs && argDefs.length > 0) {
		let argIndex = 0;
		for (const argDef of argDefs) {
			if (argDef.variadic) {
				// Variadic arg consumes all remaining positional args
				args[argDef.name] = positional.slice(argIndex);
				argIndex = positional.length;
			} else if (argIndex < positional.length) {
				args[argDef.name] = positional[argIndex];
				argIndex++;
			} else if (argDef.default !== undefined) {
				args[argDef.name] = argDef.default;
			} else if (argDef.required) {
				errors.push(`Missing required argument: ${argDef.name}`);
			}
		}
		// Remaining positional args go into rest
		args.rest = positional.slice(argIndex);
	} else {
		args.rest = positional;
	}

	// Validate required args
	if (argDefs) {
		for (const argDef of argDefs) {
			if (argDef.required && (args[argDef.name] === undefined || args[argDef.name] === null)) {
				if (!errors.includes(`Missing required argument: ${argDef.name}`)) {
					errors.push(`Missing required argument: ${argDef.name}`);
				}
			}
		}
	}

	// Store validation errors for framework-level handling
	if (errors.length > 0) {
		args._errors = errors;
	}

	return { args, rest: (args.rest as string[]) ?? [] };
}

/** Coerce a string flag value to the declared type */
function coerceFlagValue(key: string, value: string, flagDefs?: Record<string, FlagDefinition>): unknown {
	const flagDef = flagDefs?.[key];
	if (!flagDef) return value;

	switch (flagDef.type) {
		case "number": {
			const num = Number(value);
			return Number.isNaN(num) ? value : num;
		}
		case "boolean":
			return value === "true" || value === "1" || value === "yes";
		default:
			return value;
	}
}

export type { AgentHints, ArgDefinition, CommandDefinition, CommandHandler, CommandOptions, FlagDefinition };
