import { GeminiProvider } from "./gemini-provider";
import type { AIProvider } from "./types";

/**
 * Single place that decides which provider implementation is active.
 * Gemini is the default (free-tier, zero API cost for this project). The
 * OpenAI implementation (openai-provider.ts) is kept in the codebase as a
 * second, fully-working implementation of the same AIProvider interface —
 * demonstrating the abstraction is real, not just a single hardcoded class —
 * but is not wired up as the active provider.
 */
export function getAIProvider(): AIProvider {
  return new GeminiProvider();
}

export * from "./types";
