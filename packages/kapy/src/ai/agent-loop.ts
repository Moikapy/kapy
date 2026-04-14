/**
 * AgentLoop — the core LLM ↔ tool execution cycle.
 *
 * Wires together:
 * - KapyAgent (state, events, steering/followUp)
 * - ProviderRegistry (model lookup)
 * - ToolRegistry (tool execution)
 * - PermissionEvaluator (tool access control)
 *
 * This is the actual "prompt → LLM → tool calls → results → LLM" loop
 * that makes kapy an agent (not just a CLI).
 */

import type { KapyAgent } from "./agent/agent.js";
import type { ToolRegistry } from "../tool/registry.js";
import type { ProviderRegistry } from "./provider/registry.js";
import type { PermissionEvaluator } from "./permission/evaluator.js";
import type { ProviderAdapter, ChatMessage } from "./provider/types.js";
import type { AgentMessage, AgentEvent } from "./agent/types.js";
import { zodToJsonSchema } from "../tool/zod-to-json-schema.js";

export class AgentLoop {
	private agent: KapyAgent;
	private tools: ToolRegistry;
	private providers: ProviderRegistry;
	private permissions: PermissionEvaluator;
	private adapters = new Map<string, ProviderAdapter>();
	private maxToolRounds = 20;
	private contextTransformer: ((messages: AgentMessage[]) => Promise<AgentMessage[]>) | null = null;

	constructor(
		agent: KapyAgent,
		tools: ToolRegistry,
		providers: ProviderRegistry,
		permissions: PermissionEvaluator,
	) {
		this.agent = agent;
		this.tools = tools;
		this.providers = providers;
		this.permissions = permissions;
	}

	/** Register a provider adapter for a given provider ID */
	setProviderAdapter(providerId: string, adapter: ProviderAdapter): void {
		this.adapters.set(providerId, adapter);
	}

	/** Set a context transformer (pi pattern: transformContext) */
	setContextTransformer(fn: (messages: AgentMessage[]) => Promise<AgentMessage[]>): void {
		this.contextTransformer = fn;
	}

	/** Set max tool rounds (prevents infinite loops) */
	setMaxToolRounds(max: number): void {
		this.maxToolRounds = max;
	}

	/** Send a prompt to the agent and run the full loop */
	async prompt(input: string): Promise<void> {
		const model = this.agent.state.model;
		if (!model) {
			throw new Error("No model set. Use agent.setModel() before prompting.");
		}

		// Add user message
		const userMessage: AgentMessage = {
			role: "user",
			content: input,
			timestamp: Date.now(),
		};
		this.agent.appendMessage(userMessage);

		// Get provider adapter
		const adapter = this.adapters.get(model.provider);
		if (!adapter) {
			throw new Error(`No adapter for provider "${model.provider}". Use setProviderAdapter() to register one.`);
		}

		// Run agent loop
		this.agent["_state"].isStreaming = true;
		this.emit({ type: "agent_start" });

		try {
			await this.runLoop(adapter);
		} finally {
			this.agent["_state"].isStreaming = false;
			this.emit({ type: "agent_end", messages: this.agent.state.messages });
		}
	}

	/** Continue from current context (for retries) */
	async continue(): Promise<void> {
		const model = this.agent.state.model;
		if (!model) {
			throw new Error("No model set. Use agent.setModel() before continuing.");
		}

		const adapter = this.adapters.get(model.provider);
		if (!adapter) {
			throw new Error(`No adapter for provider "${model.provider}".`);
		}

		this.agent["_state"].isStreaming = true;
		this.emit({ type: "agent_start" });

		try {
			await this.runLoop(adapter);
		} finally {
			this.agent["_state"].isStreaming = false;
			this.emit({ type: "agent_end", messages: this.agent.state.messages });
		}
	}

