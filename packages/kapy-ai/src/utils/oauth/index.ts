/**
 * OAuth credential management for AI providers.
 *
 * DEFERRED: Cloud provider OAuth is deferred until cloud support is added.
 * See ADR-015 for the credential management strategy.
 *
 * Ollama is the current primary provider and doesn't need OAuth.
 * When cloud providers are re-enabled, uncomment the exports below
 * and ensure credentials come from env vars (KAPY_* prefix).
 */

export * from "./types.js";

// DEFERRED: Uncomment when adding cloud provider support
// export { anthropicOAuthProvider, loginAnthropic, refreshAnthropicToken } from "./anthropic.js";
// export { getGitHubCopilotBaseUrl, githubCopilotOAuthProvider, loginGitHubCopilot, normalizeDomain, refreshGitHubCopilotToken } from "./github-copilot.js";
// export { antigravityOAuthProvider, loginAntigravity, refreshAntigravityToken } from "./google-antigravity.js";
// export { geminiCliOAuthProvider, loginGeminiCli, refreshGoogleCloudToken } from "./google-gemini-cli.js";
// export { loginOpenAICodex, openaiCodexOAuthProvider, refreshOpenAICodexToken } from "./openai-codex.js";
