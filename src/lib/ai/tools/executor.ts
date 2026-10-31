import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { extractResumeFacts } from "@/lib/facts/extract";
import { checkGuardrail } from "@/lib/guardrail/check";
import {
  assertCanExport,
} from "@/lib/guardrail/policy";
import { applyProposalBatch } from "@/lib/ai/patch-batches";
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
          if (!res) {
            return { tool: toolName, success: false, error: "Resume not found" };
          }
          typstSource = res.typstSource;
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
        let job = await prisma.job.findFirst({
          where: { id: params.jobId, userId: ownerId },
        });
        if (!job) {
          job = await prisma.job.findFirst({
            where: {
              id: params.jobId,
              userId: null,
              applications: { some: { userId: ownerId } },
            },
          });
        }
        if (!job) {
          return { tool: toolName, success: false, error: `Job not found: ${params.jobId}` };
        }
        return {
          tool: toolName,
          success: true,
          data: {
            id: job.id,
            title: (job as any).title ?? job.roleTitle,
            company: job.company,
            status: job.status,
            notes: job.notes,
            rawDescription: job.rawDescription,
            parsedRequirements: (job as any).parsedRequirements ?? (job as any).extractedRequirements,
          },
        };
      }

      case "search_saved_jobs": {
        const params = SearchSavedJobsParamsSchema.parse(rawParams);
        const ownerId = requireOwner(userId);
        const queryText = params.search?.trim();
        const filters: Prisma.JobWhereInput[] = [{
          OR: [
            { userId: ownerId },
            { userId: null, applications: { some: { userId: ownerId } } },
          ],
        }];
        if (queryText) {
          filters.push({ OR: [
            { roleTitle: { contains: queryText, mode: "insensitive" } },
            { company: { contains: queryText, mode: "insensitive" } },
          ] });
        }
        if (params.status) {
          filters.push({
            OR: [
              { applications: { some: { userId: ownerId, status: params.status } } },
              {
                AND: [
                  { userId: ownerId },
                  { applications: { none: { userId: ownerId } } },
                  { status: params.status },
                ],
              },
            ],
          });
        }
        const jobs = await prisma.job.findMany({
          where: { AND: filters },
          include: { applications: { where: { userId: ownerId }, select: { status: true } } },
          orderBy: [{ createdAt: "desc" }, { id: "asc" }],
          take: 10,
        });

        return {
          tool: toolName,
          success: true,
          data: {
            jobs: jobs.map((j) => ({
              id: j.id,
              title: j.roleTitle,
              company: j.company,
              status: j.applications[0]?.status ?? j.status,
              createdAt: j.createdAt,
              hasAnalysis: Boolean(j.extractedRequirements),
            })),
            count: jobs.length,
          },
        };
      }

      case "apply_patches": {
        const params = ApplyPatchesParamsSchema.parse(rawParams);
        const ownerId = requireOwner(userId);
        const data = await applyProposalBatch({ userId: ownerId, ...params });
        return {
          tool: toolName,
          success: true,
          data,
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
        const bulletLines = lines.filter((l) => l.trim().startsWith("-") || l.trim().startsWith("â€¢"));

        return {
          tool: toolName,
          success: true,
          data: {
            lineCount: lines.length,
            nonEmptyLineCount: nonEmptyLines.length,
            characterCount: totalChars,
            bulletCount: bulletLines.length,
            estimatedPages: null,
            pageLimit: params.pageLimit,
            exceedsLimit: null,
            measured: false,
            status: "NOT_MEASURED",
            recommendation: "Open the resume preview to compile and measure its actual page count. Source length does not establish page fit.",
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
