/**
 * Exit context — manages clean TUI shutdown.
 *
 * Provides `exit()` as a Solid context, so any component can call it.
 * The exit function:
 * 1. Calls onBeforeExit (cleanup hooks)
 * 2. Resets terminal title
 * 3. Destroys the renderer (restores terminal state)
 * 4. Calls onExit (resolves the launch promise)
 *
 * Signal handling:
 * - SIGHUP (tmux pane close) → exit()
 * - SIGINT (Ctrl+C from terminal) → exit()
 * - SIGTERM → exit()
 *
 * CRITICAL: Never calls process.exit(). Let the event loop drain naturally.
 * The renderer is in raw mode, so SIGINT comes from the terminal signal,
 * not through the focused renderable's key handler.
 */

import {
	createContext,
	useContext,
	type ParentComponent,
} from "solid-js";
import { useRenderer } from "@opentui/solid";

interface ExitContextValue {
	exit: (reason?: unknown) => Promise<void>;
}

const ExitContext = createContext<ExitContextValue>();

export function useExit(): ExitContextValue {
	const ctx = useContext(ExitContext);
	if (!ctx) throw new Error("useExit must be used within ExitProvider");
	return ctx;
}

export const ExitProvider: ParentComponent<{
	onExit: () => Promise<void>;
	onBeforeExit?: () => Promise<void>;
}> = (props) => {
	const renderer = useRenderer();
	let exitTask: Promise<void> | undefined;

	const doExit: ExitContextValue["exit"] = async (reason?: unknown) => {
		if (exitTask) return exitTask; // prevent double-destroy
		exitTask = (async () => {
			try { await props.onBeforeExit?.(); } catch { /* best effort */ }
			try { renderer.setTerminalTitle(""); } catch { /* ignore */ }
			try { renderer.destroy(); } catch { /* already destroyed */ }
			if (reason) {
				const msg = reason instanceof Error ? reason.message : String(reason);
				process.stderr.write(`\n${msg}\n`);
			}
			await props.onExit?.();
		})();
		return exitTask;
	};

	// Register signal handlers IMMEDIATELY (not in onMount).
	// These are needed because the terminal is in raw mode and
	// SIGINT/SIGHUP come from the OS, not through the focused renderable.
	// OpenCode also registers SIGHUP here. We add SIGINT and SIGTERM
	// because Ctrl+C sends SIGINT and terminal kill sends SIGTERM.
	process.on("SIGHUP", () => doExit("SIGHUP"));
	process.on("SIGINT", () => doExit("Ctrl+C"));
	process.on("SIGTERM", () => doExit("SIGTERM"));

	return (
		<ExitContext.Provider value={{ exit: doExit }}>
			{props.children}
		</ExitContext.Provider>
	);
};