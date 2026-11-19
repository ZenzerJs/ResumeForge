import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/security/auth-request";
import { extractResumeFacts } from "@/lib/facts/extract";
import { sanitizeError } from "@/lib/ai/redact";
import { GuestEvidenceItemSchema } from "@/lib/guest-evidence";

const MigrateGuestDraftsSchema = z
  .object({
    typstSource: z.string().min(1, "typstSource is required").max(500_000).optional(),
    evidenceOnly: z.boolean().optional(),
    title: z.string().max(100).optional(),
    conflictStrategy: z
      .enum(["IMPORT_AS_DRAFT", "REPLACE_MASTER", "DISCARD"])
      .default("IMPORT_AS_DRAFT"),
    confirmReplaceMaster: z.boolean().optional(),
    evidenceItems: z.array(GuestEvidenceItemSchema).max(50).optional(),
    migrationId: z.string().uuid().optional(),
    idempotencyKey: z.string().max(100).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.conflictStrategy === "DISCARD") return;
    const hasTypstSource = Boolean(data.typstSource && data.typstSource.trim().length > 0);
    const hasEvidenceItems = Boolean(data.evidenceItems && data.evidenceItems.length > 0);
    if (data.evidenceOnly) {
      if (!hasEvidenceItems) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["evidenceItems"],
          message: "evidenceItems is required when evidenceOnly is true",
        });
      }
      return;
    }
    if (!hasTypstSource && !hasEvidenceItems) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["typstSource"],
        message: "typstSource or non-empty evidenceItems is required",
      });
    }
  });

