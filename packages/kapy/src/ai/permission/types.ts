/**
 * Permission types — rules, actions, evaluation context.
 */

/** Permission actions */
export type PermissionAction = "allow" | "ask" | "deny";

/** A single permission rule */
export interface PermissionRule {
	/** Tool name or "*" for all tools */
	permission: string;
	/** Pattern to match against tool input (supports wildcards) */
	pattern: string;
	/** What to do when matched */
	action: PermissionAction;
}

/** Permission check result */
export interface PermissionCheck {
	action: PermissionAction;
	reason?: string;
	matchedRule?: PermissionRule;
}
