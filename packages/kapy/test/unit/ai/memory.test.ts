/**
 * Tests for MemoryStore — key-value persistence for project/global scopes.
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { MemoryStore } from "../../../src/ai/memory.js";

describe("MemoryStore", () => {
	let store: MemoryStore;
	let projectDir: string;
	let globalDir: string;

	beforeEach(() => {
		projectDir = mkdtempSync(join(tmpdir(), "kapy-mem-proj-"));
		globalDir = mkdtempSync(join(tmpdir(), "kapy-mem-global-"));
		store = new MemoryStore({ projectDir, globalDir });
	});

	afterEach(() => {
		try { rmSync(projectDir, { recursive: true }); } catch {}
		try { rmSync(globalDir, { recursive: true }); } catch {}
	});

	test("set and get in project scope", () => {
		store.set("key1", "value1");
		expect(store.get("key1")).toBe("value1");
	});

	test("get returns undefined for missing key", () => {
		expect(store.get("nonexistent")).toBeUndefined();
	});

	test("set and get in global scope", () => {
		store.set("global.key", "global value", "global");
		expect(store.get("global.key", "global")).toBe("global value");
	});

	test("project and global scopes are independent", () => {
		store.set("same-key", "project-value", "project");
		store.set("same-key", "global-value", "global");
		expect(store.get("same-key", "project")).toBe("project-value");
		expect(store.get("same-key", "global")).toBe("global-value");
	});

	test("delete removes entry", () => {
		store.set("to-delete", "value");
		expect(store.delete("to-delete")).toBe(true);
		expect(store.get("to-delete")).toBeUndefined();
	});

	test("delete returns false for missing key", () => {
		expect(store.delete("nonexistent")).toBe(false);
	});

	test("list returns all entries in scope", () => {
		store.set("a", "1");
		store.set("b", "2");
		store.set("c", "3", "global");
		const projectList = store.list("project");
		expect(projectList.length).toBe(2);
	});

	test("listAll returns entries from both scopes", () => {
		store.set("p1", "project");
		store.set("g1", "global", "global");
		const all = store.listAll();
		expect(all.length).toBe(2);
	});

	test("search finds by key substring", () => {
		store.set("deploy.staging", "http://staging.example.com");
		store.set("deploy.production", "http://prod.example.com");
		store.set("cache.ttl", "3600");
		const results = store.search("deploy");
		expect(results.length).toBe(2);
	});

	test("search finds by value substring", () => {
		store.set("server1", "http://staging.example.com");
		store.set("server2", "http://prod.example.com");
		store.set("name", "kapy");
		const results = store.search("example.com");
		expect(results.length).toBe(2);
	});

	test("search is case-insensitive", () => {
		store.set("key", "UPPERCASE VALUE");
		const results = store.search("uppercase");
		expect(results.length).toBe(1);
	});

	test("count returns scope counts", () => {
		store.set("p1", "1");
		store.set("p2", "2");
		store.set("g1", "3", "global");
		expect(store.count).toEqual({ project: 2, global: 1 });
	});

	test("overwrites existing key", () => {
		store.set("key", "old");
		store.set("key", "new");
		expect(store.get("key")).toBe("new");
	});

	test("save and load round-trip", () => {
		store.set("persist1", "value1");
		store.set("persist2", "value2", "global");

		store.save();

		const store2 = new MemoryStore({ projectDir, globalDir });
		store2.load();

		expect(store2.get("persist1")).toBe("value1");
		expect(store2.get("persist2", "global")).toBe("value2");
	});

	test("load handles missing files gracefully", () => {
		const freshStore = new MemoryStore({ projectDir, globalDir });
		freshStore.load();
		expect(freshStore.count).toEqual({ project: 0, global: 0 });
	});

	test("entry has updatedAt timestamp", () => {
		const before = Date.now();
		store.set("ts-key", "value");
		const entries = store.list();
		expect(entries[0].updatedAt).toBeGreaterThanOrEqual(before);
	});
});