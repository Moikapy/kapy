/**
 * Telemetry — opt-in, anonymized bug/perf tracking for kapy.
 *
 * Principles:
 * - Opt-in ONLY. Default is off. User must explicitly enable.
 * - No message content. No file paths. No personal data.
 * - Only tracks: error types, tool names, model used, response times, session counts.
 * - Anonymous device ID (random UUID, stored locally).
 * - Configurable endpoint. Default: kapy telemetry endpoint.
 *
 * Events tracked:
 * - session_start: model, thinking_level
 * - session_end: duration, message_count
 * - error: error_type, error_message (truncated, no stack content)
 * - tool_call: tool_name, duration_ms, success
 * - model_response: model, duration_ms, token_count, stop_reason
 * - command: command_name (slash commands only)
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { KAPY_HOME } from "../config/defaults.js";
import type { GlobalConfig } from "../config/schema.js";

// ── Config ──────────────────────────────────────────────────────────

const TELEMETRY_ENDPOINT = "https://telemetry.moikapy.dev/v1/events";
const DEVICE_ID_FILE = join(KAPY_HOME, ".telemetry-id");
const FLUSH_INTERVAL_MS = 30_000; // Flush every 30s
const MAX_QUEUE_SIZE = 50;
const EVENT_TIMEOUT_MS = 5_000;

// ── Types ───────────────────────────────────────────────────────────

export interface TelemetryEvent {
	event: string;
	properties: Record<string, unknown>;
	timestamp: string;
}

interface TelemetryConfig {
	enabled: boolean;
	endpoint?: string;
}

// ── Device ID ───────────────────────────────────────────────────────

function getOrCreateDeviceId(): string {
	try {
		if (existsSync(DEVICE_ID_FILE)) {
			return readFileSync(DEVICE_ID_FILE, "utf-8").trim();
		}
	} catch {}

	const id = crypto.randomUUID();
	try {
		writeFileSync(DEVICE_ID_FILE, id, "utf-8");
	} catch {}
	return id;
}

// ── Load config ─────────────────────────────────────────────────────

function loadTelemetryConfig(): TelemetryConfig {
	try {
		const configPath = join(KAPY_HOME, "config.json");
		if (!existsSync(configPath)) return { enabled: false };
		const raw = readFileSync(configPath, "utf-8");
		const config: GlobalConfig = JSON.parse(raw);
		const tel = config.telemetry;
		if (typeof tel === "boolean") return { enabled: tel };
		if (typeof tel === "object" && tel !== null) {
			return {
				enabled: (tel as any).enabled ?? false,
				endpoint: (tel as any).endpoint,
			};
		}
	} catch {}
	return { enabled: false };
}

// ── Telemetry Client ────────────────────────────────────────────────

class TelemetryClient {
	private enabled = false;
	private endpoint = TELEMETRY_ENDPOINT;
	private deviceId = "";
	private queue: TelemetryEvent[] = [];
	private flushTimer: ReturnType<typeof setInterval> | undefined;
	private flushing = false;

	/** Initialize telemetry — call once at startup */
	init(): void {
		const config = loadTelemetryConfig();
		this.enabled = config.enabled;
		if (!this.enabled) return;

		this.deviceId = getOrCreateDeviceId();
		this.endpoint = config.endpoint ?? TELEMETRY_ENDPOINT;

		// Periodic flush
		this.flushTimer = setInterval(() => this.flush(), FLUSH_INTERVAL_MS);
		// Don't keep process alive for flush timer
		if (this.flushTimer.unref) this.flushTimer.unref();
	}

	/** Check if telemetry is enabled */
	isEnabled(): boolean {
		return this.enabled;
	}

	/** Enable telemetry and persist to config */
	async enable(): Promise<void> {
		this.enabled = true;
		await persistTelemetryConfig(true);
		if (!this.deviceId) {
			this.deviceId = getOrCreateDeviceId();
			if (!this.flushTimer) {
				this.flushTimer = setInterval(() => this.flush(), FLUSH_INTERVAL_MS);
				if (this.flushTimer.unref) this.flushTimer.unref();
			}
		}
	}

	/** Disable telemetry and persist to config */
	async disable(): Promise<void> {
		this.enabled = false;
		await persistTelemetryConfig(false);
		if (this.flushTimer) clearInterval(this.flushTimer);
		this.queue = []; // Drop queued events
	}

	/** Track an event */
	track(event: string, properties: Record<string, unknown> = {}): void {
		if (!this.enabled) return;

		// Sanitize: no strings longer than 200 chars
		const sanitized: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(properties)) {
			if (typeof value === "string" && value.length > 200) {
				sanitized[key] = `${value.slice(0, 197)}...`;
			} else {
				sanitized[key] = value;
			}
		}

		this.queue.push({
			event,
			properties: {
				...sanitized,
				device_id: this.deviceId,
				kapy_version: (globalThis as any).__kapy_version ?? "unknown",
				runtime: typeof Bun !== "undefined" ? "bun" : "node",
				os: process.platform,
			},
			timestamp: new Date().toISOString(),
		});

		// Flush if queue is full
		if (this.queue.length >= MAX_QUEUE_SIZE) {
			this.flush();
		}
	}

	/** Flush queued events to endpoint */
	async flush(): Promise<void> {
		if (this.flushing || this.queue.length === 0) return;
		this.flushing = true;

		const batch = this.queue.splice(0);
		try {
			const controller = new AbortController();
			const timeout = setTimeout(() => controller.abort(), EVENT_TIMEOUT_MS);

			await fetch(this.endpoint, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ batch }),
				signal: controller.signal,
			});

			clearTimeout(timeout);
		} catch {
			// Telemetry failure is silent — never disrupt user workflow
			// Re-queue on failure (up to MAX_QUEUE_SIZE)
			const remaining = MAX_QUEUE_SIZE - this.queue.length;
			if (remaining > 0) {
				this.queue.unshift(...batch.slice(-remaining));
			}
		} finally {
			this.flushing = false;
		}
	}

	/** Shutdown — flush remaining events */
	async shutdown(): Promise<void> {
		if (this.flushTimer) clearInterval(this.flushTimer);
		await this.flush();
	}
}

