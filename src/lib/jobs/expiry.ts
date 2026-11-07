import { looksLikeAbsoluteDate, parsePostedAgeDays } from "./posted-within";

export const DEFAULT_JOB_MAX_AGE_DAYS = 60;
const DAY = 86_400_000;

/** One deployment-wide policy for every board and the sweep. */
export function jobMaxAgeDays(): number {
  return process.env.JOB_BOARD_MAX_AGE_DAYS === "30"
    ? 30
    : DEFAULT_JOB_MAX_AGE_DAYS;
}

/** Future absolute dates fall back to first-seen time. */
export function postingTime(
  raw: string | null | undefined,
  capturedAt: Date | string,
  now = new Date(),
): Date {
  const capture = new Date(capturedAt).getTime();
  if (!Number.isFinite(capture)) return now;
  if (raw && looksLikeAbsoluteDate(raw)) {
    const parsed = Date.parse(raw);
    if (parsed <= now.getTime()) return new Date(parsed);
  } else {
    const age = parsePostedAgeDays(raw, new Date(capture));
    if (age !== null && Number.isFinite(age))
      return new Date(capture - age * DAY);
  }
  return new Date(capture);
}

export function isBoardEligible(
  raw: string | null | undefined,
  capturedAt: Date | string,
  now = new Date(),
  maxAgeDays = jobMaxAgeDays(),
): boolean {
  return (
    postingTime(raw, capturedAt, now).getTime() >=
    now.getTime() - maxAgeDays * DAY
  );
}

/** Repeated relative/missing dates cannot reset a listing. A newer absolute date can represent a repost. */
export function stablePostingDate(
  existing: string | null,
  incoming: string | null,
  createdAt: Date | string,
  now: Date,
): string | null {
  if (!incoming || !looksLikeAbsoluteDate(incoming)) return existing;
  const incomingMs = Date.parse(incoming);
  if (incomingMs > now.getTime()) return existing;
  return !existing ||
    incomingMs > postingTime(existing, createdAt, now).getTime()
    ? new Date(incomingMs).toISOString()
    : existing;
}

/** Validate an initial feed date without losing its capture-relative meaning. */
export function initialPostingDate(
  raw: string | null,
  now: Date,
): string | null {
  if (!raw) return null;
  if (looksLikeAbsoluteDate(raw))
    return Date.parse(raw) <= now.getTime() ? raw : null;
  return parsePostedAgeDays(raw, now) !== null ? raw : null;
}
