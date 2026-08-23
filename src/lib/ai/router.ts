import { AppError } from "../errors";
import { GeminiProvider } from "./gemini-provider";
import { OllamaProvider, isOllamaAvailable, isFallbackEnabled } from "./ollama-provider";
import type { AIProvider, SummarizeInput, SummaryResult } from "./types";

/**
 * AI Router
 *
 *   Gemini (primary)
 *     │
 *     ├─ success                              → return Gemini result
 *     ├─ AI_RATE_LIMITED (quota/rate exhaust)  → Ollama fallback (no retry — retrying a
 *     │                                          quota-exhausted call immediately is pointless)
 *     ├─ AI_TIMEOUT / AI_PROVIDER_ERROR        → one limited retry on Gemini, then Ollama fallback
 *     │  (transient outage)
 *     ├─ AI_CONFIG_ERROR (missing/invalid key) → surfaced directly, NEVER falls back — falling
 *     │                                          back here would silently hide a permanently
 *     │                                          broken deployment behind a "it worked" response.
 *     └─ AI_INVALID_RESPONSE (schema mismatch) → surfaced directly, not a fallback trigger — this
 *                                                is our own application's schema validation
 *                                                rejecting the model's output, not a service outage.
 *
 * Fallback itself is gated by OLLAMA_FALLBACK_ENABLED (default: off — see
 * isFallbackEnabled() in ollama-provider.ts). When disabled, a fallback-
 * eligible Gemini failure goes straight to AI_UNAVAILABLE without any network
 * call to OLLAMA_BASE_URL at all. When enabled but Ollama is unreachable or
 * also fails, the router returns the same friendly AI_UNAVAILABLE error — it
 * never exposes which provider failed, internal URLs, or stack traces.
 */

const RETRYABLE_TRANSIENT_CODES = new Set(["AI_TIMEOUT", "AI_PROVIDER_ERROR"]);
const MAX_GEMINI_RETRIES = 1;

/** Safe, structured, non-sensitive log line — never logs document text, prompts, or keys. */
function logProviderEvent(fields: Record<string, string>) {
  const line = Object.entries(fields)
    .map(([k, v]) => `${k}=${v}`)
    .join(" ");
  console.log(`[ai-router] ${line}`);
}

async function withGeminiRetry(gemini: GeminiProvider, input: SummarizeInput): Promise<SummaryResult> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_GEMINI_RETRIES; attempt++) {
    try {
      const result = await gemini.generateSummary(input);
      if (attempt > 0) logProviderEvent({ provider: "gemini", status: "success_after_retry" });
      return result;
    } catch (err) {
      lastErr = err;
      const code = err instanceof AppError ? err.code : undefined;
      const isRetryable = code !== undefined && RETRYABLE_TRANSIENT_CODES.has(code) && attempt < MAX_GEMINI_RETRIES;
      if (!isRetryable) break;
      logProviderEvent({ provider: "gemini", status: "transient_error", action: "retry" });
    }
  }
  throw lastErr;
}

export class AIRouter implements AIProvider {
  private gemini = new GeminiProvider();
  private ollama = new OllamaProvider();

  async generateSummary(input: SummarizeInput): Promise<SummaryResult> {
    try {
      const result = await withGeminiRetry(this.gemini, input);
      logProviderEvent({ provider: "gemini", status: "success" });
      return result;
    } catch (err) {
      if (!(err instanceof AppError)) throw err;

      // Never fall back for a permanent configuration problem or for our own
      // application's schema rejection of the model's output — both need to
      // be surfaced and fixed, not silently masked by a different provider.
      if (err.code === "AI_CONFIG_ERROR" || err.code === "AI_INVALID_RESPONSE") {
        logProviderEvent({ provider: "gemini", status: err.code.toLowerCase() });
        throw err;
      }

      // Only quota/rate-limit and transient-outage codes reach here.
      if (err.code !== "AI_RATE_LIMITED" && !RETRYABLE_TRANSIENT_CODES.has(err.code)) {
        throw err;
      }

      // Fallback is opt-in (OLLAMA_FALLBACK_ENABLED=true) and off by default.
      // When disabled, this must not attempt any network call to
      // OLLAMA_BASE_URL at all — not even the availability check — since in
      // most deployments that address is meaningless or unreachable by design.
      if (!isFallbackEnabled()) {
        logProviderEvent({ provider: "gemini", status: err.code.toLowerCase(), fallback: "disabled" });
        throw new AppError(
          "AI_UNAVAILABLE",
          "Summarization is temporarily unavailable. Please try again in a few minutes."
        );
      }

      logProviderEvent({ provider: "gemini", status: err.code.toLowerCase(), fallback: "ollama" });

      const available = await isOllamaAvailable();
      if (!available) {
        logProviderEvent({ provider: "ollama", status: "unavailable" });
        throw new AppError(
          "AI_UNAVAILABLE",
          "Summarization is temporarily unavailable. Please try again in a few minutes."
        );
      }

      try {
        const result = await this.ollama.generateSummary(input);
        logProviderEvent({ provider: "ollama", status: "success" });
        return result;
      } catch (ollamaErr) {
        logProviderEvent({
          provider: "ollama",
          status: ollamaErr instanceof AppError ? ollamaErr.code.toLowerCase() : "error",
        });
        throw new AppError(
          "AI_UNAVAILABLE",
          "Summarization is temporarily unavailable. Please try again in a few minutes."
        );
      }
    }
  }
}
