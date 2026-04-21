import { currentThemeName, listAvailableThemes, setTheme, useThemeColors } from "@moikapy/kapy-components";
import { useKeyboard } from "@opentui/solid";
import type { JSX } from "solid-js";
import { createSignal, For, onMount, Show } from "solid-js";
import { ChatSession } from "../../ai/chat-session.js";
import type { SessionInfo } from "../../ai/session/types.js";
import { useTuiSettings } from "../hooks/use-tui-settings.js";

export type ModalView =
	| { type: "help" }
	| { type: "models"; models: string[]; current: string }
	| { type: "tools"; tools: string[] }
	| { type: "keys" }
	| { type: "sessions"; sessions?: SessionInfo[]; onLoad?: (path: string) => void }
	| { type: "tree"; entries: { id: string; parentId: string | null; type: string; role?: string; content?: string }[] }
	| { type: "themes" };

export interface ModalContentProps {
	view: ModalView;
	onClose?: () => void;
	maxHeight?: number;
}

function HeaderRow(props: { title: string; onClose?: () => void }): JSX.Element {
	const c = useThemeColors();
	return (
		<box flexDirection="row" justifyContent="space-between" paddingBottom={1}>
			<text fg={c().text}>
				<b>{props.title}</b>
			</text>
			<text fg={c().muted}>esc</text>
		</box>
	);
}

function HelpContent(): JSX.Element {
	const c = useThemeColors();
	return (
		<box flexDirection="column">
			<text fg={c().text}>
				{" "}
				/help <text fg={c().muted}>Show this help</text>
			</text>
			<text fg={c().text}>
				{" "}
				/model X <text fg={c().muted}>Switch to model X</text>
			</text>
			<text fg={c().text}>
				{" "}
				/models <text fg={c().muted}>List available models</text>
			</text>
			<text fg={c().text}>
				{" "}
				/tools <text fg={c().muted}>List registered tools</text>
			</text>
			<text fg={c().text}>
				{" "}
				/keys <text fg={c().muted}>Show keyboard shortcuts</text>
			</text>
			<text fg={c().text}>
				{" "}
				/clear <text fg={c().muted}>Clear chat history</text>
			</text>
			<text fg={c().text}>
				{" "}
				/thinking <text fg={c().muted}>Toggle thinking display</text>
			</text>
			<text fg={c().text}>
				{" "}
				/theme <text fg={c().muted}>Switch color theme</text>
			</text>
			<text fg={c().text}>
				{" "}
				/tree <text fg={c().muted}>View session tree</text>
			</text>
			<text fg={c().text}>
				{" "}
				/details <text fg={c().muted}>Toggle tool result details</text>
			</text>
			<text fg={c().text}>
				{" "}
				/compact <text fg={c().muted}>Compact conversation context</text>
			</text>
			<box height={1} />
			<text fg={c().text}>
				{" "}
				exit <text fg={c().muted}>Quit kapy</text>
			</text>
		</box>
	);
}

function ModelsContent(props: { models: string[]; current: string }): JSX.Element {
	const c = useThemeColors();
	return (
		<box flexDirection="column">
			<For each={props.models}>
				{(m: string) => {
					const active = m === props.current;
					return (
						<box width="100%" backgroundColor={active ? c().bgElement : undefined} paddingLeft={1} paddingRight={1}>
							<text fg={active ? c().text : c().muted}>
								{active ? "● " : "  "}
								{m}
							</text>
						</box>
					);
				}}
			</For>
			<box height={1} />
			<text fg={c().muted}>
				<text fg={c().text}>↑ ↓</text> navigate <text fg={c().text}>enter</text> select <text fg={c().text}>esc</text>{" "}
				close
			</text>
		</box>
	);
}

function ToolsContent(props: { tools: string[] }): JSX.Element {
	const c = useThemeColors();
	return (
		<box flexDirection="column">
			<For each={props.tools}>{(t: string) => <text fg={c().text}> {t}</text>}</For>
		</box>
	);
}

function KeysContent(): JSX.Element {
	const c = useThemeColors();
	const keys = [
		["Ctrl+C / Ctrl+D", "Quit"],
		["Esc", "Abort / Close dialog"],
		["↑ / ↓", "Navigate palette"],
		["Tab", "Autocomplete command"],
		["Enter", "Execute / Send"],
		["Ctrl+Y", "Copy last assistant message"],
	];
	return (
		<box flexDirection="column">
			<For each={keys}>
				{([key, desc]) => (
					<text fg={c().text}>
						{" "}
						{key.padEnd(18)}
						<text fg={c().muted}>{desc}</text>
					</text>
				)}
			</For>
		</box>
	);
}

