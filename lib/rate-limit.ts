import "server-only";

import { createHash } from "node:crypto";

type Window = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Map<string, Window>>();

const MAX_KEYS_PER_BUCKET = 10_000;

export class RateLimitExceededError extends Error {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super("Rate limit exceeded.");
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/**
 * Fixed-window in-memory rate limiter keyed by (bucket, identifier).
 *
 * In-memory state is per-instance. On Vercel Fluid Compute instances are
 * reused across requests, so this is adequate abuse protection without
 * external infrastructure. Exact global counts are not guaranteed; treat
 * this as a safety throttle, not a metering service.
 */
export function rateLimit(
  bucketName: string,
  identifier: string,
  options: { limit: number; windowMs: number }
): void {
  const now = Date.now();
  let bucket = buckets.get(bucketName);
  if (!bucket) {
    bucket = new Map();
    buckets.set(bucketName, bucket);
  }

  if (bucket.size > MAX_KEYS_PER_BUCKET) {
    sweepExpired(bucket, now);
  }

  const current = bucket.get(identifier);
  if (current && current.resetAt > now) {
    if (current.count >= options.limit) {
      throw new RateLimitExceededError(Math.max(1, Math.ceil((current.resetAt - now) / 1000)));
    }
    current.count += 1;
  } else {
    bucket.set(identifier, { count: 1, resetAt: now + options.windowMs });
  }
}

function sweepExpired(bucket: Map<string, Window>, now: number) {
  for (const [key, window] of bucket) {
    if (window.resetAt <= now) bucket.delete(key);
  }
}

/** Best-effort client IP from Vercel request headers. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return (
    request.headers.get("x-real-ip") ??
    request.headers.get("x-vercel-forwarded-for") ??
    "unknown"
  );
}

/** Hash identifiers (IP, phone) so raw values never sit in memory. */
export function hashIdentifier(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}
