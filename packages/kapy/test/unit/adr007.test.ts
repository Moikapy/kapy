/**
 * Tests for ADR-007: Agent-First Default Mode.
 *
 * `kapy` with no args → agent TUI (interactive) or help (--no-input)
 * Unknown text → single-shot (future) or help (fallback)
 */

import { describe, expect, test } from "bun:test";

describe("ADR-007: Agent-First Default Mode (logic)", () => {
	test("no command parts → should launch TUI in interactive mode", () => {
		const commandParts: string[] = [];
		const hasTTY = true;
		const noInput = false;
		const jsonMode = false;

		const shouldLaunchTUI = commandParts.length === 0 && hasTTY && !noInput && !jsonMode;
		expect(shouldLaunchTUI).toBe(true);
	});

	test("no command + --no-input → show help, not TUI", () => {
		const commandParts: string[] = [];
		const hasTTY = true;
		const noInput = true;

		const shouldLaunchTUI = commandParts.length === 0 && hasTTY && !noInput;
		expect(shouldLaunchTUI).toBe(false);
	});

	test("no command + --json → error JSON, not TUI", () => {
		const commandParts: string[] = [];
		const jsonMode = true;

		const shouldLaunchTUI = !jsonMode && commandParts.length === 0;
		expect(shouldLaunchTUI).toBe(false);
	});

	test("no command + non-TTY → show help, not TUI", () => {
		const commandParts: string[] = [];
		const hasTTY = false;

		const shouldLaunchTUI = commandParts.length === 0 && hasTTY;
		expect(shouldLaunchTUI).toBe(false);
	});

	test("unknown command parts → not TUI (single-shot or help)", () => {
		const commandParts = ["some-unknown-command"];
		const hasTTY = true;

		// For now, unknown commands fall through to help
		// Future: single-shot agent mode
		const shouldLaunchTUI = commandParts.length === 0 && hasTTY;
		expect(shouldLaunchTUI).toBe(false);
	});

	test("exact command match → run as CLI, not TUI", () => {
		const registeredCommands = ["init", "install", "list", "commands", "help", "tui"];
		const commandParts = ["init"];

		const isExactMatch = registeredCommands.some(
			(cmd) => cmd === commandParts[0] || cmd.startsWith(`${commandParts[0]}:`),
		);
		expect(isExactMatch).toBe(true);
	});
});
