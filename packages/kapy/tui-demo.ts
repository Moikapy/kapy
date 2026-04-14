#!/usr/bin/env bun
/**
 * Agent TUI demo — launches the kapy agent chat TUI.
 * This is the same as running `kapy` with no args.
 * Press Ctrl+C to exit.
 */

import { launchChatTUI } from "./src/tui/app.js";

console.log("Launching kapy agent TUI...");
console.log("Press Ctrl+C to exit.\n");

await launchChatTUI();