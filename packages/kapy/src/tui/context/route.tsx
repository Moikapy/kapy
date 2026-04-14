/**
 * Route context — navigates between Home and Session screens.
 * 1:1 with OpenCode's route context.
 */

import { createContext, useContext, type ParentComponent, createSignal } from "solid-js";

export type RouteData =
	| { type: "home"; initialPrompt?: { input: string; parts: unknown[] } }
	| { type: "session"; sessionID: string; initialPrompt?: { input: string; parts: unknown[] } };

interface RouteContextValue {
	data: () => RouteData;
	navigate: (data: RouteData) => void;
}

const RouteContext = createContext<RouteContextValue>();

export function useRoute(): RouteContextValue {
	const ctx = useContext(RouteContext);
	if (!ctx) throw new Error("useRoute must be used within RouteProvider");
	return ctx;
}

export const RouteProvider: ParentComponent = (props) => {
	const [data, setData] = createSignal<RouteData>({ type: "home" });

	const navigate = (next: RouteData) => {
		setData(next);
	};

	return (
		<RouteContext.Provider value={{ data, navigate }}>
			{props.children}
		</RouteContext.Provider>
	);
};