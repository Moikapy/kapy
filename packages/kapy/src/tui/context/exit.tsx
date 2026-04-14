/**
 * Exit context — OpenCode's exit pattern.
 *
 * Provides `exit()` as a Solid context, so any component can call it.
 * The exit function:
 * 1. Calls onBeforeExit (cleanup hooks)
 * 2. Resets terminal title
 * 3. Destroys the renderer (restores terminal state)
 * 4. Calls onExit (resolves the launch promise)
 *
 * CRITICAL: Never calls process.exit(). Let the event loop drain naturally.
 * Only registers SIGHUP (tmux pane close). Ctrl+C is handled via useKeyboard
 * in the prompt component, matching OpenCode's pattern.
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

	// SIGHUP: tmux pane close, terminal disconnect
	// Registered immediately (not in onMount) like OpenCode
	process.on("SIGHUP", () => doExit());

	return (
		<ExitContext.Provider value={{ exit: doExit }}>
			{props.children}
		</ExitContext.Provider>
	);
};