function SessionsContent(props: { onLoad?: (path: string) => void; maxHeight?: number }): JSX.Element {
	const c = useThemeColors();
	const [sessions, setSessions] = createSignal<SessionInfo[]>([]);
	const [idx, setIdx] = createSignal(0);
	let scrollRef: any;

	onMount(async () => {
		try {
			const all = await ChatSession.listAllSessions();
			all.sort((a, b) => b.modified.getTime() - a.modified.getTime());
			setSessions(all.slice(0, 50));
		} catch (_e) {
			setSessions([]);
		}
	});

	useKeyboard((evt: any) => {
		const list = sessions();
		if (list.length === 0) return;

		if (evt.name === "up") {
			setIdx((i: number) => Math.max(0, i - 1));
			setTimeout(() => scrollRef?.scrollTo?.(idx()), 0);
			evt.preventDefault();
			return;
		}
		if (evt.name === "down") {
			setIdx((i: number) => Math.min(list.length - 1, i + 1));
			setTimeout(() => scrollRef?.scrollTo?.(idx()), 0);
			evt.preventDefault();
			return;
		}
		if (evt.name === "return" || evt.name === "enter") {
			const s = list[idx()];
			if (s && props.onLoad) {
				props.onLoad(s.path);
			}
			evt.preventDefault();
			return;
		}
	});

	const maxRows = () => Math.max(3, (props.maxHeight ?? 20) - 4);

	return (
		<box flexDirection="column">
			<Show when={sessions().length > 0} fallback={<text fg={c().muted}>No sessions found.</text>}>
				<scrollbox ref={scrollRef} maxHeight={maxRows()}>
					<For each={sessions()}>
						{(s, i) => {
							const active = i() === idx();
							return (
								<box
									width="100%"
									backgroundColor={active ? c().bgElement : undefined}
									paddingLeft={1}
									paddingRight={1}
									flexDirection="row"
								>
									<text fg={active ? c().text : c().muted}>
										{active ? "● " : "  "}
										{s.created.toLocaleDateString()}{" "}
									</text>
									<text fg={active ? c().primary : c().muted}>{s.firstMessage.slice(0, 40) || s.id}</text>
									<text fg={c().muted}> ({s.messageCount} msgs)</text>
								</box>
							);
						}}
					</For>
				</scrollbox>
			</Show>
			<box height={1} />
			<text fg={c().muted}>
				<text fg={c().text}>↑ ↓</text> navigate <text fg={c().text}>enter</text> resume <text fg={c().text}>esc</text>{" "}
				close
			</text>
		</box>
	);
}

function ThemesContent(props: { onClose?: () => void }): JSX.Element {
	const c = useThemeColors();
	const settings = useTuiSettings();
	const themes = listAvailableThemes();
	const initialIdx = (() => {
		const cur = currentThemeName;
		const i = themes.indexOf(cur);
		return i >= 0 ? i : 0;
	})();
	const [idx, setIdx] = createSignal(initialIdx);

	useKeyboard((evt: any) => {
		if (evt.name === "up") {
			setIdx((i: number) => Math.max(0, i - 1));
			evt.preventDefault();
			return;
		}
		if (evt.name === "down") {
			setIdx((i: number) => Math.min(themes.length - 1, i + 1));
			evt.preventDefault();
			return;
		}
		if (evt.name === "return" || evt.name === "enter") {
			const name = themes[idx()];
			setTheme(name, settings.setTheme);
			props.onClose?.();
			evt.preventDefault();
			return;
		}
	});

	return (
		<box flexDirection="column">
			<For each={themes}>
				{(name, i) => {
					const active = name === currentThemeName;
					const selected = i() === idx();
					return (
						<box width="100%" backgroundColor={selected ? c().bgElement : undefined} paddingLeft={1} paddingRight={1}>
							<text fg={active ? c().primary : selected ? c().text : c().muted}>
								{active ? "● " : selected ? "▸ " : "  "}
								{name}
							</text>
							<Show when={active}>
								<text fg={c().muted}> (active)</text>
							</Show>
						</box>
					);
				}}
			</For>
			<box height={1} />
			<text fg={c().muted}>
				<text fg={c().text}>↑ ↓</text> navigate <text fg={c().text}>enter</text> apply <text fg={c().text}>esc</text>{" "}
				close
			</text>
		</box>
	);
}

interface TreeEntry {
	id: string;
	parentId: string | null;
	type: string;
	role?: string;
	content?: string;
}

interface TreeNode {
	entry: TreeEntry;
	children: TreeNode[];
	depth: number;
}

function buildTree(entries: TreeEntry[]): TreeNode[] {
	const map = new Map<string, TreeNode>();
	const roots: TreeNode[] = [];
	for (const e of entries) {
		map.set(e.id, { entry: e, children: [], depth: 0 });
	}
	for (const e of entries) {
		const node = map.get(e.id)!;
		if (e.parentId && map.has(e.parentId)) {
			map.get(e.parentId)?.children.push(node);
		} else {
			roots.push(node);
		}
	}
	function setDepth(nodes: TreeNode[], d: number) {
		for (const n of nodes) {
			n.depth = d;
			setDepth(n.children, d + 1);
		}
	}
	setDepth(roots, 0);
	return roots;
}

