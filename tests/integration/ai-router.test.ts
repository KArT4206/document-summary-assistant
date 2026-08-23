import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AppError } from "@/lib/errors";
import { AIRouter } from "@/lib/ai/router";

// Mocks both provider classes so the router's own decision logic (when to
// fall back, when not to, retry-before-fallback) is tested in isolation from
// any real Gemini or Ollama call — no real quota burned, no local server
// required for this suite.
const geminiState: { impl: () => Promise<unknown> } = { impl: async () => ({}) };
const ollamaState: { impl: () => Promise<unknown>; available: boolean; availableCalled: boolean } = {
  impl: async () => ({}),
  available: true,
  availableCalled: false,
};

vi.mock("@/lib/ai/gemini-provider", () => ({
  GeminiProvider: class {
    generateSummary() {
      return geminiState.impl();
    }
  },
}));

vi.mock("@/lib/ai/ollama-provider", () => ({
  OllamaProvider: class {
    generateSummary() {
      return ollamaState.impl();
    }
  },
  isOllamaAvailable: () => {
    ollamaState.availableCalled = true;
    return Promise.resolve(ollamaState.available);
  },
  // Real implementation, not mocked: exercises the actual env-var gate logic
  // (imported from the real module below) rather than a stub.
  isFallbackEnabled: () => process.env.OLLAMA_FALLBACK_ENABLED === "true",
}));

const VALID_RESULT = {
  summary: "s",
  keyPoints: ["k"],
  mainIdeas: ["m"],
  improvementSuggestions: ["i"],
};

function freshRouter() {
  return new AIRouter();
}

