import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createSignal } from "solid-js";

const CONFIG_PATH = join(homedir(), ".kapy", "tui.json");

interface TuiSettings {
	showDetails: boolean;
	showThinking: boolean;
	conceal: boolean;
	showTimestamps: boolean;
	theme: string;
}

function loadSettings(): TuiSettings {
	try {
		if (!existsSync(CONFIG_PATH)) return defaults();
		const raw = readFileSync(CONFIG_PATH, "utf-8");
		return { ...defaults(), ...JSON.parse(raw) };
	} catch {
		return defaults();
	}
}

function defaults(): TuiSettings {
	return {
		showDetails: true,
		showThinking: true,
		conceal: true,
		showTimestamps: false,
		theme: "tokyo-night",
	};
}

function saveSettings(settings: TuiSettings) {
	try {
		writeFileSync(CONFIG_PATH, `${JSON.stringify(settings, null, 2)}\n`);
	} catch {}
}

const saved = loadSettings();

const [showDetails, setShowDetails] = createSignal(saved.showDetails);
const [showThinking, setShowThinking] = createSignal(saved.showThinking);
const [conceal, setConceal] = createSignal(saved.conceal);
const [showTimestamps, setShowTimestamps] = createSignal(saved.showTimestamps);
const [theme, setThemeSignal] = createSignal(saved.theme);

function persist() {
	saveSettings({
		showDetails: showDetails(),
		showThinking: showThinking(),
		conceal: conceal(),
		showTimestamps: showTimestamps(),
		theme: theme(),
	});
}

export function useTuiSettings() {
	return {
		showDetails,
		showThinking,
		conceal,
		showTimestamps,
		theme,
		toggleDetails() {
			setShowDetails((v) => !v);
			persist();
		},
		toggleThinking() {
			setShowThinking((v) => !v);
			persist();
		},
		toggleConceal() {
			setConceal((v) => !v);
			persist();
		},
		toggleTimestamps() {
			setShowTimestamps((v) => !v);
			persist();
		},
		setTheme(name: string) {
			setThemeSignal(name);
			persist();
		},
	};
}