function flattenTree(nodes: TreeNode[]): TreeNode[] {
	const result: TreeNode[] = [];
	for (const n of nodes) {
		result.push(n);
		result.push(...flattenTree(n.children));
	}
	return result;
}

function entryIcon(entry: TreeEntry): { icon: string; colorKey: string } {
	if (entry.type === "message") {
		if (entry.role === "user") return { icon: "▶", colorKey: "primary" };
		if (entry.role === "assistant") return { icon: "◁", colorKey: "success" };
		if (entry.role === "tool") return { icon: "⚙", colorKey: "warning" };
	}
	if (entry.type === "compaction") return { icon: "⊟", colorKey: "muted" };
	if (entry.type === "model_change") return { icon: "↻", colorKey: "muted" };
	if (entry.type === "label") return { icon: "🏷", colorKey: "muted" };
	return { icon: "●", colorKey: "muted" };
}

function entryPreview(content?: string): string {
	if (!content) return "";
	const s = content.replace(/\n/g, " ").trim();
	return s.length > 60 ? `${s.slice(0, 57)}...` : s;
}

function TreeContent(props: { entries: TreeEntry[]; onClose?: () => void }): JSX.Element {
	const c = useThemeColors();
	const flat = () => flattenTree(buildTree(props.entries));
	const [idx, setIdx] = createSignal(0);

	useKeyboard((evt: any) => {
		if (evt.name === "up") {
			setIdx((i: number) => Math.max(0, i - 1));
			evt.preventDefault();
			return;
		}
		if (evt.name === "down") {
			setIdx((i: number) => Math.min(flat().length - 1, i + 1));
			evt.preventDefault();
			return;
		}
		if (evt.name === "return" || evt.name === "enter") {
			props.onClose?.();
			evt.preventDefault();
			return;
		}
	});

	return (
		<box flexDirection="column">
			<For each={flat()}>
				{(node, i) => {
					const { icon, colorKey } = entryIcon(node.entry);
					const fg = () => (c() as any)[colorKey] ?? c().muted;
					const selected = i() === idx();
					const indent = "  ".repeat(node.depth);
					return (
						<box width="100%" backgroundColor={selected ? c().bgElement : undefined} paddingLeft={1} paddingRight={1}>
							<text fg={selected ? c().text : c().muted}>
								{indent}
								{icon} <text fg={fg()}>{node.entry.type}</text>
								<Show when={node.entry.role}>
									<text fg={c().textMuted}>/{node.entry.role}</text>
								</Show>{" "}
								<text fg={c().textMuted}>{entryPreview(node.entry.content)}</text>
							</text>
						</box>
					);
				}}
			</For>
			<box height={1} />
			<text fg={c().muted}>
				<text fg={c().text}>↑ ↓</text> navigate <text fg={c().text}>enter</text> close <text fg={c().text}>esc</text>{" "}
				close
			</text>
		</box>
	);
}

export function ModalContent(props: ModalContentProps): JSX.Element {
	const _c = useThemeColors();
	const title = (): string => {
		switch (props.view.type) {
			case "help":
				return "Commands";
			case "models":
				return "Models";
			case "tools":
				return "Tools";
			case "keys":
				return "Keys";
			case "sessions":
				return "Sessions";
			case "themes":
				return "Themes";
			case "tree":
				return "Session Tree";
		}
	};

	return (
		<box flexDirection="column" width="100%" paddingLeft={2} paddingRight={2} paddingBottom={1}>
			<HeaderRow title={title()!} onClose={props.onClose} />
			<Show when={props.view.type === "help"}>
				<HelpContent />
			</Show>
			<Show when={props.view.type === "models"}>
				<ModelsContent
					models={(props.view as { type: "models"; models: string[]; current: string }).models}
					current={(props.view as { type: "models"; models: string[]; current: string }).current}
				/>
			</Show>
			<Show when={props.view.type === "tools"}>
				<ToolsContent tools={(props.view as { type: "tools"; tools: string[] }).tools} />
			</Show>
			<Show when={props.view.type === "keys"}>
				<KeysContent />
			</Show>
			<Show when={props.view.type === "sessions"}>
				<SessionsContent
					onLoad={(path) => {
						const load = (props.view as any).onLoad;
						props.onClose?.();
						load?.(path);
					}}
					maxHeight={props.maxHeight}
				/>
			</Show>
			<Show when={props.view.type === "themes"}>
				<ThemesContent onClose={props.onClose} />
			</Show>
			<Show when={props.view.type === "tree"}>
				<TreeContent entries={(props.view as { type: "tree"; entries: TreeEntry[] }).entries} onClose={props.onClose} />
			</Show>
		</box>
	);
}
