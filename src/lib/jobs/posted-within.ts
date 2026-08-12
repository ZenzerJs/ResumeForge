/**
 * Parse human-relative posting strings from Pitt CSC / Simplify feeds
 * (e.g. "1 day ago", "3 days ago", "1 week ago") into an approximate age.
 *
 * Relative strings are frozen at scrape time — when a `fallbackDate` (usually
 * `createdAt`) is provided, age is: relativeAge + daysSince(capture).
 */

export type PostedWithin = "all" | "1d" | "3d" | "7d" | "30d";

const WITHIN_DAYS: Record<Exclude<PostedWithin, "all">, number> = {
  "1d": 1,
  "3d": 3,
  "7d": 7,
  "30d": 30,
};

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export function isPostedWithinParam(value: string | null | undefined): value is PostedWithin {
  return value === "all" || value === "1d" || value === "3d" || value === "7d" || value === "30d";
}

function toTime(value: Date | string | null | undefined): number | null {
  if (value == null) return null;
  const ms = typeof value === "string" ? Date.parse(value) : value.getTime();
  return Number.isNaN(ms) ? null : ms;
}

/** True when the string looks like an absolute/ISO timestamp, not "N days ago". */
export function looksLikeAbsoluteDate(raw: string): boolean {
  const text = raw.trim();
  if (!text || /\bago\b/i.test(text)) return false;
  if (/^(today|yesterday|just now)$/i.test(text)) return false;
  return !Number.isNaN(Date.parse(text));
}

/** Approximate age in days from a relative/ISO posting string. null if unknown. */
export function parsePostedAgeDays(
  raw: string | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!raw || !raw.trim()) return null;
  const text = raw.trim().toLowerCase();

  if (looksLikeAbsoluteDate(raw)) {
    const iso = Date.parse(raw.trim());
    return Math.max(0, (now.getTime() - iso) / MS_PER_DAY);
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
  const aRel = text.match(/^an?\s*(minute|hour|day|week|month)\s*ago$/);
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

/**
 * Effective posting age in days for filtering.
 * Relative strings ("3 days ago") are anchored to `capturedAt` when provided,
 * so a scrape from last week does not forever look like "3 days ago".
 */
export function resolvePostedAgeDays(
  raw: string | null | undefined,
  now: Date = new Date(),
  capturedAt?: Date | string | null,
): number | null {
  const captureMs = toTime(capturedAt);

  if (raw && looksLikeAbsoluteDate(raw)) {
    return parsePostedAgeDays(raw, now);
  }

  const relativeAge = parsePostedAgeDays(raw, now);
  if (relativeAge !== null) {
    if (captureMs != null) {
      const daysSinceCapture = Math.max(0, (now.getTime() - captureMs) / MS_PER_DAY);
      return relativeAge + daysSinceCapture;
    }
    return relativeAge;
  }

  if (captureMs != null) {
    return Math.max(0, (now.getTime() - captureMs) / MS_PER_DAY);
  }

  return null;
}

export function matchesPostedWithin(
  raw: string | null | undefined,
  within: PostedWithin,
  now: Date = new Date(),
  /** Scrape/ingest time — used to age relative "N days ago" strings. */
  fallbackDate?: Date | string | null,
): boolean {
  if (within === "all") return true;
  const maxDays = WITHIN_DAYS[within];
  const age = resolvePostedAgeDays(raw, now, fallbackDate);
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