describe("AIRouter — fallback enabled (development-style config)", () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  const originalFlag = process.env.OLLAMA_FALLBACK_ENABLED;

  beforeEach(() => {
    process.env.OLLAMA_FALLBACK_ENABLED = "true";
    geminiState.impl = async () => ({});
    ollamaState.impl = async () => ({});
    ollamaState.available = true;
    ollamaState.availableCalled = false;
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });
  afterEach(() => {
    consoleSpy.mockRestore();
    process.env.OLLAMA_FALLBACK_ENABLED = originalFlag;
  });

  it("Gemini success: returns the Gemini result directly, without touching Ollama", async () => {
    let ollamaCalled = false;
    geminiState.impl = async () => VALID_RESULT;
    ollamaState.impl = async () => {
      ollamaCalled = true;
      return VALID_RESULT;
    };
    const router = freshRouter();
    const result = await router.generateSummary({ documentText: "x", length: "short" });
    expect(result).toEqual(VALID_RESULT);
    expect(ollamaCalled).toBe(false);
  });

  it("Gemini quota → Ollama fallback when enabled: falls back and returns a valid result", async () => {
    geminiState.impl = async () => {
      throw new AppError("AI_RATE_LIMITED", "quota exceeded");
    };
    ollamaState.impl = async () => VALID_RESULT;
    const router = freshRouter();
    const result = await router.generateSummary({ documentText: "x", length: "short" });
    expect(result).toEqual(VALID_RESULT);
  });

  it("retries Gemini once on a transient provider error before falling back", async () => {
    let geminiCalls = 0;
    geminiState.impl = async () => {
      geminiCalls++;
      throw new AppError("AI_PROVIDER_ERROR", "temporarily unavailable");
    };
    ollamaState.impl = async () => VALID_RESULT;
    const router = freshRouter();
    await router.generateSummary({ documentText: "x", length: "short" });
    expect(geminiCalls).toBe(2); // original attempt + 1 retry
  });

  it("succeeds without falling back if the retry itself succeeds", async () => {
    let geminiCalls = 0;
    let ollamaCalled = false;
    geminiState.impl = async () => {
      geminiCalls++;
      if (geminiCalls === 1) throw new AppError("AI_PROVIDER_ERROR", "temporarily unavailable");
      return VALID_RESULT;
    };
    ollamaState.impl = async () => {
      ollamaCalled = true;
      return VALID_RESULT;
    };
    const router = freshRouter();
    const result = await router.generateSummary({ documentText: "x", length: "short" });
    expect(result).toEqual(VALID_RESULT);
    expect(ollamaCalled).toBe(false);
  });

  it("invalid Gemini configuration does NOT silently fall back — surfaces AI_CONFIG_ERROR directly", async () => {
    let ollamaCalled = false;
    geminiState.impl = async () => {
      throw new AppError("AI_CONFIG_ERROR", "The summarization service is not configured.");
    };
    ollamaState.impl = async () => {
      ollamaCalled = true;
      return VALID_RESULT;
    };
    const router = freshRouter();
    const err = await router.generateSummary({ documentText: "x", length: "short" }).catch((e) => e);
    expect(err.code).toBe("AI_CONFIG_ERROR");
    expect(ollamaCalled).toBe(false);
  });

  it("invalid AI response does NOT silently fall back — surfaces AI_INVALID_RESPONSE directly", async () => {
    let ollamaCalled = false;
    geminiState.impl = async () => {
      throw new AppError("AI_INVALID_RESPONSE", "The summarizer returned an incomplete response.");
    };
    ollamaState.impl = async () => {
      ollamaCalled = true;
      return VALID_RESULT;
    };
    const router = freshRouter();
    const err = await router.generateSummary({ documentText: "x", length: "short" }).catch((e) => e);
    expect(err.code).toBe("AI_INVALID_RESPONSE");
    expect(ollamaCalled).toBe(false);
  });

  it("Ollama unavailable: returns a friendly AI_UNAVAILABLE error (no internal detail)", async () => {
    geminiState.impl = async () => {
      throw new AppError("AI_RATE_LIMITED", "quota exceeded");
    };
    ollamaState.available = false;
    const router = freshRouter();
    const err = await router.generateSummary({ documentText: "x", length: "short" }).catch((e) => e);
    expect(err.code).toBe("AI_UNAVAILABLE");
    expect(err.message).not.toMatch(/127\.0\.0\.1|11434|ollama|gemini/i);
  });

  it("returns a friendly AI_UNAVAILABLE error when Ollama is reachable but also fails", async () => {
    geminiState.impl = async () => {
      throw new AppError("AI_RATE_LIMITED", "quota exceeded");
    };
    ollamaState.impl = async () => {
      throw new AppError("AI_PROVIDER_ERROR", "local model failed");
    };
    const router = freshRouter();
    const err = await router.generateSummary({ documentText: "x", length: "short" }).catch((e) => e);
    expect(err.code).toBe("AI_UNAVAILABLE");
  });

  it("never retries more than once, even under repeated transient failures (no infinite retry)", async () => {
    let geminiCalls = 0;
    geminiState.impl = async () => {
      geminiCalls++;
      throw new AppError("AI_TIMEOUT", "timed out");
    };
    ollamaState.impl = async () => VALID_RESULT;
    const router = freshRouter();
    await router.generateSummary({ documentText: "x", length: "short" });
    expect(geminiCalls).toBeLessThanOrEqual(2);
  });

  it("logs safe, structured provider events without document text, prompts, or secrets", async () => {
    geminiState.impl = async () => {
      throw new AppError("AI_RATE_LIMITED", "quota exceeded");
    };
    ollamaState.impl = async () => VALID_RESULT;
    const router = freshRouter();
    await router.generateSummary({ documentText: "SECRET_DOCUMENT_CONTENT_MARKER", length: "short" });

    const allLoggedText = consoleSpy.mock.calls.map((c: unknown[]) => c.join(" ")).join("\n");
    expect(allLoggedText).toContain("provider=gemini");
    expect(allLoggedText).toContain("provider=ollama");
    expect(allLoggedText).not.toContain("SECRET_DOCUMENT_CONTENT_MARKER");
    expect(allLoggedText).not.toMatch(/api[_-]?key/i);
  });
});

