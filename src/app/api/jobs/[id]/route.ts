import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteJob, getJobById, JobDeleteConflictError, updateJob } from "@/lib/db/jobs";
import { ApplicationInputError, upsertApplication } from "@/lib/db/applications";
import { JobRequirementsSchema } from "@/lib/jd-parser/types";
import { sanitizeError } from "@/lib/ai/redact";
import { prisma } from "@/lib/prisma";
import { getRequestUserId, requireUserId } from "@/lib/security/auth-request";

function isForeignKeyConstraintError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === "P2003"
  );
}

const UpdateJobSchema = z.object({
  company: z.string().optional(),
  roleTitle: z.string().optional(),
  rawDescription: z.string().min(1).optional(),
  extractedRequirements: JobRequirementsSchema.optional(),
  status: z.enum(["SAVED", "APPLIED", "INTERVIEWING", "OFFER", "REJECTED", "ARCHIVED"]).optional(),
  appliedAt: z.union([z.string(), z.date(), z.null()]).optional(),
  variantId: z.string().nullable().optional(),
  notes: z.union([z.string(), z.null()]).optional(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const viewerUserId = await getRequestUserId(request);
    const { id } = await params;
    const job = await getJobById(id, viewerUserId);

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
    const userId = await requireUserId(request);
    if (userId instanceof NextResponse) return userId;

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

    const { status, appliedAt, variantId, ...catalog } = validation.data;
    const hasApplicationUpdate =
      status !== undefined || appliedAt !== undefined || variantId !== undefined;
    const hasCatalogUpdate = Object.values(catalog).some((value) => value !== undefined);

    const job = await prisma.$transaction(async (tx) => {
      if (hasCatalogUpdate) {
        const ownedJob = await tx.job.findFirst({
          where: { id, userId },
          select: { id: true },
        });
        if (!ownedJob) return null;
      } else {
        const visibleJob = await tx.job.findFirst({
          where: { id, OR: [{ userId: null }, { userId }] },
          select: { id: true },
        });
        if (!visibleJob) return null;
      }

      if (hasApplicationUpdate) {
        const application = await upsertApplication(userId, id, { status, appliedAt, variantId }, tx);
        if (!application) return null;
      }

      if (hasCatalogUpdate) {
        const updatedJob = await updateJob(id, catalog, userId, tx);
        if (!updatedJob) return null;
      }

      return getJobById(id, userId, tx);
    });

    if (!job) {
      return NextResponse.json({ success: false, error: "Job posting not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: job });
  } catch (err) {
    if (err instanceof ApplicationInputError) {
      return NextResponse.json({ success: false, error: err.message }, { status: 400 });
    }
    return NextResponse.json(
      { success: false, error: "Failed to update job", message: sanitizeError(err) },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireUserId(request);
    if (userId instanceof NextResponse) return userId;

    const { id } = await params;
    try {
      await deleteJob(id, userId);
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "Job not found") {
        return NextResponse.json(
          { success: false, error: "Job posting not found" },
          { status: 404 }
        );
      }
      if (err instanceof JobDeleteConflictError || isForeignKeyConstraintError(err)) {
        return NextResponse.json(
          {
            success: false,
            error: "Cannot delete this job posting because it is referenced by existing history.",
          },
          { status: 409 }
        );
      }
      throw err;
    }

    return NextResponse.json({ success: true, message: "Job posting deleted" });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: "Failed to delete job", message: sanitizeError(err) },
      { status: 500 }
    );
  }
}
