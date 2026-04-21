/**
 * Build script for kapy.
 *
 * Uses the OpenTUI Solid transform plugin so Bun can handle .tsx files
 * with Solid JSX (not React JSX).
 */
import solidPlugin from "@opentui/solid/bun-plugin";

const entrypoints = ["src/index.ts", "src/cli.ts"];

const result = await Bun.build({
	entrypoints,
	outdir: "dist",
	target: "bun",
	plugins: [solidPlugin],
	external: ["@opentui/core", "@opentui/solid", "solid-js", "@moikapy/kapy-components"],
});

if (result.logs?.length) {
	for (const log of result.logs) {
		if (log.level === "error") {
			console.error("Build error:", log);
			process.exit(1);
		}
	}
}

console.log(`Built ${result.outputs.length} outputs:`);
for (const output of result.outputs) {
	console.log(`  ${output.path} (${(output.size / 1024).toFixed(1)} KB)`);
}
