/**
 * kapy-components — UI components for kapy TUI, built on @opentui/core.
 */

// Components
export { Box } from "./components/Box.js";
export type { BoxProps } from "./components/Box.js";

export { Text } from "./components/Text.js";
export type { TextProps } from "./components/Text.js";

export { Input } from "./components/Input.js";
export type { InputProps } from "./components/Input.js";

export { Select } from "./components/Select.js";
export type { SelectProps, SelectOption } from "./components/Select.js";

export { ScrollBox } from "./components/ScrollBox.js";
export type { ScrollBoxProps } from "./components/ScrollBox.js";

export { Code } from "./components/Code.js";
export type { CodeProps } from "./components/Code.js";

export { Diff } from "./components/Diff.js";
export type { DiffProps } from "./components/Diff.js";

export { Spinner } from "./components/Spinner.js";
export type { SpinnerProps } from "./components/Spinner.js";

// Hooks
export { useInput } from "./hooks/useInput.js";
export type { UseInputOptions, InputHandler } from "./hooks/useInput.js";

export { useFocus } from "./hooks/useFocus.js";
export type { UseFocusOptions, UseFocusReturn, Focusable } from "./hooks/useFocus.js";

// Layout
export { Sidebar } from "./layout/Sidebar.js";
export type { SidebarProps } from "./layout/Sidebar.js";

export { StatusBar } from "./layout/StatusBar.js";
export type { StatusBarProps } from "./layout/StatusBar.js";