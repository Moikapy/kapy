/**
 * web_fetch tool — fetch and extract content from URLs.
 *
 * Supports three output formats: text (stripped), markdown, html (raw).
 * Converts HTML to readable text or markdown without external dependencies.
 */
import { z } from "zod";
import type { KapyToolRegistration, ToolResult, ToolExecutionContext } from "../types.js";

// ── Constants ──────────────────────────────────────────────────────────

const DEFAULT_TIMEOUT = 30_000; // 30s
const MAX_TIMEOUT = 60_000; // 60s
const MAX_RESPONSE_SIZE = 5 * 1024 * 1024; // 5MB
const DEFAULT_MAX_LENGTH = 5000;
const USER_AGENT =
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

// ── HTML to Text ───────────────────────────────────────────────────────

/** Decode HTML entities safely */
function decodeHtml(html: string): string {
	try {
		return html
			.replace(/&amp;/g, "&")
			.replace(/&lt;/g, "<")
			.replace(/&gt;/g, ">")
			.replace(/&quot;/g, '"')
			.replace(/&#39;/g, "'")
			.replace(/&#x27;/g, "'")
			.replace(/&apos;/g, "'")
			.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
			.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(Number(`0x${hex}`)))
			.replace(/&nbsp;/g, " ");
	} catch {
		return html;
	}
}

/** Remove scripts, styles, nav, header, footer, and other non-content elements */
function removeNonContent(html: string): string {
	return html
		.replace(/<script[\s\S]*?<\/script>/gi, "")
		.replace(/<style[\s\S]*?<\/style>/gi, "")
		.replace(/<nav[\s\S]*?<\/nav>/gi, "")
		.replace(/<header[\s\S]*?<\/header>/gi, "")
		.replace(/<footer[\s\S]*?<\/footer>/gi, "")
		.replace(/<aside[\s\S]*?<\/aside>/gi, "")
		.replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
		.replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
		.replace(/<svg[\s\S]*?<\/svg>/gi, "")
		.replace(/<!--[\s\S]*?-->/g, "");
}

/** Strip all HTML tags, decode entities, normalize whitespace */
function htmlToText(html: string): string {
	const cleaned = removeNonContent(html);
	// Add newlines after block elements
	const blocked = cleaned
		.replace(/<\/?(p|div|br|h[1-6]|li|tr|hr)[^>]*>/gi, "\n")
		.replace(/<\/?(ul|ol|table|dl|blockquote|pre|figure)[^>]*>/gi, "\n")
		.replace(/<br\s*\/?>/gi, "\n");
	const stripped = blocked.replace(/<[^>]*>/g, "");
	const decoded = decodeHtml(stripped);
	// Normalize whitespace but preserve intentional newlines
	return decoded
		.replace(/[ \t]+/g, " ")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

// ── HTML to Markdown ────────────────────────────────────────────────────

/** Convert HTML to markdown (basic, no external deps) */
function htmlToMarkdown(html: string): string {
	try {
		let md = removeNonContent(html);

		// Headings — h1 through h6
		md = md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, (_, content) => {
			const text = decodeHtml(content.replace(/<[^>]*>/g, "").trim());
			return `\n\n# ${text}\n\n`;
		});
		md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (_, content) => {
			const text = decodeHtml(content.replace(/<[^>]*>/g, "").trim());
			return `\n\n## ${text}\n\n`;
		});
		md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (_, content) => {
			const text = decodeHtml(content.replace(/<[^>]*>/g, "").trim());
			return `\n\n### ${text}\n\n`;
		});
		md = md.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, (_, content) => {
			const text = decodeHtml(content.replace(/<[^>]*>/g, "").trim());
			return `\n\n#### ${text}\n\n`;
		});
		md = md.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, (_, content) => {
			const text = decodeHtml(content.replace(/<[^>]*>/g, "").trim());
			return `\n\n##### ${text}\n\n`;
		});
		md = md.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, (_, content) => {
			const text = decodeHtml(content.replace(/<[^>]*>/g, "").trim());
			return `\n\n###### ${text}\n\n`;
		});

		// Links — <a href="url">text</a>
		md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, text) => {
			const linkText = text.replace(/<[^>]*>/g, "").trim();
			return `[${decodeHtml(linkText)}](${href})`;
		});

		// Images — <img alt="..." src="...">
		md = md.replace(/<img[^>]*alt="([^"]*)"[^>]*src="([^"]*)"[^>]*\/?>/gi, (_, alt, src) => {
			return `![${alt}](${src})`;
		});
		md = md.replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, (_, src, alt) => {
			return `![${alt}](${src})`;
		});

		// Bold and italic
		md = md.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/(strong|b)>/gi, (_, _tag, content) => {
			const text = content.replace(/<[^>]*>/g, "");
			return `**${decodeHtml(text)}**`;
		});
		md = md.replace(/<(em|i)[^>]*>([\s\S]*?)<\/(em|i)>/gi, (_, _tag, content) => {
			const text = content.replace(/<[^>]*>/g, "");
			return `*${decodeHtml(text)}*`;
		});

		// Code blocks — <pre><code>...</code></pre>
		md = md.replace(
			/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi,
			(_, code) => `\n\`\`\`\n${decodeHtml(code.trim())}\n\`\`\`\n`,
		);
		// Inline code
		md = md.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (_, code) => `\`${decodeHtml(code)}\``);

		// Lists — unordered
		md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, content) => {
			const text = content.replace(/<[^>]*>/g, "").trim();
			return `- ${decodeHtml(text)}\n`;
		});

		// Blockquotes
		md = md.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, content) => {
			const text = content.replace(/<[^>]*>/g, "").trim();
			return (
				decodeHtml(text)
					.split("\n")
					.map((line: string) => `> ${line}`)
					.join("\n") + "\n\n"
			);
		});

		// Paragraphs and line breaks
		md = md.replace(/<br\s*\/?>/gi, "\n");
		md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_, content) => {
			const text = content.replace(/<[^>]*>/g, "").trim();
			return `\n\n${decodeHtml(text)}\n\n`;
		});

		// Horizontal rules
		md = md.replace(/<hr\s*\/?>/gi, "\n\n---\n\n");

		// Remove remaining tags
		md = md.replace(/<[^>]*>/g, "");

		// Decode entities
		md = decodeHtml(md);

		// Normalize whitespace
		md = md
			.replace(/[ \t]+/g, " ")
			.replace(/\n{3,}/g, "\n\n")
			.trim();

		return md;
	} catch {
		// If markdown conversion fails, fall back to plain text
		return htmlToText(html);
	}
}

