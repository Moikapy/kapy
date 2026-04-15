import { createContext, createSignal, type ParentComponent } from "solid-js";

export type RouteData = { type: "home" } | { type: "session"; sid: string };

export const RouteContext = createContext<{ data: () => RouteData; navigate: (r: RouteData) => void }>();

export const RouteProvider: ParentComponent = (props) => {
	const [data, setData] = createSignal<RouteData>({ type: "home" });
	return <RouteContext.Provider value={{ data, navigate: (r) => setData(r) }}>{props.children}</RouteContext.Provider>;
};