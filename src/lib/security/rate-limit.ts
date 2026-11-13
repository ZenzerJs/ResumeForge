type Bucket = { count: number; resetAt: number };

export const NAMESPACE_QUOTAS = {
  auth: 200,
  ai: 150,
  "demo-ai": 100,
  "demo-byok": 100,
  "heavy:/api/jobs/bulk-import": 70,
  "heavy:/api/jobs/hydrate": 70,
  "heavy:/api/resumes/upload-pdf": 70,
  "heavy:/api/jobs/extract": 70,
  "heavy:/api/connectors/sync": 40,
  "heavy:/api/jobs/[id]/fetch-fulltext": 40,
  "heavy:dossier-generate": 40,
  other: 50,
} as const;

export type RateLimitNamespace = keyof typeof NAMESPACE_QUOTAS;

const namespaceBuckets = new Map<RateLimitNamespace, Map<string, Bucket>>();

export function resetRateLimitsForTests(): void {
  namespaceBuckets.clear();
}

export function rateLimitBucketCount(): number {
  let total = 0;
  for (const map of namespaceBuckets.values()) {
    total += map.size;
  }
  return total;
}

function getNamespace(key: string): RateLimitNamespace {
  for (const ns of Object.keys(NAMESPACE_QUOTAS) as RateLimitNamespace[]) {
    if (ns !== "other" && key.startsWith(`${ns}:`)) {
      return ns;
    }
  }
  return "other";
}

function getNamespaceMap(ns: RateLimitNamespace): Map<string, Bucket> {
  let map = namespaceBuckets.get(ns);
  if (!map) {
    map = new Map<string, Bucket>();
    namespaceBuckets.set(ns, map);
  }
  return map;
}

function evictNamespaceBuckets(map: Map<string, Bucket>, quota: number, now: number): void {
  if (map.size < quota) return;
  for (const [key, bucket] of map) {
    if (bucket.resetAt <= now) map.delete(key);
  }
  if (map.size < quota) return;
  const oldest = [...map.entries()].sort((a, b) => a[1].resetAt - b[1].resetAt);
  while (map.size >= quota && oldest.length > 0) {
    const next = oldest.shift();
    if (next) map.delete(next[0]);
  }
}

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const ns = getNamespace(key);
  const map = getNamespaceMap(ns);
  if (!map.has(key)) evictNamespaceBuckets(map, NAMESPACE_QUOTAS[ns], now);

  const existing = map.get(key);
  if (!existing || existing.resetAt <= now) {
    map.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (existing.count >= limit) return false;
  existing.count += 1;
  return true;
}

function isVerifiedPlatformIngress(): boolean {
  return process.env.VERCEL === "1";
}

function isTrustedProxyEnabled(): boolean {
  const raw = process.env.TRUST_PROXY?.trim().toLowerCase();
  return raw === "true" || raw === "1";
}

function resolveTrustedClientIp(request: Request): string {
  const peerIp = (request as Request & { ip?: string }).ip?.trim();
  if (peerIp) return peerIp;

  if (isVerifiedPlatformIngress()) {
    const vercelIp = request.headers.get("x-vercel-forwarded-for");
    if (vercelIp) {
      const hops = vercelIp.split(",").map((part) => part.trim()).filter(Boolean);
      const closest = hops[hops.length - 1];
      if (closest) return closest;
    }
    const realIp = request.headers.get("x-real-ip")?.trim();
    if (realIp) return realIp;
    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) {
      const hops = forwarded.split(",").map((part) => part.trim()).filter(Boolean);
      const closest = hops[hops.length - 1];
      if (closest) return closest;
    }
    return "direct";
  }

  if (isTrustedProxyEnabled()) {
    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) {
      const hops = forwarded.split(",").map((part) => part.trim()).filter(Boolean);
      const closest = hops[hops.length - 1];
      if (closest) return closest;
    }
    const realIp = request.headers.get("x-real-ip")?.trim();
    if (realIp) return realIp;
    return "direct";
  }

  return "direct";
}

export function clientKey(request: Request, prefix: RateLimitNamespace): string {
  return `${prefix}:${resolveTrustedClientIp(request)}`;
}
