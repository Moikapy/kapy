type EventHandler = (data?: unknown) => Promise<void> | void;

export class ExtensionEmitter {
	private handlers = new Map<string, Set<EventHandler>>();

	/** Emit a custom event with data */
	async emit(event: string, data?: unknown): Promise<void> {
		const handlers = this.handlers.get(event);
		if (!handlers) return;
		for (const handler of handlers) {
			await handler(data);
		}
	}

	/** Listen for a custom event */
	on(event: string, handler: EventHandler): void {
		if (!this.handlers.has(event)) {
			this.handlers.set(event, new Set());
		}
		this.handlers.get(event)?.add(handler);
	}

	/** Remove a handler */
	off(event: string, handler: EventHandler): void {
		this.handlers.get(event)?.delete(handler);
	}
}
