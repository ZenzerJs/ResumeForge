import { NextResponse } from "next/server";
import { CreateJobSchema } from "@/lib/jd-parser/types";
import { createJob, getJobsList, type JobStatus } from "@/lib/db/jobs";
import { sanitizeError } from "@/lib/ai/redact";
import { isPostedWithinParam } from "@/lib/jobs/posted-within";
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
    const userId = await getRequestUserId(request);
    if (!userId) {
      return NextResponse.json({
        success: true,
        data: [],
        guest: true,
        meta: { page: 1, limit: 40, total: 0, totalPages: 1 },
      });
    }
    const url = new URL(request.url);
    const page = Number(url.searchParams.get("page") || "1");
    const limit = Number(url.searchParams.get("limit") || "40");
    const q = url.searchParams.get("q") || undefined;
    const postedRaw = url.searchParams.get("postedWithin");
    const result = await getJobsList({
      page: Number.isFinite(page) ? page : 1,
      limit: Number.isFinite(limit) ? limit : 40,
      q,
      status: parseStatusParam(url.searchParams.get("status")),
      postedWithin: isPostedWithinParam(postedRaw) ? postedRaw : "all",
      userId,
    });
    return NextResponse.json({ success: true, data: result.data, meta: result.meta });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch jobs", message: sanitizeError(err) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireUserId(request);
    if (userId instanceof NextResponse) return userId;

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

    const job = await createJob({ ...validation.data, userId });
    return NextResponse.json({ success: true, data: job }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: "Failed to create job", message: sanitizeError(err) },
      { status: 500 }
    );
  }
}
