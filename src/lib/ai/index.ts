import { AIRouter } from "./router";
import type { AIProvider } from "./types";

/**
 * Single place that decides which provider implementation is active.
 *
 * AIRouter (src/lib/ai/router.ts) is the active provider: it calls Gemini
 * (primary, free-tier, zero API cost) and falls back to a local Ollama model
 * only on quota/rate-limit or a transient outage — never on a permanent
 * configuration problem. See router.ts for the exact decision tree.
 *
 * The OpenAI implementation (openai-provider.ts) is kept in the codebase as a
 * second, fully-working implementation of the same AIProvider interface —
 * demonstrating the abstraction is real, not vendor-locked — but is not wired
 * up as active.
 */
export function getAIProvider(): AIProvider {
  return new AIRouter();
}

export * from "./types";
