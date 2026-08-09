/**
 * Parse human-relative posting strings from Pitt CSC / Simplify feeds
 * (e.g. "1 day ago", "3 days ago", "1 week ago") into an approximate Date.
 */

export type PostedWithin = "all" | "1d" | "3d" | "7d" | "30d";

const WITHIN_DAYS: Record<Exclude<PostedWithin, "all">, number> = {
  "1d": 1,
  "3d": 3,
  "7d": 7,
  "30d": 30,
};

export function isPostedWithinParam(value: string | null | undefined): value is PostedWithin {
  return value === "all" || value === "1d" || value === "3d" || value === "7d" || value === "30d";
}

/** Approximate age in days from a relative/ISO posting string. null if unknown. */
export function parsePostedAgeDays(
  raw: string | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!raw || !raw.trim()) return null;
  const text = raw.trim().toLowerCase();

  const iso = Date.parse(raw.trim());
  if (!Number.isNaN(iso)) {
    return Math.max(0, (now.getTime() - iso) / (1000 * 60 * 60 * 24));
  }

  if (text === "today" || text === "just now") return 0;
  if (text === "yesterday") return 1;

  const rel = text.match(
    /^(\d+)\s*(minute|minutes|min|hour|hours|hr|hrs|day|days|week|weeks|month|months|mo)\s*ago$/,
  );
  if (rel) {
    const n = Number(rel[1]);
    const unit = rel[2];
    if (unit.startsWith("min")) return n / (60 * 24);
    if (unit.startsWith("hour") || unit.startsWith("hr")) return n / 24;
    if (unit.startsWith("day")) return n;
    if (unit.startsWith("week")) return n * 7;
    if (unit.startsWith("month") || unit === "mo") return n * 30;
  }

  // "a day ago" / "a week ago"
  const aRel = text.match(
    /^an?\s*(minute|hour|day|week|month)\s*ago$/,
  );
  if (aRel) {
    const unit = aRel[1];
    if (unit === "minute") return 1 / (60 * 24);
    if (unit === "hour") return 1 / 24;
    if (unit === "day") return 1;
    if (unit === "week") return 7;
    if (unit === "month") return 30;
  }

  return null;
}

export function matchesPostedWithin(
  raw: string | null | undefined,
  within: PostedWithin,
  now: Date = new Date(),
  /** When relative string missing, fall back to this Date (e.g. createdAt). */
  fallbackDate?: Date | string | null,
): boolean {
  if (within === "all") return true;
  const maxDays = WITHIN_DAYS[within];

  let age = parsePostedAgeDays(raw, now);
  if (age === null && fallbackDate) {
    const fb =
      typeof fallbackDate === "string" ? Date.parse(fallbackDate) : fallbackDate.getTime();
    if (!Number.isNaN(fb)) {
      age = Math.max(0, (now.getTime() - fb) / (1000 * 60 * 60 * 24));
    }
  }
  if (age === null) return false;
  return age <= maxDays;
}

export function filterByPostedWithin<T>(
  items: T[],
  within: PostedWithin,
  getPosted: (item: T) => string | null | undefined,
  getFallback?: (item: T) => Date | string | null | undefined,
  now: Date = new Date(),
): T[] {
  if (within === "all") return items;
  return items.filter((item) =>
    matchesPostedWithin(getPosted(item), within, now, getFallback?.(item) ?? null),
  );
}
