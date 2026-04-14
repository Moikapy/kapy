/** Minimal test: render KAPY + prompt with context providers only. */
import { createCliRenderer } from "@opentui/core";
import { render } from "@opentui/solid";
import { createSignal, createContext, useContext, type ParentComponent, Show } from "solid-js";

type RouteData = { type: "home" } | { type: "session"; sessionID: string };
const RouteContext = createContext<{ data: () => RouteData; navigate: (r: RouteData) => void }>();
const RouteProvider: ParentComponent = (props) => {
	const [data, setData] = createSignal<RouteData>({ type: "home" });
	return <RouteContext.Provider value={{ data, navigate: (r: RouteData) => setData(r) }}>{props.children}</RouteContext.Provider>;
};

type TC = { accent: string; bg: string; panel: string; text: string; muted: string };
const DT: TC = { accent: "#00AAFF", bg: "#1a1b26", panel: "#1a1a2e", text: "#c0caf5", muted: "#565f89" };
const ThemeCtx = createContext<{ t: () => TC }>();
const ThemeP: ParentComponent = (props) => {
	const [m] = createSignal("dark");
	const t = () => DT;
	return <ThemeCtx.Provider value={{ t }}>{props.children}</ThemeCtx.Provider>;
};

function App() {
	const route = useContext(RouteContext)!;
	const { t } = useContext(ThemeCtx)!;
	return (
		<box flexDirection="column" padding={1} backgroundColor={t().bg}>
			<Show when={route.data().type === "home"}>
				<text fg={t().accent} bold>KAPY</text>
				<text fg={t().muted}>agent-first cli</text>
				<text fg={t().text}>Press any key</text>
			</Show>
			<text fg="#565f89">Auto-exit in 5s...</text>
		</box>
	);
}

async function main() {
	const renderer = await createCliRenderer({
		externalOutputMode: "passthrough",
		targetFps: 60,
		exitOnCtrlC: false,
		useKittyKeyboard: {},
		autoFocus: true,
		openConsoleOnError: false,
	});
	await render(() => <ThemeP><RouteProvider><App /></RouteProvider></ThemeP>, renderer);
	setTimeout(() => process.exit(0), 5000);
}
main().catch(e => { console.error(e); process.exit(1); });