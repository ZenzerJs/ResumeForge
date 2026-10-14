import { prisma } from "@/lib/prisma";
import { extractResumeFacts } from "@/lib/facts/extract";
import { checkGuardrail } from "@/lib/guardrail/check";
import { assertCanApplyPatches, assertCanExport } from "@/lib/guardrail/policy";
import { verifyEvidenceCitations, type PatchProposal } from "@/lib/ai/patch-schema";
import { evaluateAtsScore } from "@/lib/ats-evaluator/evaluator";
import { generateAtsDocx } from "@/lib/export/docx";
import {
  AllowlistedToolName,
  GetResumeFactsParamsSchema,
  RunGuardrailParamsSchema,
  GetAtsScoreParamsSchema,
  GetJobParamsSchema,
  SearchSavedJobsParamsSchema,
  ApplyPatchesParamsSchema,
  ExportDocxParamsSchema,
} from "./definitions";

export interface ToolExecutionResult {
  tool: string;
  success: boolean;
  data?: any;
  error?: string;
}

function requireOwner(userId: string | undefined): string {
  if (!userId) {
    throw new Error("Sign in required.");
  }
  return userId;
}

/**
 * Server-side tool execution dispatcher.
 * Validates against allowlisted schemas and enforces guardrail safety gates.
 */
