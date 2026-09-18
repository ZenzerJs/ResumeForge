import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/security/auth-request";
import { extractResumeFacts } from "@/lib/facts/extract";
import { sanitizeError } from "@/lib/ai/redact";

const MigrateGuestDraftsSchema = z.object({
  typstSource: z.string().min(1, "typstSource is required").max(500_000),
  title: z.string().max(100).optional(),
  conflictStrategy: z
    .enum(["IMPORT_AS_DRAFT", "REPLACE_MASTER", "DISCARD"])
    .default("IMPORT_AS_DRAFT"),
  confirmReplaceMaster: z.boolean().optional(),
  evidenceItems: z
    .array(
      z.object({
        title: z.string().min(1),
        organization: z.string().optional(),
        category: z.string().default("PROJECT"),
        tags: z.array(z.string()).optional(),
        bullets: z.array(z.string()).optional(),
      })
    )
    .max(50)
    .optional(),
  migrationId: z.string().uuid().optional(),
  idempotencyKey: z.string().max(100).optional(),
});

export async function POST(request: Request) {
  try {
    const userId = await requireUserId(request);
    if (userId instanceof NextResponse) return userId;

    let body: any;
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

    // 1. Look up existing master for userId
    const existingMaster = await prisma.resume.findFirst({
      where: { userId, isMaster: true },
    });

    // 2. REPLACE_MASTER SAFETY GATE
    if (conflictStrategy === "REPLACE_MASTER" && existingMaster && confirmReplaceMaster !== true) {
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
    if (migrationId) {
      const existingMatch = await prisma.resume.findFirst({
        where: { userId, typstSource: typstSource.trim() },
      });
      if (existingMatch) {
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
    }

    const result = await prisma.$transaction(async (tx) => {
      let targetIsMaster = false;
      let resumeTitle = title || "Imported Guest Draft";
      let historySnapshotCreated = false;

      if (!existingMaster) {
        // No existing master -> new resume becomes master baseline
        targetIsMaster = true;
        resumeTitle = title || "Master Resume";
      } else {
        if (conflictStrategy === "REPLACE_MASTER") {
          // Pre-write snapshot of previous master before un-mastering
          await (tx as any).masterHistory.create({
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

      const factSnapshot = targetIsMaster ? (extractResumeFacts(typstSource) as any) : undefined;

      const createdResume = await tx.resume.create({
        data: {
          userId,
          title: resumeTitle,
          typstSource,
          isMaster: targetIsMaster,
          isProtected: targetIsMaster,
          factSnapshot,
        },
      });

      // Migrate any provided evidenceItems, deduplicating against existing titles for this user
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

          const createdItem = await tx.evidenceItem.create({
            data: {
              userId,
              type: (item.category || "project").toLowerCase(),
              title: item.title,
              organization: item.organization || null,
              verifiedSummary: item.bullets?.[0] || item.title,
              tags: JSON.stringify(item.tags || []),
              status: "verified",
            },
          });

          if (item.bullets && item.bullets.length > 0) {
            await tx.bullet.createMany({
              data: item.bullets.map((bulletText, idx) => ({
                evidenceId: createdItem.id,
                text: bulletText,
                technologies: JSON.stringify(item.tags || []),
                roleAffinity: "[]",
                verified: true,
                orderIndex: idx,
              })),
            });
          }

          existingTitles.add(normTitle);
          evidenceCount++;
        }
      }

      return {
        resumeId: createdResume.id,
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
