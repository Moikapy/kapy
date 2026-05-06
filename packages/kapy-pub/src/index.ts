/**
 * @moikapy/kapy-pub — Publish npm packages with confidence.
 *
 * CLI: kapy-pub pack, verify, publish, key-generate, key-rotate
 * Library: import { packCheck, verifyBuild, generateKey, rotateKey } from "@moikapy/kapy-pub"
 */

export type { KeyResult, PackResult, RotateResult, VerifyResult } from "./core.js";
export { generateKey, packCheck, rotateKey, verifyBuild } from "./core.js";
