import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fetchAndCacheJobFullText } from "@/lib/ingestion/tier2-fetcher";
import { isPlaceholderDescription } from "@/lib/ingestion/helpers";
import { buildHydratedJobDetail, sharedOrSelfJobWhere } from "@/lib/db/jobs";
import { HydrateResultSchema, type HydrateResult } from "@/lib/jd-parser/types";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/security/auth-request";
import { sanitizeError } from "@/lib/ai/redact";

const MAX_IDS_PER_REQUEST = 8;
const CONCURRENCY = 3;

const HydrateRequestSchema = z.object({
  ids: z.array(z.string()).optional(),
  retry: z.boolean().optional(),
});

/**
 * Background hydration of job descriptions and structured requirements.
 * Descriptions and parsed requirements are persisted on owned Job rows.
 * Postings that already failed description fetch (extractFailure set) are skipped unless `retry` is true.
 * Full descriptions with unparsed/stale requirements are parsed without refetching.
 */
export async function POST(req: NextRequest) {
  try {
    const authResult = await requireUserId(req);
    if (authResult instanceof NextResponse) return authResult;
    const userId = authResult;

    const rawBody = await req.json().catch(() => ({}));
    const parsedBody = HydrateRequestSchema.safeParse(rawBody);
    const ids = parsedBody.success && Array.isArray(parsedBody.data.ids)
      ? Array.from(new Set(parsedBody.data.ids.filter((id) => id.length > 0)))
      : [];

    if (ids.length === 0) {
      return NextResponse.json({ success: false, error: "ids is required" }, { status: 400 });
    }

    const retry = parsedBody.success && parsedBody.data.retry === true;
    const queue = ids.slice(0, MAX_IDS_PER_REQUEST);
    const results: HydrateResult[] = [];

    async function worker() {
      for (;;) {
        const id = queue.shift();
        if (!id) return;
        try {
          const job = await prisma.job.findFirst({
            where: { id, ...sharedOrSelfJobWhere(userId) },
          });
          if (!job) {
            results.push(HydrateResultSchema.parse({ id, status: "skipped" }));
            continue;
          }
          if (job.userId != null && job.userId !== userId) {
            results.push(HydrateResultSchema.parse({ id, status: "skipped" }));
            continue;
          }
          if (isPlaceholderDescription(job.rawDescription) && job.extractFailure && !retry) {
            const detail = buildHydratedJobDetail(job, {
              requirementsStatus: "unavailable",
            });
            results.push(HydrateResultSchema.parse({ id, status: "skipped", job: detail }));
            continue;
          }
          const res = await fetchAndCacheJobFullText(id, { viewerUserId: userId });
          if (res.success && res.data) {
            const detail = buildHydratedJobDetail(res.data);
            const status = res.cached && !res.requirementsUpdated ? "cached" : "ok";
            results.push(
              HydrateResultSchema.parse({
                id,
                status,
                rawDescription: detail.rawDescription,
                job: detail,
              })
            );
          } else {
            const detail = res.data
              ? buildHydratedJobDetail(res.data, {
                  requirementsStatus: isPlaceholderDescription(res.data.rawDescription)
                    ? "unavailable"
                    : undefined,
                  extractFailure: res.failureCode ?? res.data.extractFailure ?? "failed",
                })
              : undefined;
            results.push(
              HydrateResultSchema.parse({
                id,
                status: "failed",
                ...(detail ? { job: detail } : {}),
              })
            );
          }
        } catch {
          results.push(HydrateResultSchema.parse({ id, status: "failed" }));
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
