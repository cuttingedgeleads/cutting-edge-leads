// Simple in-memory rate limiter
// For production, consider Upstash Redis for persistence across serverless instances

type RateLimitOptions = {
  limit: number;
  windowMs: number;
  sliding?: boolean;
};

type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number; // unix timestamp (seconds)
};

type Bucket = {
  count: number;
  resetTime: number; // ms
};

const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);
  const limit = options.limit;
  const windowMs = options.windowMs;
  const sliding = options.sliding ?? false;

  let count = 0;
  let resetTime = now + windowMs;

  if (bucket && now <= bucket.resetTime) {
    count = bucket.count;
    resetTime = bucket.resetTime;
  }

  if (now > resetTime) {
    count = 0;
    resetTime = now + windowMs;
  }

  const allowed = count < limit;
  if (allowed) {
    count += 1;
  }

  if (sliding) {
    resetTime = now + windowMs;
  }

  buckets.set(key, { count, resetTime });

  return {
    success: allowed,
    limit,
    remaining: Math.max(0, limit - count),
    reset: Math.ceil(resetTime / 1000),
  };
}

export function getClientIpFromHeaders(headers: Headers): string {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() || "unknown";
  const realIp = headers.get("x-real-ip");
  if (realIp) return realIp;
  const cfConnectingIp = headers.get("cf-connecting-ip");
  if (cfConnectingIp) return cfConnectingIp;
  return "unknown";
}

export function applyRateLimitHeaders(
  response: Response,
  result: RateLimitResult
) {
  response.headers.set("X-RateLimit-Limit", String(result.limit));
  response.headers.set("X-RateLimit-Remaining", String(result.remaining));
  response.headers.set("X-RateLimit-Reset", String(result.reset));
}
