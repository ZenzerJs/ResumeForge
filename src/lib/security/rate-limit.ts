type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 1000;

export function resetRateLimitsForTests(): void {
  buckets.clear();
}

export function rateLimitBucketCount(): number {
  return buckets.size;
}

function evictBuckets(now: number): void {
  if (buckets.size < MAX_BUCKETS) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  if (buckets.size < MAX_BUCKETS) return;
  const oldest = [...buckets.entries()].sort((a, b) => a[1].resetAt - b[1].resetAt);
  while (buckets.size >= MAX_BUCKETS && oldest.length > 0) {
    const next = oldest.shift();
    if (next) buckets.delete(next[0]);
  }
}

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  if (!buckets.has(key)) evictBuckets(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (existing.count >= limit) return false;
  existing.count += 1;
  return true;
}

export function clientKey(request: Request, prefix: string): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded.split(",").map((part) => part.trim()).filter(Boolean);
    const closest = hops[hops.length - 1];
    if (closest) return `${prefix}:${closest}`;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  return `${prefix}:${realIp || "local"}`;
}
