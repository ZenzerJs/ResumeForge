import { NextResponse } from "next/server";
import { CreateJobSchema } from "@/lib/jd-parser/types";
import { createJob, getJobsList, type JobStatus } from "@/lib/db/jobs";
import { sanitizeError } from "@/lib/ai/redact";
import { isPostedWithinParam } from "@/lib/jobs/posted-within";
import { isWorkplaceFilter } from "@/lib/ingestion/helpers";
import { getRequestUserId, requireUserId } from "@/lib/security/auth-request";

const JOB_STATUSES: JobStatus[] = [
  "SAVED",
  "APPLIED",
  "INTERVIEWING",
  "OFFER",
  "REJECTED",
  "ARCHIVED",
];

function parseStatusParam(raw: string | null): JobStatus | JobStatus[] | "ALL" | undefined {
  if (!raw || raw === "ALL") return "ALL";
  const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
  const valid = parts.filter((s): s is JobStatus => JOB_STATUSES.includes(s as JobStatus));
  if (valid.length === 0) return "ALL";
  return valid.length === 1 ? valid[0] : valid;
}

export async function GET(request: Request) {
  try {
    const viewerUserId = await getRequestUserId(request);
    const url = new URL(request.url);
    const page = Number(url.searchParams.get("page") || "1");
    const limit = Number(url.searchParams.get("limit") || "40");
    const q = url.searchParams.get("q") || undefined;
    const location = url.searchParams.get("location") || undefined;
    const postedRaw = url.searchParams.get("postedWithin");
    const workplaceRaw = url.searchParams.get("workplace");
    const result = await getJobsList({
      page: Number.isFinite(page) ? page : 1,
      limit: Number.isFinite(limit) ? limit : 40,
      q,
      location,
      workplace: isWorkplaceFilter(workplaceRaw) ? workplaceRaw : "all",
      status: parseStatusParam(url.searchParams.get("status")),
      postedWithin: isPostedWithinParam(postedRaw) ? postedRaw : "all",
      userId: viewerUserId,
    });
    return NextResponse.json({
      success: true,
      data: result.data,
      meta: result.meta,
      guest: !viewerUserId,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch jobs", message: sanitizeError(err) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const gated = await requireUserId(request);
    if (gated instanceof NextResponse) return gated;

    const body = await request.json();
    const validation = CreateJobSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request payload",
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const job = await createJob({ ...validation.data });
    return NextResponse.json({ success: true, data: job }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: "Failed to create job", message: sanitizeError(err) },
      { status: 500 }
    );
  }
}
