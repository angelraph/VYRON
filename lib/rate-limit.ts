import "server-only";

/** Token-bucket rate limiter, in-memory per process. This matches the
 * app's actual current deployment shape (a single long-lived Node
 * process — see `instrumentation.ts`'s monitor loop); it does not
 * coordinate across multiple instances. If VYRON is ever deployed with
 * more than one instance, swap the `buckets` Map below for a shared store
 * (e.g. Upstash Redis) — the `checkRateLimit` call site doesn't need to
 * change. */
interface Bucket {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, Bucket>();

/** Bounds how long a bucket with no recent activity is kept around, so
 * `buckets` doesn't grow forever as distinct keys (users/IPs) come and
 * go. Swept lazily on access rather than on a timer. */
const BUCKET_TTL_MS = 60 * 60 * 1000;
let lastSweep = Date.now();

function sweepStaleBuckets(now: number): void {
  if (now - lastSweep < BUCKET_TTL_MS) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (now - bucket.lastRefill > BUCKET_TTL_MS) buckets.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  /** Only set when `allowed` is false — how long until a token is available. */
  retryAfterMs: number;
}

export interface RateLimitOptions {
  /** Max requests allowed per `windowMs`. */
  max: number;
  windowMs: number;
}

/** Real token-bucket check (not a fixed-window counter — avoids the
 * burst-at-boundary problem those have). `key` should identify the caller
 * (authenticated user id preferred; fall back to IP only when there's no
 * user yet). */
export function checkRateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  const { max, windowMs } = options;
  const now = Date.now();
  sweepStaleBuckets(now);

  const bucket = buckets.get(key) ?? { tokens: max, lastRefill: now };
  const elapsed = now - bucket.lastRefill;
  bucket.tokens = Math.min(max, bucket.tokens + (elapsed / windowMs) * max);
  bucket.lastRefill = now;

  if (bucket.tokens < 1) {
    buckets.set(key, bucket);
    const retryAfterMs = Math.ceil(((1 - bucket.tokens) / max) * windowMs);
    return { allowed: false, retryAfterMs };
  }

  bucket.tokens -= 1;
  buckets.set(key, bucket);
  return { allowed: true, retryAfterMs: 0 };
}
