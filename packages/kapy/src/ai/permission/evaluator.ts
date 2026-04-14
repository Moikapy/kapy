import type { PermissionAction, PermissionRule } from "./types.js";

/**
 * Simple wildcard matcher.
 * Supports "*" (matches anything), prefix wildcards like ".env*",
 * and substring matching (pattern appears in value).
 */
function wildcardMatch(value: string, pattern: string): boolean {
	if (pattern === "*") return true;
	// If pattern has wildcards, use regex matching
	if (pattern.includes("*")) {
		const regexStr = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
		return new RegExp(`^${regexStr}$`, "i").test(value);
	}
	// For literal patterns (no wildcards), use substring/contains matching
	// This matches OpenCode's behavior: "rm -rf" matches "rm -rf /"
	return value.toLowerCase().includes(pattern.toLowerCase());
}

/**
 * Permission evaluator — OpenCode's findLast pattern.
 *
 * Rules are evaluated in order. The LAST matching rule wins.
 * If no rule matches, the default action is "ask".
 */
export class PermissionEvaluator {
	private rules: PermissionRule[];
	private noInput: boolean;

	constructor(rules: PermissionRule[], options?: { noInput?: boolean }) {
		this.rules = rules;
		this.noInput = options?.noInput ?? false;
	}

	/** Evaluate permission for a tool + pattern */
	evaluate(permission: string, pattern: string): PermissionAction {
		// Last matching rule wins (findLast)
		let matched: PermissionRule | undefined;
		for (const rule of this.rules) {
			if (wildcardMatch(permission, rule.permission) && wildcardMatch(pattern, rule.pattern)) {
				matched = rule;
			}
		}

		const action: PermissionAction = matched?.action ?? "ask";

		// In --no-input mode, ask becomes deny
		if (this.noInput && action === "ask") {
			return "deny";
		}

		return action;
	}

	/** Add a rule (appends to end, will be matched after existing rules) */
	addRule(rule: PermissionRule): void {
		this.rules.push(rule);
	}

	/** Get all rules */
	getRules(): PermissionRule[] {
		return [...this.rules];
	}
}