// ── Tool definition ─────────────────────────────────────────────────────

export const webFetchTool: KapyToolRegistration = {
	name: "web_fetch",
	label: "Web Fetch",
	description:
		"Fetch content from a URL and extract readable text. Supports text, markdown, and HTML output formats. Useful for reading documentation, APIs, and web pages.",
	promptSnippet: "web_fetch: fetch and extract content from web pages",
	promptGuidelines: [
		"Use web_fetch to read the full content of a web page found via web_search or from a known URL.",
		"Use 'text' format for quick extraction, 'markdown' for structured content, or 'html' for raw HTML.",
		"Respect robots.txt and rate-limit — don't fetch the same domain rapidly.",
		"Some sites may block automated requests. Try text format first as it's faster.",
	],
	parameters: z.object({
		url: z.string().describe("The URL to fetch (must start with http:// or https://)"),
		format: z
			.enum(["text", "markdown", "html"])
			.optional()
			.describe("Output format: text (plain), markdown, or html (default: text)"),
		maxLength: z
			.number()
			.optional()
			.describe("Maximum characters to return (default: 5000)"),
		timeout: z
			.number()
			.optional()
			.describe("Request timeout in milliseconds (default: 30000, max: 60000)"),
	}),
	async execute(
		_callId: string,
		params: Record<string, unknown>,
		signal: AbortSignal | undefined,
		_onUpdate: (r: ToolResult) => void,
		_ctx: ToolExecutionContext,
	): Promise<ToolResult> {
		const url = params.url as string;
		const format = (params.format as "text" | "markdown" | "html") ?? "text";
		const maxLength = (params.maxLength as number) ?? DEFAULT_MAX_LENGTH;
		const timeout = Math.min((params.timeout as number) ?? DEFAULT_TIMEOUT, MAX_TIMEOUT);

		// Validate URL
		if (!url || (!url.startsWith("http://") && !url.startsWith("https://"))) {
			return {
				content: [{ type: "text", text: "Error: URL must start with http:// or https://." }],
				details: { error: "invalid_url", url },
			};
		}

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeout);

		// Link external abort signal
		if (signal) {
			signal.addEventListener("abort", () => controller.abort(), { once: true });
		}

		try {
			const response = await fetch(url, {
				headers: {
					"User-Agent": USER_AGENT,
					Accept:
						"text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5",
					"Accept-Language": "en-US,en;q=0.5",
				},
				signal: controller.signal,
				redirect: "follow",
			});

			if (!response.ok) {
				return {
					content: [
						{
							type: "text",
							text: `Fetch failed: HTTP ${response.status} ${response.statusText}`,
						},
					],
					details: { error: "http_error", status: response.status, url },
				};
			}

			// Check content length
			const contentLength = response.headers.get("content-length");
			if (contentLength && Number(contentLength) > MAX_RESPONSE_SIZE) {
				return {
					content: [
						{
							type: "text",
							text: `Response too large (${(Number(contentLength) / 1024 / 1024).toFixed(1)}MB). Maximum is 5MB.`,
						},
					],
					details: { error: "response_too_large", size: Number(contentLength), url },
				};
			}

			const buffer = await response.arrayBuffer();

			// Check actual size
			if (buffer.byteLength > MAX_RESPONSE_SIZE) {
				return {
					content: [
						{
							type: "text",
							text: `Response too large (${(buffer.byteLength / 1024 / 1024).toFixed(1)}MB). Maximum is 5MB.`,
						},
					],
					details: { error: "response_too_large", size: buffer.byteLength, url },
				};
			}

			const contentType = response.headers.get("content-type") ?? "";
			const rawText = new TextDecoder("utf-8", { fatal: false }).decode(buffer);

			let content: string;
			const isHtml =
				contentType.includes("text/html") || contentType.includes("application/xhtml");

			switch (format) {
				case "html":
					// Return raw HTML, truncated
					content = rawText.slice(0, maxLength);
					if (rawText.length > maxLength) content += "\n\n[Truncated]";
					break;

				case "markdown":
					if (isHtml) {
						content = htmlToMarkdown(rawText);
					} else {
						// Non-HTML: wrap in code block
						content = "```\n" + rawText.slice(0, maxLength) + "\n```";
					}
					if (content.length > maxLength) {
						content = content.slice(0, maxLength) + "\n\n[Truncated]";
					}
					break;

				case "text":
				default:
					if (isHtml) {
						content = htmlToText(rawText);
					} else {
						content = rawText;
					}
					if (content.length > maxLength) {
						content = content.slice(0, maxLength) + "\n\n[Truncated]";
					}
					break;
			}

			return {
				content: [{ type: "text", text: content || "(empty response)" }],
				details: {
					url,
					format,
					contentType,
					statusCode: response.status,
					contentLength: rawText.length,
					truncated: rawText.length > maxLength || content.length >= maxLength,
				},
			};
		} catch (err: unknown) {
			if (signal?.aborted || controller.signal.aborted) {
				return {
					content: [{ type: "text", text: "Fetch was aborted." }],
					details: { error: "aborted", url },
				};
			}
			const message = err instanceof Error ? err.message : String(err);
			return {
				content: [{ type: "text", text: `Fetch error: ${message}` }],
				details: { error: "network_error", message, url },
			};
		} finally {
			clearTimeout(timeoutId);
		}
	},
	isReadOnly: () => true,
	isConcurrencySafe: () => true,
};