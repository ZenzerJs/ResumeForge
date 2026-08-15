import { prisma } from "@/lib/prisma";
import { extractResumeFacts } from "@/lib/facts/extract";
import { checkGuardrail } from "@/lib/guardrail/check";
import { assertCanApplyPatches, assertCanExport } from "@/lib/guardrail/policy";
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

        if (params.resumeId) {
          const res = await prisma.resume.findFirst({
            where: { id: params.resumeId, ...(userId ? { userId } : {}) },
          });
          if (res) typstSource = res.typstSource;
        }

        const evidence = await prisma.evidenceItem.findMany({
          where: { status: "verified", ...(userId ? { userId } : {}) },
          include: { bullets: true },
        });

        const facts = extractResumeFacts(typstSource, evidence as any);
        return { tool: toolName, success: true, data: facts };
      }

      case "run_guardrail": {
        const params = RunGuardrailParamsSchema.parse(rawParams);
        let masterFacts = params.masterFacts;

        if (!masterFacts) {
          const master = await prisma.resume.findFirst({
            where: { isMaster: true, ...(userId ? { userId } : {}) },
          });
          const evidence = await prisma.evidenceItem.findMany({
            where: { status: "verified", ...(userId ? { userId } : {}) },
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
        const job = await prisma.job.findUnique({
          where: { id: params.jobId },
        });
        if (!job) {
          return { tool: toolName, success: false, error: `Job not found: ${params.jobId}` };
        }
        return { tool: toolName, success: true, data: job };
      }

      case "search_saved_jobs": {
        const params = SearchSavedJobsParamsSchema.parse(rawParams);
        const jobs = await prisma.job.findMany({
          where: {
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
        let updatedTypst = params.currentTypst;

        // Guardrail Gate: verify patches before applying
        if (params.masterFacts) {
          assertCanApplyPatches(params.currentTypst, params.masterFacts, params.acceptedPatches);
        }

        for (const patch of params.acceptedPatches) {
          if (params.patchIds.includes(patch.id)) {
            if (patch.before && updatedTypst.includes(patch.before)) {
              updatedTypst = updatedTypst.replace(patch.before, patch.after);
            }
          }
        }

        return {
          tool: toolName,
          success: true,
          data: {
            updatedTypst,
            appliedCount: params.acceptedPatches.filter((p) => params.patchIds.includes(p.id)).length,
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
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
