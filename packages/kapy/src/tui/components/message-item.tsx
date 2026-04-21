import { type ThemeColors, useThemeColors } from "@moikapy/kapy-components";
import { useRenderer } from "@opentui/solid";
import type { JSX } from "solid-js";
import { createMemo, createSignal, Show } from "solid-js";
import { useTuiSettings } from "../hooks/use-tui-settings.js";
import { generateSubtleSyntax, generateSyntax } from "../theme/index.js";
import type { Msg } from "../types.js";
import { SpinnerFrame } from "./spinner.js";

const TOOL_STYLES: Record<string, { icon: string; colorKey: string; pending: string; kind: "inline" | "block" }> = {
	read_file: { icon: "", colorKey: "toolFile", pending: "Reading file...", kind: "inline" },
	write_file: { icon: "", colorKey: "toolFile", pending: "Writing file...", kind: "block" },
	edit_file: { icon: "", colorKey: "toolEdit", pending: "Preparing edit...", kind: "block" },
	grep: { icon: "", colorKey: "toolSearch", pending: "Searching content...", kind: "inline" },
	glob: { icon: "", colorKey: "toolSearch", pending: "Finding files...", kind: "inline" },
	find: { icon: "", colorKey: "toolSearch", pending: "Finding files...", kind: "inline" },
	bash: { icon: "", colorKey: "toolShell", pending: "Running command...", kind: "block" },
	grimoire_read: { icon: "", colorKey: "toolGrimoire", pending: "Reading grimoire...", kind: "inline" },
	grimoire_write: { icon: "", colorKey: "toolGrimoire", pending: "Writing grimoire...", kind: "inline" },
	grimoire_list: { icon: "", colorKey: "toolGrimoire", pending: "Listing grimoire...", kind: "inline" },
	grimoire_search: { icon: "", colorKey: "toolGrimoire", pending: "Searching grimoire...", kind: "inline" },
	grimoire_ingest: { icon: "", colorKey: "toolGrimoire", pending: "Ingesting...", kind: "inline" },
	grimoire_lint: { icon: "", colorKey: "toolGrimoire", pending: "Linting...", kind: "inline" },
	soul_evolve: { icon: "", colorKey: "toolGrimoire", pending: "Evolving...", kind: "inline" },
	web_fetch: { icon: "", colorKey: "toolWeb", pending: "Fetching from web...", kind: "inline" },
	web_search: { icon: "", colorKey: "toolWeb", pending: "Searching web...", kind: "inline" },
};

const DEFAULT_TOOL_STYLE = { icon: "", colorKey: "warning" as string, pending: "Working...", kind: "inline" as const };

function getToolStyle(name: string) {
	return TOOL_STYLES[name] ?? DEFAULT_TOOL_STYLE;
}

function resolveColor(c: () => ThemeColors, key: string): string {
	return (c() as any)[key] ?? c().warning;
}

function parseToolContent(content: string): { name: string; args: Record<string, any> } {
	const match = content.match(/⟹\s+(\w+)\((.+)\)$/s);
	if (!match) return { name: content, args: {} };
	const name = match[1];
	try {
		return { name, args: JSON.parse(match[2]) };
	} catch {
		return { name, args: {} };
	}
}

function getFilePath(args: Record<string, any>): string {
	return args.path ?? args.file ?? args.filePath ?? "";
}

function summarizeResult(content: string): { text: string; isError: boolean } {
	if (!content) return { text: "(empty)", isError: false };
	if (content.startsWith("Error:") || content.startsWith("error:") || content.includes("not found")) {
		return { text: content.slice(0, 80), isError: true };
	}
	const lines = content.split("\n").length;
	if (lines > 3) return { text: `${lines} lines`, isError: false };
	return { text: content.slice(0, 80), isError: false };
}

function tryParseDiff(content: string): string | null {
	if (!content) return null;
	const hasHunkHeader = content.includes("@@");
	const hasDiffMarkers = content.split("\n").some((l) => l.startsWith("+") || l.startsWith("-"));
	if (!hasHunkHeader && !hasDiffMarkers) return null;
	return content;
}

function smartMargin(current: Msg, prev?: Msg): number {
	if (!prev) return 1;
	if (current.role === "tool_call" || current.role === "tool_result") {
		if (prev.role === "tool_call" || prev.role === "tool_result") return 0;
		return 1;
	}
	return 1;
}

