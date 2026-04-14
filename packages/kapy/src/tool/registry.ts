import type { KapyToolRegistration } from "./types.js";

const VALID_NAME = /^[a-z][a-z0-9_-]*$/;

/**
 * Tool registry — registration, lookup, and listing of tools.
 *
 * Tools are callable by the LLM agent. First registration wins (same as CommandRegistry).
 * Active tools can be filtered via setActiveTools().
 */
export class ToolRegistry {
	private tools = new Map<string, KapyToolRegistration>();
	private activeToolNames: Set<string> | null = null;

	/** Register a tool definition. First registration wins. Validates name and description. */
	register(definition: KapyToolRegistration): void {
		this.validate(definition);
		if (this.tools.has(definition.name)) return;
		this.tools.set(definition.name, definition);
	}

	/** Get a tool by name */
	get(name: string): KapyToolRegistration | undefined {
		return this.tools.get(name);
	}

	/** Check if a tool exists */
	has(name: string): boolean {
		return this.tools.has(name);
	}

	/** Get all registered tools */
	all(): KapyToolRegistration[] {
		return [...this.tools.values()];
	}

	/** Number of registered tools */
	get toolCount(): number {
		return this.tools.size;
	}

	/** Remove a tool by name */
	unregister(name: string): void {
		this.tools.delete(name);
		this.activeToolNames?.delete(name);
	}

	/** Get only active tools. If no filter set, returns all. */
	getActiveTools(): KapyToolRegistration[] {
		if (this.activeToolNames === null) return this.all();
		return this.all().filter((t) => this.activeToolNames?.has(t.name));
	}

	/** Set which tools are active. null = all active. Empty = none active. */
	setActiveTools(names: string[] | null): void {
		if (names === null) {
			this.activeToolNames = null;
		} else {
			// Only include names that actually exist
			this.activeToolNames = new Set(names.filter((n) => this.tools.has(n)));
		}
	}

	/** Validate tool definition on registration */
	private validate(def: KapyToolRegistration): void {
		if (!def.name || !VALID_NAME.test(def.name)) {
			throw new Error(`Invalid tool name "${def.name}": must match ^[a-z][a-z0-9_-]*$`);
		}
		if (!def.description) {
			throw new Error(`Tool "${def.name}" requires a non-empty description`);
		}
	}
}
