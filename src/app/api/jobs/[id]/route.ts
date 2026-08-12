import { NextResponse } from "next/server";
import { z } from "zod";
import { getJobById, updateJob } from "@/lib/db/jobs";
import { JobRequirementsSchema } from "@/lib/jd-parser/types";
import { sanitizeError } from "@/lib/ai/redact";

const UpdateJobSchema = z.object({
  company: z.string().optional(),
  roleTitle: z.string().optional(),
  rawDescription: z.string().min(1).optional(),
  extractedRequirements: JobRequirementsSchema.optional(),
  status: z.enum(["SAVED", "APPLIED", "INTERVIEWING", "OFFER", "REJECTED", "ARCHIVED"]).optional(),
  appliedAt: z.union([z.string(), z.date(), z.null()]).optional(),
  notes: z.union([z.string(), z.null()]).optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const job = await getJobById(id);

    if (!job) {
      return NextResponse.json(
        { success: false, error: "Job posting not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: job });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch job", message: sanitizeError(err) },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const validation = UpdateJobSchema.safeParse(body);
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

    const updatedJob = await updateJob(id, validation.data);
    if (!updatedJob) {
      return NextResponse.json(
        { success: false, error: "Job posting not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: updatedJob });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: "Failed to update job", message: sanitizeError(err) },
      { status: 500 }
    );
  }
}
