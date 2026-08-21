import { OpenAIProvider } from "./openai-provider";
import type { AIProvider } from "./types";

/** Single place that decides which provider implementation is active. */
export function getAIProvider(): AIProvider {
  return new OpenAIProvider();
}

export * from "./types";
