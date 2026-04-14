/**
 * Dialog context — manages open/closed state for modal dialogs.
 * 1:1 with OpenCode's DialogProvider pattern.
 */

import {
	createContext,
	createSignal,
	useContext,
	type ParentComponent,
	type JSX,
} from "solid-js";

export type DialogType =
	| "model"
	| "help"
	| "command"
	| "agent"
	| "session-list"
	| "mcp"
	| "theme"
	| "status"
	| null;

interface DialogContextValue {
	open: () => DialogType;
	openDialog: (type: DialogType) => void;
	closeDialog: () => void;
}

const DialogContext = createContext<DialogContextValue>();

export function useDialog() {
	const ctx = useContext(DialogContext);
	if (!ctx) throw new Error("useDialog must be used within DialogProvider");
	return ctx;
}

export const DialogProvider: ParentComponent = (props) => {
	const [open, setOpen] = createSignal<DialogType>(null);

	return (
		<DialogContext.Provider
			value={{
				open,
				openDialog: setOpen,
				closeDialog: () => setOpen(null),
			}}
		>
			{props.children}
		</DialogContext.Provider>
	);
};