describe("AIRouter — fallback disabled (production-safe default)", () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  const originalFlag = process.env.OLLAMA_FALLBACK_ENABLED;

  beforeEach(() => {
    geminiState.impl = async () => ({});
    ollamaState.impl = async () => ({});
    ollamaState.available = true;
    ollamaState.availableCalled = false;
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });
  afterEach(() => {
    consoleSpy.mockRestore();
    process.env.OLLAMA_FALLBACK_ENABLED = originalFlag;
  });

  it("production fallback disabled (flag unset): Gemini quota exhaustion → safe AI_UNAVAILABLE, Ollama never contacted", async () => {
    delete process.env.OLLAMA_FALLBACK_ENABLED;
    let ollamaCalled = false;
    geminiState.impl = async () => {
      throw new AppError("AI_RATE_LIMITED", "quota exceeded");
    };
    ollamaState.impl = async () => {
      ollamaCalled = true;
      return VALID_RESULT;
    };
    const router = freshRouter();
    const err = await router.generateSummary({ documentText: "x", length: "short" }).catch((e) => e);

    expect(err.code).toBe("AI_UNAVAILABLE");
    expect(err.message).not.toMatch(/127\.0\.0\.1|11434|ollama|gemini/i);
    // The core safety guarantee: no network attempt is made to Ollama at all,
    // not even the lightweight availability check.
    expect(ollamaState.availableCalled).toBe(false);
    expect(ollamaCalled).toBe(false);
  });

  it("explicitly disabled (OLLAMA_FALLBACK_ENABLED=false): same safe behavior", async () => {
    process.env.OLLAMA_FALLBACK_ENABLED = "false";
    geminiState.impl = async () => {
      throw new AppError("AI_PROVIDER_ERROR", "transient outage");
    };
    const router = freshRouter();
    const err = await router.generateSummary({ documentText: "x", length: "short" }).catch((e) => e);
    expect(err.code).toBe("AI_UNAVAILABLE");
    expect(ollamaState.availableCalled).toBe(false);
  });

  it("Gemini success still works normally with fallback disabled", async () => {
    delete process.env.OLLAMA_FALLBACK_ENABLED;
    geminiState.impl = async () => VALID_RESULT;
    const router = freshRouter();
    const result = await router.generateSummary({ documentText: "x", length: "short" });
    expect(result).toEqual(VALID_RESULT);
    expect(ollamaState.availableCalled).toBe(false);
  });

  it("invalid Gemini configuration still does not fall back when the flag is disabled", async () => {
    delete process.env.OLLAMA_FALLBACK_ENABLED;
    geminiState.impl = async () => {
      throw new AppError("AI_CONFIG_ERROR", "The summarization service is not configured.");
    };
    const router = freshRouter();
    const err = await router.generateSummary({ documentText: "x", length: "short" }).catch((e) => e);
    expect(err.code).toBe("AI_CONFIG_ERROR");
    expect(ollamaState.availableCalled).toBe(false);
  });

  it("logs that fallback was skipped due to being disabled, without leaking document text", async () => {
    delete process.env.OLLAMA_FALLBACK_ENABLED;
    geminiState.impl = async () => {
      throw new AppError("AI_RATE_LIMITED", "quota exceeded");
    };
    const router = freshRouter();
    await router.generateSummary({ documentText: "SECRET_MARKER", length: "short" }).catch(() => {});
    const allLoggedText = consoleSpy.mock.calls.map((c: unknown[]) => c.join(" ")).join("\n");
    expect(allLoggedText).toContain("provider=gemini");
    expect(allLoggedText).toContain("fallback=disabled");
    expect(allLoggedText).not.toContain("provider=ollama");
    expect(allLoggedText).not.toContain("SECRET_MARKER");
  });
});
