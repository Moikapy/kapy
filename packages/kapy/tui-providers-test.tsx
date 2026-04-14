import { createCliRenderer } from "@opentui/core";
import { render } from "@opentui/solid";
import { createSignal, createContext, useContext, type ParentComponent, Show } from "solid-js";

type RouteData = { type: "home" } | { type: "session" };
const RouteContext = createContext<{ data: () => RouteData; navigate: (r: RouteData) => void }>();
const RouteProvider: ParentComponent = (props) => {
	const [data, setData] = createSignal<RouteData>({ type: "home" });
	return <RouteContext.Provider value={{ data, navigate: (r: RouteData) => setData(r) }}>{props.children}</RouteContext.Provider>;
};

type Theme = { accent: string; textMuted: string; text: string };
const ThemeContext = createContext<{ theme: () => Theme }>();
const ThemeProvider: ParentComponent = (props) => {
	const [mode, setMode] = createSignal<"dark" | "light">("dark");
	const t = () => mode() === "dark"
		? { accent: "#00AAFF", textMuted: "#565f89", text: "#c0caf5" }
		: { accent: "#0070C0", textMuted: "#a8aecb", text: "#3760bf" };
	return <ThemeContext.Provider value={{ theme: t }}>{props.children}</ThemeContext.Provider>;
};

function TestApp() {
	const route = useContext(RouteContext)!;
	const th = useContext(ThemeContext)!;
	return (
		<box flexDirection="column" padding={1} backgroundColor="#1a1b26">
			<Show when={route.data().type === "home"}>
				<text fg={th.theme().accent} bold>KAPY</text>
				<text fg={th.theme().textMuted}>agent-first cli</text>
				<text>Route: home</text>
			</Show>
			<text fg="#565f89">Auto-exit in 3s...</text>
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
	await render(() => <ThemeProvider><RouteProvider><TestApp /></RouteProvider></ThemeProvider>, renderer);
	setTimeout(() => process.exit(0), 3000);
}
main().catch(e => { console.error(e); process.exit(1); });