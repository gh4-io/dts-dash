/**
 * Simple in-memory rate limiter.
 * Tracks last request timestamp per key (sha256 hash of API key).
 * Resets on server restart — acceptable for local-first single-process app.
 */

interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

const timestamps = new Map<string, number>();

/**
 * Check if a request is within rate limits and record the attempt.
 * @param keyHash - sha256 hash of the API key (never store raw keys)
 * @param windowMs - Minimum time between requests in milliseconds
 */
export function checkRateLimit(
  keyHash: string,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const lastRequest = timestamps.get(keyHash);

  if (lastRequest && now - lastRequest < windowMs) {
    const retryAfterSeconds = Math.ceil(
      (windowMs - (now - lastRequest)) / 1000
    );
    return { allowed: false, retryAfterSeconds };
  }

  // Record this request timestamp
  timestamps.set(keyHash, now);
  return { allowed: true };
}