export async function executeServerTool(
  toolName: AllowlistedToolName,
  rawParams: unknown,
  userId?: string
): Promise<ToolExecutionResult> {
  try {
    switch (toolName) {
      case "get_resume_facts": {
        const params = GetResumeFactsParamsSchema.parse(rawParams);
        let typstSource = params.typstSource || "";

        const ownerId = requireOwner(userId);
        if (params.resumeId) {
          const res = await prisma.resume.findFirst({
            where: { id: params.resumeId, userId: ownerId },
          });
          if (res) typstSource = res.typstSource;
        }

        const evidence = await prisma.evidenceItem.findMany({
          where: { status: "verified", userId: ownerId },
          include: { bullets: true },
        });

        const facts = extractResumeFacts(typstSource, evidence as any);
        return { tool: toolName, success: true, data: facts };
      }

      case "run_guardrail": {
        const params = RunGuardrailParamsSchema.parse(rawParams);
        let masterFacts = params.masterFacts;

        if (!masterFacts) {
          const ownerId = requireOwner(userId);
          const master = await prisma.resume.findFirst({
            where: { isMaster: true, userId: ownerId },
          });
          const evidence = await prisma.evidenceItem.findMany({
            where: { status: "verified", userId: ownerId },
            include: { bullets: true },
          });
          masterFacts = extractResumeFacts(master?.typstSource || "", evidence as any);
        }

        const guardrailResult = checkGuardrail(params.candidateTypst, masterFacts, {
          patches: params.patches,
        });

        return { tool: toolName, success: true, data: guardrailResult };
      }

      case "get_ats_score": {
        const params = GetAtsScoreParamsSchema.parse(rawParams);
        const scoreResult = evaluateAtsScore(
          params.typstContent,
          params.requirements,
          params.roleProfile
        );
        return { tool: toolName, success: true, data: scoreResult };
      }

      case "get_job": {
        const params = GetJobParamsSchema.parse(rawParams);
        const ownerId = requireOwner(userId);
        const job = await prisma.job.findFirst({
          where: { id: params.jobId, userId: ownerId },
        });
        if (!job) {
          return { tool: toolName, success: false, error: `Job not found: ${params.jobId}` };
        }
        return { tool: toolName, success: true, data: job };
      }

      case "search_saved_jobs": {
        const params = SearchSavedJobsParamsSchema.parse(rawParams);
        const ownerId = requireOwner(userId);
        const jobs = await prisma.job.findMany({
          where: {
            userId: ownerId,
            status: params.status ? params.status : undefined,
          },
          orderBy: { createdAt: "desc" },
          take: 50,
        });

        const filtered = params.search
          ? jobs.filter(
              (j) =>
                (j.company || "").toLowerCase().includes(params.search!.toLowerCase()) ||
                (j.roleTitle || "").toLowerCase().includes(params.search!.toLowerCase())
            )
          : jobs;

        return { tool: toolName, success: true, data: filtered };
      }

      case "apply_patches": {
        const params = ApplyPatchesParamsSchema.parse(rawParams);
        const ownerId = requireOwner(userId);
        let updatedTypst = params.currentTypst;

        const master = await prisma.resume.findFirst({
          where: { isMaster: true, userId: ownerId },
        });
        const evidence = await prisma.evidenceItem.findMany({
          where: { status: "verified", userId: ownerId },
          include: { bullets: true },
        });
        const masterFacts = extractResumeFacts(master?.typstSource || "", evidence as any);
        const validEvidenceIds = new Set(evidence.map((item) => item.id));
        const validBulletIds = new Set(evidence.flatMap((item) => item.bullets.map((bullet) => bullet.id)));

        const proposals: PatchProposal[] = params.acceptedPatches.map((patch) => ({
          id: patch.id,
          operation: patch.operation ?? "MODIFY_BULLET",
          targetSection: "experience",
          before: patch.before,
          after: patch.after,
          evidenceIds: patch.evidenceIds ?? [],
          rationale: patch.rationale ?? "",
          confidence: 1,
        }));

        const verification = verifyEvidenceCitations(
          { patches: proposals, gaps: [] },
          validEvidenceIds,
          validBulletIds
        );
        const allowedIds = new Set(verification.verified.map((patch) => patch.id));
        if (verification.verified.length > 0) {
          assertCanApplyPatches(params.currentTypst, masterFacts, verification.verified);
        }

        let appliedCount = 0;
        for (const patch of params.acceptedPatches) {
          if (!params.patchIds.includes(patch.id) || !allowedIds.has(patch.id)) continue;
          if (patch.before && updatedTypst.includes(patch.before)) {
            updatedTypst = updatedTypst.replace(patch.before, patch.after);
            appliedCount += 1;
          }
        }

        return {
          tool: toolName,
          success: true,
          data: {
            updatedTypst,
            appliedCount,
            rejected: verification.rejected.map((item) => ({
              id: item.patch.id,
              reason: item.reason,
            })),
          },
        };
      }

      case "export_docx": {
        const params = ExportDocxParamsSchema.parse(rawParams);
        assertCanExport(params.typstSource, params.masterFacts);

        const docxBytes = await generateAtsDocx(params.typstSource, {
          facts: params.masterFacts,
        });

        return {
          tool: toolName,
          success: true,
          data: {
            byteLength: docxBytes.length,
            format: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          },
        };
      }

      case "search_evidence": {
        const params = (await import("./definitions")).SearchEvidenceParamsSchema.parse(rawParams);
        const whereClause: { userId: string; status?: string } = { userId: requireOwner(userId) };
        if (params.status && params.status !== "all") {
          whereClause.status = params.status;
        }

        const items = await prisma.evidenceItem.findMany({
          where: whereClause,
          include: { bullets: true },
        });

        const queryTokens = params.query.toLowerCase().split(/\s+/).filter(Boolean);
        const scoredItems = items.map((item) => {
          let score = 0;
          let parsedTags: string[] = [];
          try {
            parsedTags = JSON.parse(item.tags || "[]");
          } catch {
            parsedTags = [];
          }

          const searchCorpus = [
            item.title,
            item.organization || "",
            item.verifiedSummary,
            ...parsedTags,
            ...item.bullets.map((b) => `${b.text} ${b.technologies} ${b.roleAffinity}`),
          ]
            .join(" ")
            .toLowerCase();

          for (const token of queryTokens) {
            if (searchCorpus.includes(token)) {
              score += 2;
            }
          }

          if (params.tags && params.tags.length > 0) {
            const hasTag = params.tags.some((tag) =>
              parsedTags.some((t) => t.toLowerCase() === tag.toLowerCase())
            );
            if (hasTag) score += 3;
          }

          return { item, score };
        });

        const ranked = scoredItems
          .filter((si) => si.score > 0 || queryTokens.length === 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, params.limit)
          .map((si) => si.item);

        return {
          tool: toolName,
          success: true,
          data: {
            count: ranked.length,
            results: ranked,
          },
        };
      }

      case "inspect_layout_budget": {
        const params = (await import("./definitions")).InspectLayoutBudgetParamsSchema.parse(rawParams);
        const lines = params.typstSource.split("\n");
        const nonEmptyLines = lines.filter((l) => l.trim().length > 0);
        const totalChars = params.typstSource.length;
        const bulletLines = lines.filter((l) => l.trim().startsWith("-") || l.trim().startsWith("•"));

        // Approximate Typst layout budget (standard 10pt letter page fits ~55 lines or ~3200 chars)
        const estimatedPages = Math.max(1, Math.ceil(nonEmptyLines.length / 55));
        const pageLimit = params.pageLimit || 1;
        const exceedsLimit = estimatedPages > pageLimit;

        return {
          tool: toolName,
          success: true,
          data: {
            lineCount: lines.length,
            nonEmptyLineCount: nonEmptyLines.length,
            characterCount: totalChars,
            bulletCount: bulletLines.length,
            estimatedPages,
            pageLimit,
            exceedsLimit,
            status: exceedsLimit ? "OVERFLOW" : "WITHIN_BUDGET",
            recommendation: exceedsLimit
              ? `Estimated ${estimatedPages} pages exceeds limit of ${pageLimit}. Recommend trimming ${nonEmptyLines.length - 55 * pageLimit} lines.`
              : `Within budget (${nonEmptyLines.length}/55 lines for single page layout).`,
          },
        };
      }

      default:
        return {
          tool: toolName,
          success: false,
          error: `Unsupported tool: ${toolName}`,
        };
    }
  } catch (err) {
    return {
      tool: toolName,
      success: false,
      error:
        err instanceof Error && err.message === "Sign in required."
          ? err.message
          : "Tool failed",
    };
  }
}
