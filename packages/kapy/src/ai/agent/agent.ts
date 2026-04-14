import type {
	AgentEvent,
	AgentMessage,
	AgentState,
	FollowUpMode,
	ModelRef,
	SteeringMode,
	ThinkingLevel,
} from "./types.js";

/**
 * KapyAgent — pi-aligned agent class.
 *
 * Manages conversation state, steering/followUp queues,
 * thinking levels, and event subscriptions.
 * The actual agent loop (LLM calls + tool execution) is separate.
 */
export class KapyAgent {
	private _state: AgentState;
	private listeners = new Set<(e: AgentEvent) => void>();
	private abortController: AbortController | null = null;
	private steeringQueue: AgentMessage[] = [];
	private followUpQueue: AgentMessage[] = [];
	private _steeringMode: SteeringMode = "all";
	private _followUpMode: FollowUpMode = "all";

	constructor(options?: { initialState?: Partial<AgentState> }) {
		this._state = {
			systemPrompt: "",
			model: null,
			thinkingLevel: "off",
			messages: [],
			isStreaming: false,
			pendingToolCalls: new Set(),
			...options?.initialState,
		};
	}

	/** Get current agent state */
	get state(): AgentState {
		return this._state;
	}

	/** Subscribe to agent events. Returns unsubscribe function. */
	subscribe(fn: (e: AgentEvent) => void): () => void {
		this.listeners.add(fn);
		return () => this.listeners.delete(fn);
	}

	/** Emit an event to all subscribers */
	private emit(event: AgentEvent): void {
		for (const fn of this.listeners) {
			fn(event);
		}
	}

	/** Set the system prompt */
	setSystemPrompt(prompt: string): void {
		this._state.systemPrompt = prompt;
	}

	/** Set the active model */
	setModel(model: ModelRef): void {
		this._state.model = model;
	}

	/** Set thinking level (pi pattern) */
	setThinkingLevel(level: ThinkingLevel): void {
		this._state.thinkingLevel = level;
	}

	/** Set steering mode (pi pattern) */
	setSteeringMode(mode: SteeringMode): void {
		this._steeringMode = mode;
	}

	/** Get steering mode */
	getSteeringMode(): SteeringMode {
		return this._steeringMode;
	}

	/** Set follow-up mode (pi pattern) */
	setFollowUpMode(mode: FollowUpMode): void {
		this._followUpMode = mode;
	}

	/** Get follow-up mode */
	getFollowUpMode(): FollowUpMode {
		return this._followUpMode;
	}

	/** Append a message to the conversation */
	appendMessage(message: AgentMessage): void {
		this._state.messages.push(message);
	}

	/** Replace all messages */
	replaceMessages(messages: AgentMessage[]): void {
		this._state.messages = messages;
	}

	/** Queue a steering message to interrupt mid-run (pi pattern) */
	steer(message: AgentMessage): void {
		this.steeringQueue.push(message);
	}

	/** Queue a follow-up message for after agent finishes (pi pattern) */
	followUp(message: AgentMessage): void {
		this.followUpQueue.push(message);
	}

	/** Clear steering queue */
	clearSteeringQueue(): void {
		this.steeringQueue = [];
	}

	/** Clear follow-up queue */
	clearFollowUpQueue(): void {
		this.followUpQueue = [];
	}

	/** Clear both queues */
	clearAllQueues(): void {
		this.steeringQueue = [];
		this.followUpQueue = [];
	}

	/** Whether any messages are queued */
	hasQueuedMessages(): boolean {
		return this.steeringQueue.length > 0 || this.followUpQueue.length > 0;
	}

	/** Clear all messages */
	clearMessages(): void {
		this._state.messages = [];
	}

	/** Abort current operation */
	abort(): void {
		this.abortController?.abort();
		this._state.error = "Aborted";
		this._state.isStreaming = false;
		this.emit({ type: "error", error: "Aborted" });
	}

	/** Wait for agent to finish */
	async waitForIdle(): Promise<void> {
		// Poll until not streaming
		while (this._state.isStreaming) {
			await new Promise((r) => setTimeout(r, 50));
		}
	}

	/** Reset agent state completely */
	reset(): void {
		this._state = {
			systemPrompt: "",
			model: null,
			thinkingLevel: "off",
			messages: [],
			isStreaming: false,
			pendingToolCalls: new Set(),
		};
		this.steeringQueue = [];
		this.followUpQueue = [];
	}
}
