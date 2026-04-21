import { createSignal } from "solid-js";

const MAX_HISTORY = 100;

const [history, setHistory] = createSignal<string[]>([]);
let historyIndex = -1;
let savedDraft = "";

export function usePromptHistory() {
	function push(text: string) {
		if (!text.trim()) return;
		setHistory((prev) => {
			const next = prev.filter((h) => h !== text);
			next.unshift(text);
			return next.slice(0, MAX_HISTORY);
		});
		historyIndex = -1;
		savedDraft = "";
	}

	function up(current: string): string | null {
		const h = history();
		if (h.length === 0) return null;
		if (historyIndex === -1) {
			savedDraft = current;
			historyIndex = 0;
		} else if (historyIndex < h.length - 1) {
			historyIndex++;
		}
		return h[historyIndex] ?? null;
	}

	function down(_current: string): string | null {
		const h = history();
		if (historyIndex === -1) return null;
		if (historyIndex === 0) {
			historyIndex = -1;
			return savedDraft;
		}
		historyIndex--;
		return h[historyIndex] ?? null;
	}

	return { push, up, down };
}
