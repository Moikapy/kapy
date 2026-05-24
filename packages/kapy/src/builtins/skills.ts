/** kapy skills — generate agent-readable skill manifest */
import type { AgentHints, CommandHandler } from "../command/parser.js";
import type { CommandRegistry } from "../command/registry.js";

export function createSkillsCommand(registry: CommandRegistry): CommandHandler {
	return async (ctx) => {
		const commands = registry.all();
		const format = (ctx.args.format as string) ?? "md";

		// Build skill entries from registered commands with agentHints
		const skills = commands
			.filter((cmd) => !cmd.options.hidden)
			.filter((cmd) => cmd.agentHints !== undefined)
			.map((cmd) => ({
				name: cmd.name,
				description: cmd.options.description,
				hints: cmd.agentHints as AgentHints,
				args: cmd.options.args ?? [],
				flags: cmd.options.flags
					? Object.entries(cmd.options.flags).map(([key, def]) => ({
							name: key,
							...def,
						}))
					: [],
			}));

		// MCP manifest format (--format=mcp)
		if (format === "mcp") {
			const mcpManifest = {
				skills: skills.map((s) => ({
					name: s.name,
					description: s.hints.purpose ?? s.description,
					when: s.hints.when,
					output: s.hints.output,
					sideEffects: s.hints.sideEffects,
					requires: s.hints.requires,
					args: s.args,
					flags: s.flags,
				})),
			};

			ctx.setResult(mcpManifest);
			if (ctx.json) {
				ctx.markJsonEmitted();
				console.log(JSON.stringify(mcpManifest, null, 2));
			} else if (ctx.compact) {
				ctx.compactLine(JSON.stringify(mcpManifest));
			} else {
				console.log(JSON.stringify(mcpManifest, null, 2));
			}
			return;
		}

		// JSON format (--json)
		if (ctx.json) {
			ctx.setResult(skills);
			ctx.markJsonEmitted();
			console.log(JSON.stringify(skills, null, 2));
			return;
		}

		// Default: SKILL.md markdown format
		let md = "# Kapy Skills\n\n";
		md += "Agent-readable command manifest for this kapy CLI.\n\n";
		md += "| Command | Purpose | When | Output | Side Effects |\n";
		md += "|---------|---------|------|--------|-------------|\n";

		for (const s of skills) {
			const purpose = s.hints.purpose ?? "-";
			const when = s.hints.when ?? "-";
			const output = s.hints.output ?? "-";
			const sideEffects = s.hints.sideEffects ?? "-";
			md += `| \`${s.name}\` | ${purpose} | ${when} | ${output} | ${sideEffects} |\n`;
		}

		if (skills.length === 0) {
			md += "\n_No skills with agentHints found. Add `agentHints` to command definitions to enable skill discovery._\n";
		}

		md += "\n## Command Details\n\n";
		for (const s of skills) {
			md += `### ${s.name}\n\n`;
			md += `${s.description}\n\n`;
			if (s.hints.purpose) md += `- **Purpose**: ${s.hints.purpose}\n`;
			if (s.hints.when) md += `- **When**: ${s.hints.when}\n`;
			if (s.hints.output) md += `- **Output**: ${s.hints.output}\n`;
			if (s.hints.sideEffects) md += `- **Side effects**: ${s.hints.sideEffects}\n`;
			if (s.hints.requires && s.hints.requires.length > 0) {
				md += `- **Requires**: ${s.hints.requires.join(", ")}\n`;
			}
			if (s.args.length > 0) {
				md += "\n**Arguments:**\n";
				for (const arg of s.args) {
					const req = arg.required ? " (required)" : "";
					md += `- \`${arg.name}\`${req}: ${arg.description ?? ""}\n`;
				}
			}
			if (s.flags.length > 0) {
				md += "\n**Flags:**\n";
				for (const flag of s.flags) {
					md += `- --${flag.name}: ${flag.description ?? ""}\n`;
				}
			}
			md += "\n";
		}

		if (ctx.compact) {
			// Compact mode: structured data, skip markdown
			ctx.setResult(skills.map((s) => ({ name: s.name, purpose: s.hints.purpose ?? s.description })));
			for (const s of skills) {
				ctx.compactLine(`${s.name}\t${s.hints.purpose ?? s.description}`);
			}
			return;
		}

		console.log(md);
	};
}
