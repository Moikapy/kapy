import { beforeEach, describe, expect, test } from "bun:test";
import { SessionManager } from "../../../../src/ai/session/manager.js";

describe("SessionManager", () => {
	let manager: SessionManager;

	beforeEach(() => {
		manager = SessionManager.inMemory();
	});

	test("starts with empty entries", () => {
		expect(manager.getEntries()).toHaveLength(0);
	});

	test("appendMessage creates entry with parentId", () => {
		const id = manager.appendMessage({ role: "user", content: "Hello" });
		expect(id).toBeDefined();
		expect(manager.getEntries()).toHaveLength(1);
		expect(manager.getEntries()[0].parentId).toBeNull();
	});

	test("entries link via parentId", () => {
		const id1 = manager.appendMessage({ role: "user", content: "Hello" });
		const _id2 = manager.appendMessage({ role: "assistant", content: "Hi there" });
		expect(manager.getEntries()[1].parentId).toBe(id1);
	});

	test("getEntry finds by id", () => {
		const id = manager.appendMessage({ role: "user", content: "Hello" });
		const entry = manager.getEntry(id);
		expect(entry).toBeDefined();
		expect(entry?.role).toBe("user");
	});

	test("getEntry returns undefined for unknown id", () => {
		expect(manager.getEntry("nonexistent")).toBeUndefined();
	});

	test("getLeafId returns last entry id", () => {
		const _id1 = manager.appendMessage({ role: "user", content: "Hi" });
		const id2 = manager.appendMessage({ role: "assistant", content: "Hello" });
		expect(manager.getLeafId()).toBe(id2);
	});

	test("getBranch returns entries from root to leaf", () => {
		manager.appendMessage({ role: "user", content: "First" });
		manager.appendMessage({ role: "assistant", content: "Response" });
		manager.appendMessage({ role: "user", content: "Second" });
		const branch = manager.getBranch();
		expect(branch).toHaveLength(3);
		expect(branch[0].content).toBe("First");
		expect(branch[2].content).toBe("Second");
	});

	test("branch creates a branch at entry", () => {
		const _id1 = manager.appendMessage({ role: "user", content: "A" });
		const id2 = manager.appendMessage({ role: "assistant", content: "B" });
		manager.appendMessage({ role: "user", content: "C" });

		// Branch from id2 (assistant message)
		manager.branch(id2);
		manager.appendMessage({ role: "user", content: "D" });

		// Branch should now follow the fork
		const branch = manager.getBranch();
		expect(branch.length).toBeGreaterThanOrEqual(3);
		// Last message should be the new branch entry
		expect(branch[branch.length - 1].content).toBe("D");
	});

	test("newSession resets entries", () => {
		manager.appendMessage({ role: "user", content: "Hello" });
		manager.appendMessage({ role: "assistant", content: "Hi" });
		manager.newSession();
		expect(manager.getEntries()).toHaveLength(0);
	});

	test("getSessionFile returns session file for persisted session", () => {
		// InMemory sessions don't have files — test with null
		expect(manager.getSessionFile()).toBeUndefined();
	});

	test("countByRole returns counts per role", () => {
		manager.appendMessage({ role: "user", content: "Hi" });
		manager.appendMessage({ role: "assistant", content: "Hello" });
		manager.appendMessage({ role: "user", content: "How are you?" });
		const counts = manager.countByRole();
		expect(counts.user).toBe(2);
		expect(counts.assistant).toBe(1);
	});

	test("getChildren returns child entries", () => {
		const id1 = manager.appendMessage({ role: "user", content: "Hello" });
		const _id2 = manager.appendMessage({ role: "assistant", content: "Hi" });
		const children = manager.getChildren(id1);
		expect(children).toHaveLength(1);
		expect(children[0].role).toBe("assistant");
	});

	test("entryCount reflects total entries", () => {
		expect(manager.entryCount).toBe(0);
		manager.appendMessage({ role: "user", content: "Hi" });
		manager.appendMessage({ role: "assistant", content: "Hello" });
		expect(manager.entryCount).toBe(2);
	});
});