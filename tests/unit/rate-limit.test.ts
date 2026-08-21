import { describe, it, expect, vi, afterEach } from "vitest";
import { checkRateLimit, getClientKey } from "@/lib/rate-limit";
import { AppError } from "@/lib/errors";

describe("checkRateLimit", () => {
  afterEach(() => vi.useRealTimers());

  it("allows requests under the limit", () => {
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 5; i++) {
      expect(() => checkRateLimit(key, { limit: 5, windowMs: 60_000 })).not.toThrow();
    }
  });

  it("rejects requests once the limit is exceeded within the window", () => {
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 3; i++) checkRateLimit(key, { limit: 3, windowMs: 60_000 });
    expect(() => checkRateLimit(key, { limit: 3, windowMs: 60_000 })).toThrow(AppError);
    try {
      checkRateLimit(key, { limit: 3, windowMs: 60_000 });
    } catch (err) {
      expect((err as AppError).code).toBe("RATE_LIMITED");
      expect((err as AppError).status).toBe(429);
    }
  });

  it("resets the count after the window elapses", () => {
    vi.useFakeTimers();
    const key = `test-${Math.random()}`;
    checkRateLimit(key, { limit: 1, windowMs: 1000 });
    expect(() => checkRateLimit(key, { limit: 1, windowMs: 1000 })).toThrow(AppError);
    vi.advanceTimersByTime(1500);
    expect(() => checkRateLimit(key, { limit: 1, windowMs: 1000 })).not.toThrow();
  });

  it("keeps separate buckets per key (per-IP isolation)", () => {
    const keyA = `a-${Math.random()}`;
    const keyB = `b-${Math.random()}`;
    checkRateLimit(keyA, { limit: 1, windowMs: 60_000 });
    expect(() => checkRateLimit(keyA, { limit: 1, windowMs: 60_000 })).toThrow(AppError);
    expect(() => checkRateLimit(keyB, { limit: 1, windowMs: 60_000 })).not.toThrow();
  });
});

describe("getClientKey", () => {
  it("extracts the first IP from x-forwarded-for", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" });
    expect(getClientKey(headers)).toBe("203.0.113.5");
  });

  it("falls back to 'unknown' when no header is present (never trusts a client-suppliable identity blindly)", () => {
    expect(getClientKey(new Headers())).toBe("unknown");
  });

  it("rejects a header-injection attempt with CRLF-like content at the Headers layer", () => {
    // The runtime's Headers implementation itself refuses to store a value containing
    // CR/LF, so a classic header-injection payload can never reach getClientKey() at all.
    expect(() => new Headers({ "x-forwarded-for": "1.2.3.4\r\nX-Injected: evil" })).toThrow();
  });
});
