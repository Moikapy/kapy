/** Test: RouteProvider + ExitProvider + useRenderer */
import { createCliRenderer } from "@opentui/core";
import { render, useRenderer } from "@opentui/solid";
import { createSignal, createContext, useContext, type ParentComponent, Show } from "solid-js";

type RouteData = { type: "home" } | { type: "session" };
const RouteContext = createContext<{ data: () => RouteData; navigate: (r: RouteData) => void }>();
const RouteProvider: ParentComponent = (props) => {
	const [data, setData] = createSignal<RouteData>({ type: "home" });
	return <RouteContext.Provider value={{ data, navigate: (r: RouteData) => setData(r) }}>{props.children}</RouteContext.Provider>;
};

const ExitContext = createContext<{ exit: (reason?: unknown) => Promise<void> }>();
function useExit() { const c = useContext(ExitContext); if (!c) throw new Error("no exit"); return c; }
const ExitProvider: ParentComponent<{
	onExit: () => Promise<void>;
}> = (props) => {
	const renderer = useRenderer();
	let exitTask: Promise<void> | undefined;
	const doExit = async (reason?: unknown) => {
		if (exitTask) return exitTask;
		exitTask = (async () => {
			try { renderer.destroy(); } catch {}
			if (reason) process.stderr.write(`\n${String(reason)}\n`);
			await props.onExit?.();
		})();
		return exitTask;
	};
	process.on("SIGHUP", () => doExit("SIGHUP"));
	process.on("SIGINT", () => doExit("Ctrl+C"));
	return <ExitContext.Provider value={{ exit: doExit }}>{props.children}</ExitContext.Provider>;
};

function App() {
	const route = useContext(RouteContext)!;
	return (
		<box flexDirection="column" padding={1} backgroundColor="#1a1b26">
			<Show when={route.data().type === "home"}>
				<text fg="#00AAFF" bold>KAPY</text>
				<text fg="#565f89">agent-first cli</text>
			</Show>
			<text fg="#565f89">Auto-exit in 3s...</text>
		</box>
	);
}

async function main() {
	await new Promise<void>(async (resolve) => {
		const renderer = await createCliRenderer({
			externalOutputMode: "passthrough",
			targetFps: 60,
			exitOnCtrlC: false,
			useKittyKeyboard: {},
			autoFocus: true,
			openConsoleOnError: false,
		});
		await render(() => (
			<ExitProvider onExit={async () => resolve()}>
				<RouteProvider>
					<App />
				</RouteProvider>
			</ExitProvider>
		), renderer);
		setTimeout(() => resolve(), 3000);
	});
}
main().catch(e => { console.error(e); process.exit(1); });