import { describe, expect, test } from "bun:test";
import { PermissionEvaluator } from "../../../../src/ai/permission/evaluator.js";
import type { PermissionRule } from "../../../../src/ai/permission/types.js";

describe("PermissionEvaluator", () => {
	test("default action is ask", () => {
		const evaluator = new PermissionEvaluator([]);
		expect(evaluator.evaluate("bash", "rm -rf /")).toBe("ask");
	});

	test("allow all with wildcard", () => {
		const evaluator = new PermissionEvaluator([{ permission: "*", pattern: "*", action: "allow" }]);
		expect(evaluator.evaluate("bash", "anything")).toBe("allow");
	});

	test("deny specific pattern", () => {
		const evaluator = new PermissionEvaluator([
			{ permission: "*", pattern: "*", action: "allow" },
			{ permission: "bash", pattern: "rm -rf", action: "deny" },
		]);
		expect(evaluator.evaluate("bash", "rm -rf /")).toBe("deny");
		expect(evaluator.evaluate("bash", "ls")).toBe("allow");
	});

	test("ask on specific tool", () => {
		const evaluator = new PermissionEvaluator([
			{ permission: "*", pattern: "*", action: "allow" },
			{ permission: "install", pattern: "*", action: "ask" },
		]);
		expect(evaluator.evaluate("install", "my-ext")).toBe("ask");
		expect(evaluator.evaluate("bash", "ls")).toBe("allow");
	});

	test("last matching rule wins (findLast)", () => {
		const rules: PermissionRule[] = [
			{ permission: "*", pattern: "*", action: "allow" },
			{ permission: "bash", pattern: "rm", action: "deny" },
			{ permission: "bash", pattern: "rm -i", action: "ask" },
		];
		const evaluator = new PermissionEvaluator(rules);
		expect(evaluator.evaluate("bash", "rm -i file")).toBe("ask");
		expect(evaluator.evaluate("bash", "rm file")).toBe("deny");
	});

	test("wildcard pattern matching", () => {
		const evaluator = new PermissionEvaluator([
			{ permission: "*", pattern: "*", action: "allow" },
			{ permission: "config", pattern: ".env*", action: "deny" },
		]);
		expect(evaluator.evaluate("config", ".env")).toBe("deny");
		expect(evaluator.evaluate("config", ".env.local")).toBe("deny");
		expect(evaluator.evaluate("config", ".env.example")).toBe("deny");
		expect(evaluator.evaluate("config", "package.json")).toBe("allow");
	});

	test("no-input mode converts ask to deny", () => {
		const evaluator = new PermissionEvaluator([], { noInput: true });
		expect(evaluator.evaluate("anything", "anything")).toBe("deny");
	});

	test("addRule appends to rules", () => {
		const evaluator = new PermissionEvaluator([{ permission: "*", pattern: "*", action: "allow" }]);
		expect(evaluator.evaluate("deploy", "production")).toBe("allow");
		evaluator.addRule({ permission: "deploy", pattern: "*", action: "ask" });
		expect(evaluator.evaluate("deploy", "production")).toBe("ask");
	});
});
