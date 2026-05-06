---
name: kapy-pub
description: |
  Publish npm packages with confidence — verify builds, check contents, rotate encryption keys.
  Use when publishing an npm package, checking package contents before publish, generating or
  rotating AES-256-GCM encryption keys, or verifying package.json structure. Triggers on
  "npm publish", "pack check", "verify build", "encryption key", "key rotation",
  "OPENROUTER_ENCRYPT_KEY", or any npm packaging question.
---

# kapy-pub — Publish npm Packages with Confidence

CLI + library for verifying, packing, and publishing npm packages, plus encryption key management.

## Install

```bash
bun add @moikapy/kapy-pub
```

## CLI Usage

```bash
# Check what will be published
kapy-pub pack [directory]

# Verify package structure + build
kapy-pub verify [directory]

# Build + confirm + publish
kapy-pub publish [directory] [--access=public] [--tag=latest] [--dry-run]

# Generate a 256-bit encryption key
kapy-pub key-generate

# Generate a new key with rotation instructions
kapy-pub key-rotate [--currentEnv=OPENROUTER_ENCRYPT_KEY] [--previousEnv=OPENROUTER_ENCRYPT_KEY_PREVIOUS]
```

All commands support `--json` or `-j` for JSON output.

## Library Usage

```typescript
import { packCheck, verifyBuild, generateKey, rotateKey } from "@moikapy/kapy-pub";

// Check what files will be published
const { files, totalSize } = packCheck("./packages/my-lib");

// Verify package.json + build
const { checks, issues, buildOk } = verifyBuild("./packages/my-lib");

// Generate encryption key
const { key } = generateKey();
// => "a3f2e8d1..." (64 hex chars, 256-bit)

// Key rotation
const { newKey, instructions } = rotateKey();
```

## Commands

### `kapy-pub pack [directory]`

Runs `npm pack --dry-run` and shows files that will be published. Catches missing SKILL.md, leaked src/ files, etc.

### `kapy-pub verify [directory]`

Runs a full package verification:
- Checks `package.json` for exports map (types + import), files array, main, types
- Detects missing SKILL.md in files array
- Checks for prepublishOnly/prepack script
- Runs build and validates dist/ exists
- Reports all issues and passed checks

### `kapy-pub publish [directory]`

Full publish workflow:
1. Runs build (`bun run build` or `npm run build`)
2. Runs `npm pack --dry-run` to show contents
3. Asks for confirmation (uses `ctx.confirm`)
4. Runs `npm publish --access public`
5. Reports success or failure

Supports `--tag=beta`, `--dry-run`, `--access=restricted`.

### `kapy-pub key-generate`

Generates a 256-bit (64 hex char) encryption key suitable for AES-256-GCM. Output can be used as `OPENROUTER_ENCRYPT_KEY`.

### `kapy-pub key-rotate`

Generates a new key and produces rotation instructions for:
- Cloudflare Workers (`wrangler secret put`)
- Node.js (`.env`)

Includes step-by-step instructions: set previous key, set new key, wait for expiry, remove previous.