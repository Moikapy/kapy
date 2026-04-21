/**
 * Command context — the primary interface for command handlers.
 *
 * Every command handler receives a `ctx` object with parsed args,
 * merged config, logging utilities, and interaction helpers.
 */

import { createInterface } from "node:readline";
import { spawn as bunSpawn } from "bun";
import pc from "picocolors";

/** Options for ctx.spawn() */
export interface SpawnOptions {
	/** Pass through TTY — critical for tmux attach, interactive shells */
	tty?: boolean;
	/** Stream output in real-time (default: collect) */
	stream?: boolean;
	/** Environment variables to merge with process.env */
	env?: Record<string, string>;
	/** Working directory */
	cwd?: string;
	/** Auto-kill the process on ctx.abort() */
	abortOnError?: boolean;
	/** Suppress stdout/stderr output in --json mode */
	suppressOutput?: boolean;
}

/** Result of ctx.spawn() */
export interface SpawnResult {
	/** Process exit code */
	exitCode: number;
	/** Captured stdout */
	stdout: string;
	/** Captured stderr */
	stderr: string;
	/** Whether the process was killed by ctx.abort() */
	aborted: boolean;
}

/** Teardown callback — sync or async */
export type TeardownCallback = () => void | Promise<void>;

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
	private _userExitCode: number | null = null;
	private _abortExitCode: number = 0;
	private _spinner: Spinner | null = null;
	private _teardownCallbacks: TeardownCallback[] = [];
	private _abortController: AbortController | null = null;

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

	/** Whether this is an interactive terminal session */
	get isInteractive(): boolean {
		return !this.noInput && !this.json && !!process.stdout.isTTY;
	}

	/** Get the effective exit code. User-set takes priority, then abort code, then 0. */
	get exitCode(): number {
		return this._userExitCode ?? this._abortExitCode;
	}
	/** Set the process exit code explicitly. Overrides abort code. */
	set exitCode(code: number) {
		this._userExitCode = code;
	}

	/** Cancel execution with optional exit code */
	abort(code = 10): never {
		this.aborted = true;
		this._abortExitCode = code;
		this._abortController?.abort();
		throw new AbortError(code);
	}

	/** Register a cleanup callback (runs in LIFO order after command) */
	teardown(fn: TeardownCallback): void {
		this._teardownCallbacks.push(fn);
	}

	/** Run all registered teardown callbacks (LIFO order). Called internally after command execution. */
	async runTeardowns(): Promise<void> {
		const callbacks = [...this._teardownCallbacks].reverse();
		for (const fn of callbacks) {
			try {
				await fn();
			} catch (err) {
				console.warn("[kapy] teardown error:", err);
			}
		}
		this._teardownCallbacks = [];
	}

	/** Spawn a subprocess with TTY awareness, abort integration, and output control */
	async spawn(cmd: string[], options?: SpawnOptions): Promise<SpawnResult> {
		const opts = options ?? {};
		const env = { ...process.env, ...(opts.env ?? {}) } as Record<string, string>;

		// Set up abort controller for this spawn
		const abortController = new AbortController();
		this._abortController = abortController;

		const proc = bunSpawn(cmd, {
			cwd: opts.cwd,
			env,
			stdout: opts.tty ? "inherit" : "pipe",
			stderr: opts.tty ? "inherit" : "pipe",
			stdin: opts.tty ? "inherit" : "pipe",
		});

		// Register teardown to kill process on abort
		if (opts.abortOnError) {
			this.teardown(() => {
				try {
					proc.kill();
				} catch {
					// Process may have already exited
				}
			});

			// Also watch for abort signal
			abortController.signal.addEventListener(
				"abort",
				() => {
					try {
						proc.kill();
					} catch {
						// Process may have already exited
					}
				},
				{ once: true },
			);
		}

		// Read stdout/stderr as streams (Bun returns ReadableStream)
		const stdoutPromise = opts.tty ? Promise.resolve("") : new Response(proc.stdout).text();
		const stderrPromise = opts.tty ? Promise.resolve("") : new Response(proc.stderr).text();

		const exitCode = await proc.exited;

		let stdout = "";
		let stderr = "";

		if (!opts.tty) {
			try {
				stdout = await stdoutPromise;
			} catch {}
			try {
				stderr = await stderrPromise;
			} catch {}
		}

		// Stream output to terminal if requested (and not in json mode)
		if (opts.stream && !this.json && !opts.suppressOutput && !opts.tty) {
			if (stdout) process.stdout.write(stdout);
			if (stderr) process.stderr.write(stderr);
		}

		return {
			exitCode,
			stdout,
			stderr,
			aborted: abortController.signal.aborted,
		};
	}

	/** Update duration (called internally) */
	_tick(): void {
		this.duration = Date.now() - this._startTime;
	}

	/** Emit a structured event. In --json mode, writes NDJSON to stdout. */
	emit(event: string, data?: unknown): void {
		if (this.json) {
			process.stdout.write(`${JSON.stringify({ type: "event", event, data })}\n`);
		}
		// In non-json mode, events are consumed by the TUI (future: update message component)
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
