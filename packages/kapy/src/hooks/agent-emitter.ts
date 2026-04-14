/**
 * Agent event emitter — pi-aligned event system.
 *
 * Unlike ExtensionEmitter (which only supports void handlers),
 * AgentEventEmitter collects return values from handlers.
 * This enables:
 * - tool_call: return { block: true, reason } to block
 * - tool_result: return { content, isError } to modify result
 * - session events: return { cancel: true } to cancel
 * - input: return { action: "transform"|"handled"|"continue", text? }
 *
 * Handlers run in registration order. Later handlers see mutations
 * from earlier handlers (same as pi's pattern).
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AgentEventHandler = (event: any) => Promise<any | undefined> | any | undefined;

export class AgentEventEmitter {
	private handlers = new Map<string, AgentEventHandler[]>();

	/**
	 * Emit an event, collecting handler results.
	 * Handlers run sequentially in registration order.
	 * Mutations to the event object are visible to subsequent handlers.
	 */
	async emit(event: string, data: unknown): Promise<unknown[]> {
		const eventHandlers = this.handlers.get(event);
		if (!eventHandlers || eventHandlers.length === 0) return [];

		const results: unknown[] = [];
		for (const handler of eventHandlers) {
			const result = await handler(data);
			results.push(result);
		}
		return results;
	}

	/** Register a handler for an event */
	on(event: string, handler: AgentEventHandler): void {
		if (!this.handlers.has(event)) {
			this.handlers.set(event, []);
		}
		this.handlers.get(event)?.push(handler);
	}

	/** Remove a handler */
	off(event: string, handler: AgentEventHandler): void {
		const list = this.handlers.get(event);
		if (list) {
			const idx = list.indexOf(handler);
			if (idx !== -1) list.splice(idx, 1);
		}
	}

	/** Check if any handlers are registered for an event */
	has(event: string): boolean {
		const list = this.handlers.get(event);
		return !!list && list.length > 0;
	}

	/** Remove all handlers for an event */
	removeAll(event: string): void {
		this.handlers.delete(event);
	}
}