export interface MessageItemProps {
	msg: Msg;
	prev?: Msg;
	onCopy?: (text: string) => void;
}

export function MessageItem(props: MessageItemProps): JSX.Element {
	const m = props.msg;
	const c = useThemeColors();
	const renderer = useRenderer();
	const [expanded, setExpanded] = createSignal(false);
	const [hover, setHover] = createSignal(false);
	const settings = useTuiSettings();
	const mt = () => smartMargin(m, props.prev);

	const syntax = generateSyntax();
	const subtleSyntax = generateSubtleSyntax();

	function hasSelection(): boolean {
		try {
			if ((renderer as any).hasSelection) return true;
		} catch {}
		try {
			if (renderer.getSelection()?.getSelectedText()) return true;
		} catch {}
		return false;
	}

	function handleClick() {
		if (hasSelection()) return;
		if (m.role === "tool_result") {
			const lines = m.content.split("\n").length;
			if (lines > 3 || m.content.length > 80) {
				setExpanded(!expanded());
				return;
			}
		}
		const text = m.content;
		if (!text) return;
		try {
			const ok = renderer.copyToClipboardOSC52(text);
			if (ok && props.onCopy) props.onCopy(text);
		} catch {}
	}

	if (m.role === "user" && m.queued) {
		return (
			<box marginTop={mt()} flexShrink={0} border={["left"]} borderColor={c().primary}>
				<box backgroundColor={c().bgPanel} paddingLeft={2} paddingTop={1} paddingBottom={1}>
					<text fg={c().text} selectable>
						{m.content}
					</text>
					<text fg={c().muted}> (queued)</text>
				</box>
			</box>
		);
	}

	if (m.role === "user") {
		return (
			<box
				marginTop={mt()}
				flexShrink={0}
				border={["left"]}
				borderColor={c().primary}
				onMouseUp={handleClick}
				onMouseOver={() => setHover(true)}
				onMouseOut={() => setHover(false)}
			>
				<box backgroundColor={hover() ? c().bgElement : c().bgPanel} paddingLeft={2} paddingTop={1} paddingBottom={1}>
					<text fg={c().text} selectable>
						{m.content}
					</text>
				</box>
			</box>
		);
	}

	if (m.role === "system") {
		return (
			<box paddingLeft={2} marginTop={mt()} flexShrink={0}>
				<text fg={c().muted} selectable>
					{m.content}
				</text>
			</box>
		);
	}

	if (m.role === "compaction") {
		return (
			<box
				marginTop={mt()}
				flexShrink={0}
				border={["top"]}
				borderColor={c().border}
				title=" Compaction "
				titleAlignment="center"
			>
				<text fg={c().muted} selectable>
					{m.content}
				</text>
			</box>
		);
	}

	if (m.role === "context_group") {
		const items = m.items ?? [];
		const [groupExpanded, setGroupExpanded] = createSignal(false);
		const fileCount = items.filter((it) => it.role === "tool_call").length;
		return (
			<box
				marginTop={mt()}
				flexShrink={0}
				flexDirection="column"
				onMouseUp={() => {
					if (!hasSelection()) setGroupExpanded(!groupExpanded());
				}}
			>
				<box flexDirection="row">
					<text fg={c().primary}>{groupExpanded() ? "▼" : "▶"} </text>
					<text fg={c().text}>
						<b>Gathered context</b>
					</text>
					<text fg={c().muted}> ({fileCount})</text>
					<Show when={!groupExpanded()}>
						<text fg={c().borderDim}> Click to expand</text>
					</Show>
				</box>
				<Show when={groupExpanded()}>
					<box paddingLeft={3} border={["left"]} borderColor={c().borderDim} flexDirection="column">
						{items.map((item) => {
							if (item.role === "tool_call") {
								const { name, args } = parseToolContent(item.content);
								const filePath = getFilePath(args);
								return <text fg={c().textMuted}>↳ Loaded {filePath || name}</text>;
							}
							if (item.role === "tool_result" && item.content) {
								const lines = item.content.split("\n").length;
								if (lines > 1) return <text fg={c().muted}> {lines} lines</text>;
								const preview = item.content.slice(0, 60);
								return <text fg={c().muted}> {preview}</text>;
							}
							return <box />;
						})}
					</box>
				</Show>
			</box>
		);
	}

	if (m.role === "tool_call") {
		const { name, args } = parseToolContent(m.content);
		const style = getToolStyle(name);
		const isRunning = m.toolStatus === "running" || m.toolStatus === "pending";
		const isCompleted = m.toolStatus === "completed" || m.toolStatus === "error";
		const isError = m.toolStatus === "error";
		const filePath = getFilePath(args);
		const styleColor = () => resolveColor(c, style.colorKey);

		if (isCompleted && !settings.showDetails()) {
			return (
				<box marginTop={mt()} paddingLeft={3} flexShrink={0}>
					<text fg={c().borderDim}>
						{style.icon} {name}
						<Show when={filePath}> {filePath}</Show>
					</text>
				</box>
			);
		}

		if (isError) {
			return (
				<box marginTop={mt()} flexShrink={0} border={["left"]} borderColor={c().error}>
					<box
						backgroundColor={hover() ? c().bgElement : c().bgPanel}
						paddingLeft={2}
						paddingTop={1}
						paddingBottom={1}
						flexDirection="column"
						onMouseOver={() => setHover(true)}
						onMouseOut={() => setHover(false)}
					>
						<box flexDirection="row">
							<text fg={c().error}>{style.icon} </text>
							<text fg={c().error}>
								<b>{name}</b>
							</text>
							<Show when={filePath}>
								<text fg={c().muted}> {filePath}</text>
							</Show>
						</box>
						<text fg={c().textMuted}>failed</text>
					</box>
				</box>
			);
		}

		if (isRunning) {
			if (style.kind === "block") {
				return (
					<box marginTop={mt()} flexShrink={0} border={["left"]} borderColor={styleColor()}>
						<box backgroundColor={c().bgPanel} paddingLeft={2} paddingTop={1} paddingBottom={1} flexDirection="column">
							<box flexDirection="row">
								<text fg={styleColor()}>{style.icon} </text>
								<text fg={c().text}>
									<b>{name}</b>
								</text>
								<Show when={filePath}>
									<text fg={c().muted}> {filePath}</text>
								</Show>
							</box>
							<SpinnerFrame fg={c().muted} text={style.pending} />
						</box>
					</box>
				);
			}
			return (
				<box marginTop={mt()} paddingLeft={3} flexShrink={0}>
					<SpinnerFrame fg={c().muted} text={`~ ${style.pending}`} />
				</box>
			);
		}

		if (style.kind === "block") {
			return (
				<box
					marginTop={mt()}
					flexShrink={0}
					border={["left"]}
					borderColor={styleColor()}
					onMouseOver={() => setHover(true)}
					onMouseOut={() => setHover(false)}
				>
					<box backgroundColor={hover() ? c().bgElement : c().bgPanel} paddingLeft={2} paddingTop={1} paddingBottom={1}>
						<box flexDirection="row">
							<text fg={styleColor()}>{style.icon} </text>
							<text fg={c().text}>
								<b>{name}</b>
							</text>
							<Show when={filePath}>
								<text fg={c().muted}> {filePath}</text>
							</Show>
						</box>
					</box>
				</box>
			);
		}

		const inlineFg = createMemo(() => (hover() ? c().text : c().textMuted));

		return (
			<box
				marginTop={mt()}
				paddingLeft={3}
				flexShrink={0}
				onMouseUp={handleClick}
				onMouseOver={() => setHover(true)}
				onMouseOut={() => setHover(false)}
			>
				<text fg={styleColor()}>{style.icon} </text>
				<text fg={inlineFg()}>
					<b>{name}</b>
				</text>
				<Show when={filePath}>
					<text fg={c().muted}> {filePath}</text>
				</Show>
			</box>
		);
	}

	if (m.role === "tool_result") {
		if (!settings.showDetails()) {
			return <box />;
		}
		const summary = summarizeResult(m.content);
		const lines = m.content.split("\n").length;
		const canExpand = lines > 3 || m.content.length > 80;
		const diffContent = tryParseDiff(m.content);

		if (summary.isError) {
			return (
				<box marginLeft={2} marginTop={0} flexShrink={0} flexDirection="column">
					<box
						border={["left"]}
						borderColor={c().error}
						backgroundColor={c().bgPanel}
						paddingLeft={2}
						paddingTop={1}
						paddingBottom={1}
						onMouseUp={handleClick}
						onMouseOver={() => setHover(true)}
						onMouseOut={() => setHover(false)}
					>
						<text fg={c().error}>✗ </text>
						<text fg={hover() ? c().text : c().textMuted} selectable>
							{summary.text}
						</text>
						<Show when={canExpand}>
							<text fg={c().borderDim}> {expanded() ? "Click to collapse" : "Click to expand"}</text>
						</Show>
					</box>
					<Show when={expanded()}>
						<box paddingLeft={2} border={["left"]} borderColor={c().borderDim} flexDirection="column">
							<text fg={c().textMuted} selectable>
								{m.content}
							</text>
						</box>
					</Show>
				</box>
			);
		}

		return (
			<box marginLeft={2} marginTop={0} flexShrink={0} flexDirection="column">
				<Show when={diffContent && expanded()}>
					<box border={["left"]} borderColor={c().borderDim} flexDirection="column">
						<diff
							diff={diffContent}
							view="unified"
							syntaxStyle={syntax}
							showLineNumbers={true}
							fg={c().text}
							addedBg={c().diffAddedBg}
							removedBg={c().diffRemovedBg}
							contextBg={c().diffContextBg}
							addedSignColor={c().diffHighlightAdded}
							removedSignColor={c().diffHighlightRemoved}
							lineNumberFg={c().diffLineNumber}
							addedLineNumberBg={c().diffAddedLineNumberBg}
							removedLineNumberBg={c().diffRemovedLineNumberBg}
						/>
					</box>
				</Show>
				<Show when={!diffContent || !expanded()}>
					<box
						flexDirection="row"
						onMouseUp={handleClick}
						onMouseOver={() => setHover(true)}
						onMouseOut={() => setHover(false)}
					>
						<text fg={c().muted}> ✓ </text>
						<text fg={hover() ? c().text : c().muted} selectable>
							{summary.text}
						</text>
						<Show when={canExpand}>
							<text fg={c().borderDim}> {expanded() ? "Click to collapse" : "Click to expand"}</text>
						</Show>
					</box>
				</Show>
				<Show when={expanded() && !diffContent}>
					<box paddingLeft={2} border={["left"]} borderColor={c().borderDim} flexDirection="column">
						<text fg={c().textMuted} selectable>
							{m.content}
						</text>
					</box>
				</Show>
			</box>
		);
	}

	return (
		<box paddingLeft={1} marginTop={mt()} flexShrink={0} flexDirection="column" onMouseUp={handleClick}>
			<Show when={!!m.reasoning && settings.showThinking()}>
				<box paddingLeft={2} flexDirection="column" border={["left"]} borderColor={c().bgElement}>
					<code
						filetype="markdown"
						content={`_Thinking:_ ${m.reasoning}`}
						streaming={m.streaming}
						drawUnstyledText={false}
						conceal={true}
						syntaxStyle={subtleSyntax}
						fg={c().muted}
						selectable
					/>
				</box>
			</Show>
			<code
				filetype="markdown"
				content={m.content}
				streaming={m.streaming}
				drawUnstyledText={false}
				conceal={true}
				syntaxStyle={syntax}
				fg={c().success}
				selectable
			/>
			<Show when={m.streaming}>
				<SpinnerFrame fg={c().primary} />
			</Show>
			<Show when={!m.streaming && m.durationMs != null}>
				<box paddingLeft={2} flexDirection="row" gap={1}>
					<text fg={c().primary}>▣</text>
					<text fg={c().text}>Kapy</text>
					<Show when={m.model}>
						<text fg={c().textMuted}> · {m.model?.split(":").slice(1).join(":")}</text>
					</Show>
					<Show when={m.durationMs != null && m.durationMs! > 0}>
						<text fg={c().textMuted}> · {formatDuration(m.durationMs!)}</text>
					</Show>
				</box>
			</Show>
		</box>
	);
}

function formatDuration(ms: number): string {
	if (ms < 1000) return `${ms}ms`;
	const s = Math.floor(ms / 1000);
	if (s < 60) return `${s}s`;
	const min = Math.floor(s / 60);
	const sec = s % 60;
	return `${min}m ${sec}s`;
}
