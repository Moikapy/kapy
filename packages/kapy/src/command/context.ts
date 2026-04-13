/**
 * Command context — the primary interface for command handlers.
 *
 * Every command handler receives a `ctx` object with parsed args,
 * merged config, logging utilities, and interaction helpers.
 */

import { createInterface } from "node:readline";
import pc from "picocolors";

/** Command context passed to every handler */
export class CommandContext {
	/** Parsed arguments and flags (including `rest` for positional args) */
	args: Record<string, unknown>;

	/** Merged configuration (all sources, namespaced) */
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
	private _spinner: Spinner | null = null;

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

	/** Styled success output */
	log(msg: string): void {
		if (this.json) return;
		console.log(pc.green(msg));
	}

	/** Styled warning output */
	warn(msg: string): void {
		if (this.json) return;
		console.warn(pc.yellow(msg));
	}

	/** Styled error output */
	error(msg: string): void {
		console.error(pc.red(msg));
	}

	/** Returns a progress spinner instance */
	spinner(text: string): Spinner {
		const s = new Spinner(text, this.json);
		this._spinner = s;
		return s;
	}

	/** Interactive prompt — reads from stdin */
	async prompt(msg: string): Promise<string> {
		if (this.noInput) {
			throw new Error(`Prompt blocked by --no-input: ${msg}`);
		}

		process.stdout.write(pc.cyan(`${msg}: `));

		return new Promise<string>((resolve) => {
			const rl = createInterface({
				input: process.stdin,
				output: process.stdout,
			});
			rl.question("", (answer: string) => {
				rl.close();
				resolve(answer.trim());
			});
		});
	}

	/** Confirm prompt — yes/no */
	async confirm(msg: string, defaultYes = true): Promise<boolean> {
		const hint = defaultYes ? "[Y/n]" : "[y/N]";
		const answer = await this.prompt(`${msg} ${hint}`);
		if (!answer) return defaultYes;
		return answer.toLowerCase().startsWith("y");
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

/** Spinner with actual terminal output */
export class Spinner {
	private _text: string;
	private _interval: ReturnType<typeof setInterval> | null = null;
	private _frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
	private _frame = 0;
	private _silent: boolean;

	constructor(text: string, silent = false) {
		this._text = text;
		this._silent = silent;
	}

	get text(): string {
		return this._text;
	}

	start(): this {
		if (this._silent || !process.stdout.isTTY) return this;
		this._interval = setInterval(() => {
			const frame = this._frames[this._frame % this._frames.length];
			process.stdout.write(`\r${frame} ${this._text}`);
			this._frame++;
		}, 80);
		return this;
	}

	stop(): this {
		if (this._interval) {
			clearInterval(this._interval);
			this._interval = null;
			if (process.stdout.isTTY) process.stdout.write("\r\x1b[K");
		}
		return this;
	}

	update(text: string): this {
		this._text = text;
		return this;
	}

	succeed(msg?: string): this {
		this.stop();
		if (!this._silent) {
			console.log(pc.green(`✓ ${msg ?? this._text}`));
		}
		return this;
	}

	fail(msg?: string): this {
		this.stop();
		if (!this._silent) {
			console.error(pc.red(`✗ ${msg ?? this._text}`));
		}
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
