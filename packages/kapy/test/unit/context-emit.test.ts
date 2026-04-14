import { describe, expect, mock, test } from "bun:test";
import { CommandContext } from "../../src/command/context.js";

describe("ctx.emit", () => {
	test("emits NDJSON line in --json mode", async () => {
		const logs: string[] = [];
		const origWrite = process.stdout.write.bind(process.stdout);
		const mockWrite = mock((data: string) => {
			logs.push(data);
			return true;
		});
		Object.defineProperty(process.stdout, "write", { value: mockWrite, configurable: true });

		try {
			const ctx = new CommandContext({ json: true });
			ctx.emit("progress", { step: "downloading", percent: 40 });

			expect(logs.length).toBeGreaterThanOrEqual(1);
			// Find the NDJSON line
			const line = logs.find((l) => l.includes('"event":"progress"'));
			expect(line).toBeDefined();
			const parsed = JSON.parse(line!);
			expect(parsed).toEqual({
				type: "event",
				event: "progress",
				data: { step: "downloading", percent: 40 },
			});
		} finally {
			Object.defineProperty(process.stdout, "write", { value: origWrite, configurable: true });
		}
	});

	test("does not emit NDJSON in non-json mode", () => {
		const logs: string[] = [];
		const origWrite = process.stdout.write.bind(process.stdout);
		const mockWrite = mock((data: string) => {
			logs.push(data);
			return true;
		});
		Object.defineProperty(process.stdout, "write", { value: mockWrite, configurable: true });

		try {
			const ctx = new CommandContext({ json: false });
			ctx.emit("progress", { step: "downloading", percent: 40 });
			// Should not write to stdout in non-json mode
			const ndjsonLine = logs.find((l) => l.includes('"event":"progress"'));
			expect(ndjsonLine).toBeUndefined();
		} finally {
			Object.defineProperty(process.stdout, "write", { value: origWrite, configurable: true });
		}
	});

	test("emits multiple events as separate NDJSON lines", () => {
		const logs: string[] = [];
		const origWrite = process.stdout.write.bind(process.stdout);
		const mockWrite = mock((data: string) => {
			logs.push(data);
			return true;
		});
		Object.defineProperty(process.stdout, "write", { value: mockWrite, configurable: true });

		try {
			const ctx = new CommandContext({ json: true });
			ctx.emit("log", { level: "info", message: "started" });
			ctx.emit("log", { level: "info", message: "done" });

			const eventLines = logs.filter((l) => l.includes('"type":"event"'));
			expect(eventLines.length).toBe(2);
		} finally {
			Object.defineProperty(process.stdout, "write", { value: origWrite, configurable: true });
		}
	});
});
