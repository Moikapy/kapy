/**
 * kapy-components — UI components for kapy TUI, built on @opentui/solid.
 *
 * Solid JSX components for building terminal interfaces with kapy's design system.
 * All components are composable Solid functions that return JSX.Element.
 */

export type { BannerProps } from "./components/Banner.js";
// Components
export { Banner, CAPYBARA_COMPACT, CAPYBARA_FULL } from "./components/Banner.js";
export type { CodeProps } from "./components/Code.js";
export { Code } from "./components/Code.js";
// Command palette
export type { CommandEntry, CommandPaletteProps } from "./components/CommandPalette.js";
export { CommandPalette, filterCommands } from "./components/CommandPalette.js";
export type { DiffProps } from "./components/Diff.js";
export { Diff } from "./components/Diff.js";
export type { InputProps } from "./components/Input.js";
export { Input } from "./components/Input.js";
export type { ScrollBoxProps } from "./components/ScrollBox.js";
export { ScrollBox } from "./components/ScrollBox.js";
export type { SelectOption, SelectProps } from "./components/Select.js";
export { Select } from "./components/Select.js";
export type { SpinnerProps } from "./components/Spinner.js";
export { Spinner } from "./components/Spinner.js";
export type { SidebarProps, SidebarScreen } from "./layout/Sidebar.js";
// Layout
export { Sidebar } from "./layout/Sidebar.js";
export type { StatusBarProps } from "./layout/StatusBar.js";
export { StatusBar } from "./layout/StatusBar.js";

// Theme
export { colors, spacing, typography } from "./theme.js";
