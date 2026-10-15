import { NextRequest, NextResponse } from "next/server";
import { fetchAndCacheJobFullText } from "@/lib/ingestion/tier2-fetcher";
import { isPlaceholderDescription } from "@/lib/ingestion/helpers";
import { getJobById } from "@/lib/db/jobs";
import { requireUserId } from "@/lib/security/auth-request";
import { sanitizeError } from "@/lib/ai/redact";

const MAX_IDS_PER_REQUEST = 8;
const CONCURRENCY = 3;

type HydrateStatus = "ok" | "cached" | "failed" | "skipped";

interface HydrateResult {
  id: string;
  status: HydrateStatus;
  rawDescription?: string;
}

/**
 * Background hydration of placeholder job descriptions.
 * Descriptions are persisted on the Job row, so each posting is fetched at most once.
 * Postings that already failed (extractFailure set) are skipped unless `retry` is true.
 */
export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    if (userId instanceof NextResponse) return userId;

    const body = (await req.json().catch(() => ({}))) as { ids?: unknown; retry?: unknown };
    const ids = Array.isArray(body.ids)
      ? Array.from(new Set(body.ids.filter((id): id is string => typeof id === "string" && id.length > 0)))
      : [];

    if (ids.length === 0) {
      return NextResponse.json({ success: false, error: "ids is required" }, { status: 400 });
    }

    const retry = body.retry === true;
    const queue = ids.slice(0, MAX_IDS_PER_REQUEST);
    const results: HydrateResult[] = [];

    async function worker() {
      for (;;) {
        const id = queue.shift();
        if (!id) return;
        try {
          const job = await getJobById(id);
          if (!job) {
            results.push({ id, status: "skipped" });
            continue;
          }
          if (!isPlaceholderDescription(job.rawDescription)) {
            results.push({ id, status: "cached", rawDescription: job.rawDescription });
            continue;
          }
          if (job.extractFailure && !retry) {
            results.push({ id, status: "skipped" });
            continue;
          }
          const res = await fetchAndCacheJobFullText(id);
          if (res.success && res.data) {
            results.push({ id, status: "ok", rawDescription: res.data.rawDescription });
          } else {
            results.push({ id, status: "failed" });
          }
        } catch {
          results.push({ id, status: "failed" });
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, () => worker()));

    return NextResponse.json({ success: true, results });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error) || "Failed to hydrate descriptions" },
      { status: 500 }
    );
  }
}