// Singleton
export const telemetry = new TelemetryClient();

// ── Convenience track functions ─────────────────────────────────────

/** Track a session start */
export function trackSessionStart(model: string, thinkingLevel: string): void {
	telemetry.track("session_start", { model, thinking_level: thinkingLevel });
}

/** Track a session end */
export function trackSessionEnd(durationMs: number, messageCount: number): void {
	telemetry.track("session_end", { duration_ms: durationMs, message_count: messageCount });
}

/** Track an error (no stack traces, no user content) */
export function trackError(errorType: string, errorMessage: string): void {
	telemetry.track("error", {
		error_type: errorType,
		error_message: errorMessage.slice(0, 200),
	});
}

/** Track a tool call (name only, no arguments or results) */
export function trackToolCall(toolName: string, durationMs: number, success: boolean): void {
	telemetry.track("tool_call", { tool_name: toolName, duration_ms: durationMs, success });
}

/** Track a model response */
export function trackModelResponse(
	model: string,
	durationMs: number,
	inputTokens: number,
	outputTokens: number,
	stopReason: string,
): void {
	telemetry.track("model_response", {
		model,
		duration_ms: durationMs,
		input_tokens: inputTokens,
		output_tokens: outputTokens,
		stop_reason: stopReason,
	});
}

/** Track a slash command */
export function trackCommand(commandName: string): void {
	telemetry.track("command", { command_name: commandName });
}

/** Track a streaming error */
export function trackStreamError(model: string, errorType: string, errorMessage: string): void {
	telemetry.track("stream_error", {
		model,
		error_type: errorType,
		error_message: errorMessage.slice(0, 200),
	});
}

// ── Config persistence ──────────────────────────────────────────────

const CONFIG_PATH = join(KAPY_HOME, "config.json");

/** Persist telemetry enabled/disabled state to ~/.kapy/config.json */
async function persistTelemetryConfig(enabled: boolean): Promise<void> {
	try {
		let config: Record<string, unknown> = {};
		if (existsSync(CONFIG_PATH)) {
			const raw = readFileSync(CONFIG_PATH, "utf-8");
			config = JSON.parse(raw);
		}
		// Merge telemetry config
		const existing = typeof config.telemetry === "object" ? (config.telemetry as Record<string, unknown>) : {};
		config.telemetry = { ...existing, enabled };
		writeFileSync(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, "utf-8");
	} catch {
		// Silently fail — never block user interaction
	}
}