	/** Core loop: send messages to LLM, handle tool calls, repeat */
	private async runLoop(adapter: ProviderAdapter): Promise<void> {
		let toolRounds = 0;

		while (toolRounds < this.maxToolRounds) {
			const chatMessages = await this.buildChatMessages();
			const model = this.agent.state.model!;

			this.emit({ type: "turn_start" });

			// Stream from provider
			let assistantContent = "";
			const toolCalls: Array<{ id: string; name: string; args: string }> = [];
			const abortController = new AbortController();
			this.agent["abortController"] = abortController;

			this.emit({
				type: "message_start",
				message: { role: "assistant", content: "", timestamp: Date.now() },
			});

			try {
				for await (const chunk of adapter.streamChat({
					model: model.id,
					messages: chatMessages,
					signal: abortController.signal,
					tools: this.buildToolSchemas(),
				})) {
					if (abortController.signal.aborted) break;

					if (chunk.type === "text" && chunk.text) {
						assistantContent += chunk.text;
						this.emit({
							type: "message_update",
							message: { role: "assistant", content: assistantContent, timestamp: Date.now() },
						});
					}

					if (chunk.type === "reasoning" && chunk.text) {
						this.emit({
							type: "reasoning_update",
							text: chunk.text,
						});
					}

					if (chunk.type === "tool_call" && chunk.toolCallId && chunk.toolName) {
						toolCalls.push({
							id: chunk.toolCallId,
							name: chunk.toolName,
							args: chunk.toolArgs ?? "{}",
						});
					}

					if (chunk.type === "done") {
						break;
					}
				}
			} catch (err) {
				if (abortController.signal.aborted) {
					this.agent["_state"].isStreaming = false;
					break;
				}
				throw err;
			}

			// Add assistant message
			const assistantMessage: AgentMessage = {
				role: "assistant",
				content: assistantContent,
				toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
				timestamp: Date.now(),
			};
			this.agent.appendMessage(assistantMessage);
			this.emit({ type: "message_end", message: assistantMessage });

			// No tool calls — we're done
			if (toolCalls.length === 0) {
				this.emit({
					type: "turn_end",
					message: assistantMessage,
					toolResults: [],
				});
				break;
			}

			// Process tool calls
			const toolResults: AgentMessage[] = [];
			for (const tc of toolCalls) {
				const tool = this.tools.get(tc.name);
				if (!tool) {
					toolResults.push({
						role: "tool",
						content: `Tool "${tc.name}" not found`,
						timestamp: Date.now(),
					});
					continue;
				}

				// Check permissions using (toolName, inputPattern)
				let inputStr: string;
				try {
					inputStr = JSON.stringify(JSON.parse(tc.args));
				} catch {
					inputStr = tc.args;
				}

				const permAction = this.permissions.evaluate(tc.name, inputStr);

				if (permAction === "deny") {
					toolResults.push({
						role: "tool",
						content: "Permission denied: Tool not allowed",
						timestamp: Date.now(),
					});
					continue;
				}

				// "ask" in non-interactive mode = deny
				if (permAction === "ask" && !process.stdout.isTTY) {
					toolResults.push({
						role: "tool",
						content: "Permission denied: Cannot prompt for permission in non-interactive mode",
						timestamp: Date.now(),
					});
					continue;
				}

				// Execute tool
				try {
					const parsedArgs = JSON.parse(tc.args);
					const result = await tool.execute(
						tc.id,
						parsedArgs,
						abortController.signal,
						() => {},
						{ cwd: process.cwd(), signal: abortController.signal },
					);

					const content = typeof result === "string"
						? result
						: (result as any)?.output ?? JSON.stringify(result);

					toolResults.push({
						role: "tool",
						content,
						timestamp: Date.now(),
					});
				} catch (err) {
					toolResults.push({
						role: "tool",
						content: `Tool error: ${err instanceof Error ? err.message : String(err)}`,
						timestamp: Date.now(),
					});
				}
			}

			// Add tool results
			for (const tr of toolResults) {
				this.agent.appendMessage(tr);
			}

			this.emit({
				type: "turn_end",
				message: assistantMessage,
				toolResults,
			});

			toolRounds++;

			// Check for steering messages
			const steering = this.agent["steeringQueue"] as AgentMessage[];
			if (steering.length > 0) {
				const steerMsg = steering.shift()!;
				this.agent.appendMessage(steerMsg);
			}
		}
	}

	/** Build ChatMessage[] for the provider */
	private async buildChatMessages(): Promise<ChatMessage[]> {
		let messages = [...this.agent.state.messages];

		if (this.contextTransformer) {
			messages = await this.contextTransformer(messages);
		}

		const chatMessages: ChatMessage[] = [];

		if (this.agent.state.systemPrompt) {
			chatMessages.push({
				role: "system",
				content: this.agent.state.systemPrompt,
			});
		}

		for (const msg of messages) {
			chatMessages.push({
				role: msg.role === "toolResult" ? "tool" : msg.role,
				content: msg.content,
			});
		}

		return chatMessages;
	}

	/** Build tool schemas for the LLM (OpenAI function calling format) */
	private buildToolSchemas(): unknown[] {
		const allTools = this.tools.all();
		if (allTools.length === 0) return [];

		return allTools.map((tool) => ({
			type: "function" as const,
			function: {
				name: tool.name,
				description: tool.description,
				parameters: tool.parameters ? zodToJsonSchema(tool.parameters) : { type: "object", properties: {} },
			},
		}));
	}

	/** Emit event through agent */
	private emit(event: AgentEvent): void {
		this.agent["emit"](event);
	}
}