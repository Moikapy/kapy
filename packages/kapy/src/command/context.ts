/**
 * Command context — the primary interface for command handlers.
 *
 * Every command handler receives a `ctx` object with parsed args,
 * merged config, logging utilities, and interaction helpers.
 */

/** Command context passed to every handler */
export class CommandContext {
	/** Parsed arguments and flags */
	args: Record<string, unknown>;

	/** Merged configuration (all sources) */
	config: Record<string, Record<string, unknown>>;

	/** The command name being executed */
	command: string;

	/** Milliseconds since command started */
	duration: number;

	/** Whether the command was aborted */
	aborted: boolean;

	/** Whether this is a JSON output mode */
	json: boolean;

	/** Whether interactive prompts are disabled */
	noInput: boolean;

	private _startTime: number;
	private _exitCode: number;

	constructor(options: {
		args?: Record<string, unknown>;
		config?: Record<string, Record<string, unknown>>;
		command?: string;
		json?: boolean;
		noInput?: boolean;
	}) {
		this.args = options.args ?? {};
		this.config = options.config ?? {};
		this.command = options.command ?? "";
		this.aborted = false;
		this.json = options.json ?? false;
		this.noInput = options.noInput ?? false;
		this._startTime = Date.now();
		this.duration = 0;
		this._exitCode = 0;
	}

	/** Styled success output (green) */
	log(msg: string): void {
		if (this.json) return; // JSON mode suppresses styled output
		console.log(msg);
	}

	/** Styled warning output (yellow) */
	warn(msg: string): void {
		if (this.json) return;
		console.warn(msg);
	}

	/** Styled error output (red) */
	error(msg: string): void {
		console.error(msg);
	}

	/** Returns a progress spinner instance */
	spinner(text: string): Spinner {
		return new Spinner(text);
	}

	/** Interactive prompt — returns user input */
	async prompt(msg: string): Promise<string> {
		if (this.noInput) {
			throw new Error(`Prompt blocked by --no-input: ${msg}`);
		}
		// TODO: implement interactive prompt via kapy-components
		return "";
	}

	/** Cancel execution with optional exit code */
	abort(code = 10): never {
		this.aborted = true;
		this._exitCode = code;
		throw new AbortError(code);
	}

	/** Update duration (called internally) */
	_tick(): void {
		this.duration = Date.now() - this._startTime;
	}
}

/** Spinner placeholder — will be replaced by kapy-components integration */
export class Spinner {
	constructor(private text: string) {}
	start(): this {
		return this;
	}
	stop(): this {
		return this;
	}
	update(text: string): this {
		this.text = text;
		return this;
	}
	succeed(msg?: string): this {
		return this;
	}
	fail(msg?: string): this {
		return this;
	}
}

/** Abort error thrown by ctx.abort() */
export class AbortError extends Error {
	constructor(public readonly exitCode: number) {
		super(`Command aborted with exit code ${exitCode}`);
		this.name = "AbortError";
	}
}