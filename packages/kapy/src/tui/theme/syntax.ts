import { colors, onThemeChange, type ThemeColors } from "@moikapy/kapy-components";
import { SyntaxStyle, type ThemeTokenStyle } from "@opentui/core";

function buildTheme(c: ThemeColors): ThemeTokenStyle[] {
	return [
		{ scope: ["default"], style: { foreground: c.text } },
		{
			scope: [
				"keyword",
				"keyword.conditional",
				"keyword.coroutine",
				"keyword.directive",
				"keyword.exception",
				"keyword.function",
				"keyword.import",
				"keyword.modifier",
				"keyword.repeat",
				"keyword.return",
				"keyword.type",
			],
			style: { foreground: c.syntaxKeyword, bold: true },
		},
		{ scope: ["keyword.operator"], style: { foreground: c.syntaxOperator } },
		{
			scope: ["function", "function.builtin", "function.call", "function.method", "function.method.call"],
			style: { foreground: c.syntaxFunction },
		},
		{ scope: ["type", "type.builtin"], style: { foreground: c.syntaxType } },
		{ scope: ["variable"], style: { foreground: c.syntaxVariable } },
		{ scope: ["variable.builtin"], style: { foreground: c.syntaxConstant } },
		{ scope: ["variable.parameter"], style: { foreground: c.text } },
		{ scope: ["variable.member"], style: { foreground: c.syntaxProperty } },
		{ scope: ["string", "string.special"], style: { foreground: c.syntaxString } },
		{ scope: ["string.escape", "string.regexp"], style: { foreground: c.syntaxRegexp } },
		{ scope: ["string.special.url"], style: { foreground: c.markdownLink, underline: true } },
		{ scope: ["number", "number.float"], style: { foreground: c.syntaxNumber } },
		{ scope: ["boolean", "constant", "constant.builtin"], style: { foreground: c.syntaxConstant } },
		{ scope: ["comment", "comment.documentation"], style: { foreground: c.syntaxComment, italic: true } },
		{ scope: ["operator"], style: { foreground: c.syntaxOperator } },
		{
			scope: ["punctuation.bracket", "punctuation.delimiter", "punctuation.special"],
			style: { foreground: c.syntaxPunctuation },
		},
		{ scope: ["constructor", "attribute"], style: { foreground: c.syntaxFunction } },
		{ scope: ["label"], style: { foreground: c.warning } },
		{ scope: ["module", "module.builtin"], style: { foreground: c.syntaxType } },
		{ scope: ["embedded"], style: { foreground: c.text } },
		{ scope: ["character"], style: { foreground: c.syntaxString } },
		{ scope: ["character.special"], style: { foreground: c.syntaxRegexp } },
		{
			scope: [
				"markup.heading",
				"markup.heading.1",
				"markup.heading.2",
				"markup.heading.3",
				"markup.heading.4",
				"markup.heading.5",
				"markup.heading.6",
			],
			style: { foreground: c.markdownHeading, bold: true },
		},
		{ scope: ["markup.italic"], style: { italic: true } },
		{ scope: ["markup.strong"], style: { bold: true } },
		{ scope: ["markup.strikethrough"], style: { dim: true } },
		{ scope: ["markup.link", "markup.link.url"], style: { foreground: c.markdownLink, underline: true } },
		{ scope: ["markup.link.label"], style: { foreground: c.markdownLinkText } },
		{ scope: ["markup.link.bracket"], style: { foreground: c.markdownLink } },
		{ scope: ["markup.list"], style: { foreground: c.markdownListItem } },
		{ scope: ["markup.list.checked"], style: { foreground: c.success } },
		{ scope: ["markup.list.unchecked"], style: { foreground: c.muted } },
		{ scope: ["markup.quote"], style: { foreground: c.markdownBlockQuote, italic: true } },
		{ scope: ["markup.raw"], style: { foreground: c.markdownCode } },
		{ scope: ["markup.raw.block"], style: { foreground: c.markdownCodeBlock } },
	];
}

let _cache: SyntaxStyle | null = null;

export function generateSyntax(): SyntaxStyle {
	if (!_cache) _cache = SyntaxStyle.fromTheme(buildTheme(colors));
	return _cache;
}

function dimColor(hex: string, opacity: number): string {
	if (!hex.startsWith("#") || hex.length !== 7) return hex;
	const r = parseInt(hex.slice(1, 3), 16);
	const g = parseInt(hex.slice(3, 5), 16);
	const b = parseInt(hex.slice(5, 7), 16);
	const d = (v: number) => Math.round(v * opacity);
	return `#${d(r).toString(16).padStart(2, "0")}${d(g).toString(16).padStart(2, "0")}${d(b).toString(16).padStart(2, "0")}`;
}

function buildSubtleTheme(c: ThemeColors): ThemeTokenStyle[] {
	return buildTheme(c).map((entry) => ({
		scope: entry.scope,
		style: {
			...entry.style,
			foreground: entry.style.foreground ? dimColor(entry.style.foreground as string, c.thinkingOpacity) : undefined,
		},
	}));
}

let _subtleCache: SyntaxStyle | null = null;

export function generateSubtleSyntax(): SyntaxStyle {
	if (!_subtleCache) _subtleCache = SyntaxStyle.fromTheme(buildSubtleTheme(colors));
	return _subtleCache;
}

onThemeChange(() => {
	_cache = null;
	_subtleCache = null;
});
