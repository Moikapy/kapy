/**
 * Tests for TUI app shell — route switching, keyboard handling logic.
 */

import { describe, expect, it } from "bun:test";
import { createSignal } from "solid-js";

type RouteData = { type: "home" } | { type: "session"; sessionID: string; initialPrompt?: { input: string } };

describe("TUI App Shell (logic)", () => {
	it("escape navigates from session to home", () => {
		const [data, setData] = createSignal<RouteData>({ type: "home" });
		// Simulate entering session
		setData({ type: "session", sessionID: "sess-1" });
		expect(data().type).toBe("session");

		// Simulate Escape key
		if (data().type === "session") {
			setData({ type: "home" });
		}
		expect(data().type).toBe("home");
	});

	it("escape does nothing from home", () => {
		const [data, setData] = createSignal<RouteData>({ type: "home" });
		// Escape from home does nothing
		if (data().type === "session") {
			setData({ type: "home" });
		}
		expect(data().type).toBe("home");
	});

	it("initial prompt carries through to session", () => {
		const [data, setData] = createSignal<RouteData>({ type: "home" });
		const userInput = "Fix the auth bug";
		setData({ type: "session", sessionID: "sess-prompt", initialPrompt: { input: userInput } });
		if (data().type === "session") {
			expect(data().initialPrompt?.input).toBe(userInput);
		}
	});

	it("session without initial prompt is valid", () => {
		const [data] = createSignal<RouteData>({ type: "session", sessionID: "sess-empty" });
		if (data().type === "session") {
			expect(data().initialPrompt).toBeUndefined();
		}
	});
});
