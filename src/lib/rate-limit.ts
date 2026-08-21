import { AppError } from "./errors";

interface Bucket {
  count: number;
  windowStart: number;
}

/**
 * In-memory sliding-window rate limiter, per key (IP) per named limit.
 * Sufficient for a single-instance deployment; a multi-instance deployment
 * would need a shared store (e.g. Redis) instead — documented as a known
 * limitation rather than silently pretending this scales.
 */
const buckets = new Map<string, Bucket>();

export interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

export function checkRateLimit(key: string, opts: RateLimitOptions): void {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now - bucket.windowStart > opts.windowMs) {
    buckets.set(key, { count: 1, windowStart: now });
    return;
  }

  if (bucket.count >= opts.limit) {
    throw new AppError("RATE_LIMITED", "Too many requests. Please wait a moment and try again.");
  }

  bucket.count += 1;
}

// Periodic cleanup so the map doesn't grow unbounded over a long-running process.
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStart > 10 * 60 * 1000) buckets.delete(key);
  }
}, 5 * 60 * 1000).unref?.();

export function getClientKey(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}
