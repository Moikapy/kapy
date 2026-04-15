/**
 * CommandPalette — slash command autocomplete overlay.
 *
 * Appears when the user types "/" in the input, showing matching commands.
 * Arrow keys navigate, Enter/Tab selects, Escape dismisses.
 *
 * Re-exports the kapy-components CommandPalette with TUI-specific wiring.
 * The command definitions come from use-slash-commands.
 */

export type { CommandEntry, CommandPaletteProps } from "@moikapy/kapy-components";
export { CommandPalette, filterCommands } from "@moikapy/kapy-components";
