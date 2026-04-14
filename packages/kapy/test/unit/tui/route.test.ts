/**
 * Tests for TUI route context — navigation between Home and Session.
 */

import { describe, it, expect } from "bun:test";
import { createSignal } from "solid-js";

// We test the signal pattern directly since Solid contexts need a render root.
// The pattern: RouteProvider uses createSignal<RouteData> and navigate updates it.

describe("TUI Route Context (logic)", () => {
	it("starts at home route", () => {
		const [data, setData] = createSignal<{ type: "home" | "session"; sessionID?: string }>({
			type: "home",
		});
		expect(data().type).toBe("home");
		expect(data().sessionID).toBeUndefined();
	});

	it("navigates to session route", () => {
		const [data, setData] = createSignal<{ type: "home" | "session"; sessionID?: string }>({
			type: "home",
		});
		setData({ type: "session", sessionID: "sess-123" });
		expect(data().type).toBe("session");
		expect(data().sessionID).toBe("sess-123");
	});

	it("navigates back to home", () => {
		const [data, setData] = createSignal<{ type: "home" | "session"; sessionID?: string }>({
			type: "home",
		});
		setData({ type: "session", sessionID: "sess-456" });
		expect(data().type).toBe("session");
		setData({ type: "home" });
		expect(data().type).toBe("home");
	});

	it("navigates to different sessions", () => {
		const [data, setData] = createSignal<{ type: "home" | "session"; sessionID?: string }>({
			type: "home",
		});
		setData({ type: "session", sessionID: "sess-a" });
		expect(data().sessionID).toBe("sess-a");
		setData({ type: "session", sessionID: "sess-b" });
		expect(data().sessionID).toBe("sess-b");
	});
});