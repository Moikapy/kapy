/** kapy inspect — dump full state (extensions, config, hooks, middleware, config schemas) */

import type { CommandHandler } from "../command/parser.js";
import type { CommandRegistry } from "../command/registry.js";
import type { ConfigSchema } from "../config/schema.js";
import { describeSchema } from "../config/validator.js";
import type { HookHandler } from "../hooks/types.js";
import type { Middleware } from "../middleware/pipeline.js";

export function createInspectCommand(
	registry: CommandRegistry,
	middlewares: Middleware[],
	hooks: Map<string, HookHandler[]>,
	configSchemas: Map<string, ConfigSchema>,
): CommandHandler {
	return async (ctx) => {
		const state = {
			commands: registry.all().map((cmd) => ({
				name: cmd.name,
				description: cmd.options.description,
			})),
			middlewareCount: middlewares.length,
			hooks: Object.fromEntries([...hooks.entries()].map(([event, handlers]) => [event, handlers.length])),
			config: ctx.config,
			configSchemas: Object.fromEntries(
				[...configSchemas.entries()].map(([extName, schema]) => [extName, describeSchema(schema)]),
			),
		};

		if (ctx.json) {
			console.log(JSON.stringify(state, null, 2));
		} else {
			ctx.log("kapy inspect:");
			ctx.log(`  Commands: ${state.commands.length}`);
			for (const cmd of state.commands) {
				ctx.log(`    ${cmd.name} — ${cmd.description}`);
			}
			ctx.log(`  Middleware: ${state.middlewareCount} registered`);
			ctx.log("  Hooks:");
			for (const [event, count] of Object.entries(state.hooks)) {
				ctx.log(`    ${event}: ${count} handler(s)`);
			}
			if (configSchemas.size > 0) {
				ctx.log("  Config schemas:");
				for (const [extName, schema] of configSchemas) {
					ctx.log(`    ${extName}:`);
					for (const [key, field] of Object.entries(schema)) {
						const required = field.required ? " (required)" : "";
						const enumInfo = field.enum ? ` [${field.enum.join("|")}]` : "";
						ctx.log(`      ${key}: ${field.type}${enumInfo}${required}`);
					}
				}
			}
		}
	};
}