export async function POST(request: Request) {
  try {
    const userId = await requireUserId(request);
    if (userId instanceof NextResponse) return userId;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON request body" },
        { status: 400 }
      );
    }

    const validation = MigrateGuestDraftsSchema.safeParse(body);
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

    const {
      typstSource,
      evidenceOnly,
      title,
      conflictStrategy,
      confirmReplaceMaster,
      evidenceItems = [],
      migrationId,
    } = validation.data;

    // Handle DISCARD strategy immediately
    if (conflictStrategy === "DISCARD") {
      return NextResponse.json({
        success: true,
        data: {
          resumeId: null,
          isMaster: false,
          evidenceCount: 0,
          skippedDuplicateCount: 0,
          strategyApplied: "DISCARD",
          historySnapshotCreated: false,
          migrationId: migrationId || null,
          discarded: true,
        },
      });
    }

    const trimmedTypstSource = typstSource?.trim() ?? "";
    const shouldCreateResume = !evidenceOnly && trimmedTypstSource.length > 0;

    // 1. Look up existing master for userId when creating a resume
    const existingMaster = shouldCreateResume
      ? await prisma.resume.findFirst({
          where: { userId, isMaster: true },
        })
      : null;

    // 2. REPLACE_MASTER SAFETY GATE
    if (shouldCreateResume && conflictStrategy === "REPLACE_MASTER" && existingMaster && confirmReplaceMaster !== true) {
      return NextResponse.json(
        {
          success: false,
          error: "CONFIRMATION_REQUIRED",
          message: "Explicit confirmReplaceMaster confirmation is required to overwrite the existing Master Resume.",
        },
        { status: 400 }
      );
    }

    // 3. IDEMPOTENCY / REPLAY SAFETY
    const existingMatch =
      migrationId && shouldCreateResume
        ? await prisma.resume.findFirst({
            where: { userId, typstSource: trimmedTypstSource },
          })
        : null;

    if (existingMatch && evidenceItems.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          resumeId: existingMatch.id,
          isMaster: existingMatch.isMaster,
          evidenceCount: 0,
          skippedDuplicateCount: 0,
          strategyApplied: conflictStrategy,
          historySnapshotCreated: false,
          migrationId,
        },
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      let createdResumeId: string | null = null;
      let targetIsMaster = false;
      let resumeTitle = title || "Imported Guest Draft";
      let historySnapshotCreated = false;

      if (existingMatch) {
        createdResumeId = existingMatch.id;
        targetIsMaster = existingMatch.isMaster;
      } else if (shouldCreateResume && trimmedTypstSource) {
        if (!existingMaster) {
          // No existing master -> new resume becomes master baseline
          targetIsMaster = true;
          resumeTitle = title || "Master Resume";
        } else {
          if (conflictStrategy === "REPLACE_MASTER") {
            // Pre-write snapshot of previous master before un-mastering
            await tx.masterHistory.create({
              data: {
                resumeId: existingMaster.id,
                title: existingMaster.title,
                typstSource: existingMaster.typstSource,
                reason: "GUEST_MIGRATION_OVERWRITE",
              },
            });
            historySnapshotCreated = true;

            // Un-master existing master
            await tx.resume.updateMany({
              where: { userId, isMaster: true },
              data: { isMaster: false },
            });
            targetIsMaster = true;
            resumeTitle = title || "Master Resume";
          } else {
            // Default: IMPORT_AS_DRAFT (keep master safe)
            targetIsMaster = false;
            resumeTitle = title || "Imported Guest Draft";
          }
        }
      }

      // Migrate any provided evidenceItems first so factSnapshot includes their verified IDs, skills, and metrics
      let evidenceCount = 0;
      let skippedDuplicateCount = 0;

      if (evidenceItems.length > 0) {
        const existingEvidence = await tx.evidenceItem.findMany({
          where: { userId },
          select: { title: true },
        });
        const existingTitles = new Set(existingEvidence.map((e) => e.title.toLowerCase().trim()));

        for (const item of evidenceItems) {
          const normTitle = item.title.toLowerCase().trim();
          if (existingTitles.has(normTitle)) {
            skippedDuplicateCount++;
            continue;
          }

          const bullets = (item.bullets ?? []).map((bullet) =>
            typeof bullet === "string" ? { text: bullet } : bullet
          );
          const summaryBullet = item.status === "verified"
            ? bullets.find((bullet) => bullet.verified)
            : bullets[0];
          const createdItem = await tx.evidenceItem.create({
            data: {
              userId,
              type: (item.category || "project").toLowerCase(),
              title: item.title,
              organization: item.organization || null,
              dates: item.dates ?? null,
              verifiedSummary: item.verifiedSummary ?? (summaryBullet?.text || item.title),
              tags: JSON.stringify(item.tags || []),
              status: item.status ?? "draft",
            },
          });

          if (bullets.length > 0) {
            await tx.bullet.createMany({
              data: bullets.map((bullet, index) => ({
                evidenceId: createdItem.id,
                text: bullet.text,
                technologies: JSON.stringify(bullet.technologies ?? []),
                roleAffinity: JSON.stringify(bullet.roleAffinity ?? []),
                verified: bullet.verified ?? false,
                orderIndex: bullet.orderIndex ?? index,
              })),
            });
          }

          existingTitles.add(normTitle);
          evidenceCount++;
        }
      }

      if (!existingMatch && shouldCreateResume && trimmedTypstSource) {
        const allVerifiedEvidence = targetIsMaster
          ? await tx.evidenceItem.findMany({
              where: { userId, status: "verified" },
              include: {
                bullets: {
                  where: { verified: true },
                  orderBy: { orderIndex: "asc" },
                },
              },
            })
          : [];

        const factSnapshot = targetIsMaster
          ? (extractResumeFacts(trimmedTypstSource, allVerifiedEvidence) as unknown as Prisma.InputJsonValue)
          : undefined;

        const createdResume = await tx.resume.create({
          data: {
            userId,
            title: resumeTitle,
            typstSource: trimmedTypstSource,
            isMaster: targetIsMaster,
            isProtected: targetIsMaster,
            factSnapshot,
          },
        });
        createdResumeId = createdResume.id;
      }

      return {
        resumeId: createdResumeId,
        isMaster: targetIsMaster,
        evidenceCount,
        skippedDuplicateCount,
        strategyApplied: conflictStrategy,
        historySnapshotCreated,
        migrationId: migrationId || null,
      };
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: "Failed to migrate guest drafts", message: sanitizeError(err) },
      { status: 500 }
    );
  }
}
