/**
 * Compaction — pi-compatible context compaction with LLM-generated summaries.
 *
 * Strategy:
 * 1. Find cut point (walk backwards, keep keepRecentTokens of recent messages)
 * 2. Prune old tool outputs before summarization
 * 3. Generate structured summary via LLM (Goal/Constraints/Progress/Key Decisions/Next Steps/Critical Context)
 * 4. If previous summary exists, update it incrementally
 * 5. Extract file operations from tool calls in summarized messages
 * 6. Persist compaction entry to session
 * 7. Optional: auto-continue after overflow compaction
 */

import type { AgentMessage } from "@moikapy/kapy-agent";
import type { Model } from "@moikapy/kapy-ai";
import { streamSimple } from "@moikapy/kapy-ai";
import { type ContextTracker, estimateContextTokens } from "./context-tracker.js";
import type { SessionManager } from "./session/manager.js";

export interface CompactionResult {
	summary: string;
	firstKeptEntryId: string;
	tokensBefore: number;
	cutIndex: number;
}

const INITIAL_SUMMARY_PROMPT = `Summarize the following conversation into a structured summary. Be concise but preserve all critical information.

Format your response exactly as:

## Goal
What the user is trying to accomplish.

## Constraints
Important requirements, preferences, or limitations from the user.

## Progress
### Done
Completed items.
### In Progress
Current work.
### Blocked
Items that are stuck.

## Key Decisions
Important choices made.

## Next Steps
What needs to happen next.

## Critical Context
Information that must not be lost (file paths, variable names, error states, etc).

Conversation to summarize:`;

const UPDATE_SUMMARY_PROMPT = `Update the following compaction summary with new information from the conversation below. Preserve all existing information and add new progress. Update the status of in-progress and blocked items as appropriate.

Current summary:
`;

function extractFileOps(messages: AgentMessage[]): { readFiles: string[]; modifiedFiles: string[] } {
	const readFiles = new Set<string>();
	const modifiedFiles = new Set<string>();

	for (const msg of messages) {
		if (msg.role !== "assistant") continue;
		const content = typeof msg.content === "string" ? msg.content : Array.isArray(msg.content) ? msg.content : [];
		if (!Array.isArray(content)) continue;

		for (const block of content) {
			if (typeof block !== "object" || block.type !== "toolCall") continue;
			const tc = block as { name?: string; arguments?: Record<string, unknown> };
			const args = tc.arguments ?? {};
			const path =
				typeof args.path === "string" ? args.path : typeof args.filePath === "string" ? args.filePath : undefined;

			switch (tc.name) {
				case "read_file":
				case "grep":
				case "glob":
					if (path) readFiles.add(path);
					break;
				case "write_file":
				case "edit_file":
					if (path) modifiedFiles.add(path);
					break;
			}
		}
	}

	return { readFiles: [...readFiles], modifiedFiles: [...modifiedFiles] };
}

function formatMessagesForSummary(messages: AgentMessage[]): string {
	const lines: string[] = [];
	for (const msg of messages) {
		const role = msg.role;
		let content: string;
		if (typeof msg.content === "string") {
			content = msg.content;
		} else if (Array.isArray(msg.content)) {
			content = (msg.content as Array<{ type: string; text?: string; content?: string }>)
				.filter((c) => c.type === "text" || c.type === "thinking")
				.map((c) => c.text ?? c.content ?? "")
				.join("\n");
		} else {
			content = JSON.stringify(msg.content);
		}
		const truncated = content.length > 500 ? `${content.slice(0, 497)}...` : content;
		lines.push(`[${role}]: ${truncated}`);
	}
	return lines.join("\n\n");
}

function buildSummaryPrompt(messagesToSummarize: AgentMessage[], previousSummary?: string): string {
	const conversation = formatMessagesForSummary(messagesToSummarize);

	if (previousSummary) {
		return `${UPDATE_SUMMARY_PROMPT}${previousSummary}\n\nNew conversation segment:\n${conversation}`;
	}
	return `${INITIAL_SUMMARY_PROMPT}\n${conversation}`;
}

async function generateSummary(
	messagesToSummarize: AgentMessage[],
	model: Model<string>,
	previousSummary?: string,
): Promise<string> {
	const prompt = buildSummaryPrompt(messagesToSummarize, previousSummary);

	let summary = "";
	try {
		const context: import("@moikapy/kapy-ai").Context = {
			messages: [{ role: "user", content: prompt, timestamp: Date.now() }],
		};
		const stream = streamSimple(model, context, { signal: AbortSignal.timeout(30000) });

		for await (const event of stream) {
			if (event.type === "text_delta") {
				summary += event.delta;
			}
			if (event.type === "error") break;
		}
	} catch {
		summary = `[Compaction summary generation failed. ${messagesToSummarize.length} messages were compacted.]`;
	}

	return summary || `[Context compacted. ${messagesToSummarize.length} messages summarized.]`;
}

export interface CompactOptions {
	messages: AgentMessage[];
	model: Model<string>;
	contextTracker: ContextTracker;
	sessions?: SessionManager;
	customInstructions?: string;
	previousSummary?: string;
}

export async function compact(options: CompactOptions): Promise<CompactionResult> {
	const { messages, model, contextTracker, sessions, customInstructions, previousSummary } = options;

	const tokensBefore = estimateContextTokens(messages);
	const { cutIndex } = contextTracker.findCutPoint(messages);

	if (cutIndex === 0) {
		return { summary: "", firstKeptEntryId: "", tokensBefore, cutIndex: 0 };
	}

	const messagesToSummarize = messages.slice(0, cutIndex);
	const pruned = contextTracker.pruneToolOutputs(messagesToSummarize);

	let summary = await generateSummary(pruned, model, previousSummary);

	if (customInstructions) {
		summary += `\n\nUser instructions: ${customInstructions}`;
	}

	const { readFiles, modifiedFiles } = extractFileOps(messagesToSummarize);
	if (readFiles.length > 0 || modifiedFiles.length > 0) {
		summary += `\n\n<read-files>\n${readFiles.join("\n")}\n</read-files>`;
		summary += `\n\n<modified-files>\n${modifiedFiles.join("\n")}\n</modified-files>`;
	}

	const firstKeptMsg = messages[cutIndex];
	const firstKeptEntryId = firstKeptMsg ? ((firstKeptMsg as { id?: string }).id ?? "") : "";

	if (sessions?.isPersisted()) {
		sessions.appendCompaction(summary, firstKeptEntryId, tokensBefore, {
			readFiles,
			modifiedFiles,
		});
	}

	return { summary, firstKeptEntryId, tokensBefore, cutIndex };
}
