# Changelog

All notable changes to `@moikapy/kapy` will be documented in this file.

## [0.4.0] — 2025-07-19

### Features

- **`--version` flag** — `kapy --version` or `kapy -v` prints version and exits
- **Positional arg mapping** — declared `ArgDefinition` items are now mapped by name instead of requiring `.rest[index]` access. `ctx.args.name` works directly
- **Required arg validation** — missing required args produce `_errors` with usage hint, exit code 2
- **Variadic args** — `{ name: "files", variadic: true }` captures all remaining positionals
- **Flag type coercion** — `--port=3000` returns number `3000` (not string), boolean flags also coerced from `--flag=true/false`
- **Env var type coercion** — `KAPY_DEBUG=true` → boolean, `KAPY_PORT=3000` → number, strings stay strings
- **Env var casing consistency** — both single and multi-segment keys are now consistently lowercased and namespaced (`KAPY_EXT_REGION` → `ext.region`)

### Bug Fixes

- **`parseArgs()` positional args were dead code** — `_argIndex` was declared but never incremented, making the entire arg mapping system non-functional. Positional args are now properly assigned to declared `ArgDefinition` names
- **`_tick()` double-counted duration** — both logging and timing middleware called `_tick()`, corrupting the duration measurement. Now idempotent (only first call records)
- **`dev.ts` race condition** — child process kill/respawn had no debounce or lifecycle management. Added 150ms debounce and proper SIGINT/SIGTERM handling
- **`dev.ts` used deprecated `fs.watchFile`** — replaced with `fs.watch` + recursive watching for extension directories
- **Flag value consumed next arg that looked like a flag** — `--port --verbose` would incorrectly consume `--verbose` as port's value. Now detects flag-like tokens and falls back to default

### Removed

- **`zod` dependency** — was listed in package.json but never imported

### Improved

- Help output now shows version number and documents `--version`, `--json`, `--no-input` flags
- All built-in commands updated to use named args from `ArgDefinitions` with `.rest` fallback for backward compatibility
- 23 new tests covering positional args, variadics, required validation, flag type coercion, env var type coercion, and casing