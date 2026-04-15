/**
 * Build script for kapy-components.
 *
 * Uses the OpenTUI Solid transform plugin so Bun can handle .tsx files
 * with Solid JSX (not React JSX).
 */
import solidPlugin from "@opentui/solid/bun-plugin";

const result = await Bun.build({
	entrypoints: ["src/index.ts"],
	outdir: "dist",
	target: "bun",
	plugins: [solidPlugin],
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