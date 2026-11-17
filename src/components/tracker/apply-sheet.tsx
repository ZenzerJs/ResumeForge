"use client";

import React, { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Briefcase,
  ShieldCheck,
  Download,
  ExternalLink,
  FileText,
  Sparkles,
  CheckCircle2,
  BarChart3,
  Loader2,
  AlertCircle,
  Package,
} from "lucide-react";
import { GuardrailFeedback } from "@/components/ui/guardrail-feedback";
import { GuardrailResult } from "@/lib/guardrail/types";
import { checkGuardrail } from "@/lib/guardrail/check";
import { assertCanExport } from "@/lib/guardrail/policy";
import { assertCanApplyPatches, markDocumentAsPatched } from "@/lib/guardrail/policy";
import { applyPatchProposals } from "@/lib/ai/patch-application";
import type { PatchProposal } from "@/lib/ai/patch-schema";
import { evaluateAtsScore } from "@/lib/ats-evaluator/evaluator";
import { AtsEvaluationResult } from "@/lib/ats-evaluator/types";
import { generateAtsDocx } from "@/lib/export/docx";
import { generateApplicationPackageZip, sanitizeZipFilename } from "@/lib/export/zip";
import { compileTypstToPdf } from "@/lib/typst/compiler";
import { ResumeFacts } from "@/lib/facts/types";
import { resolveClientProviderConfig } from "@/lib/byok-vault";
import { getDemoContextFromBrowser } from "@/lib/demo-client";
import type { Gap } from "@/lib/ai/patch-schema";
import { fetchDemoConfig } from "@/components/auth/session-user";
import { downloadBlob } from "@/lib/utils";
import { readApiResponse, parseApiError } from "@/lib/api-error";
import { parseJobDescription } from "@/lib/jd-parser/parser";

export interface TrackerJobItem {
  id: string;
  company: string;
  roleTitle: string;
  jobUrl?: string | null;
  status: string;
  variants?: { id: string; variantTitle: string }[];
  appliedVariantId?: string | null;
  source?: string;
  location?: string | null;
  salarySnippet?: string | null;
  rawDescription?: string | null;
  requirements?: {
    requiredSkills: string[];
    preferredSkills: string[];
    domainTerms: string[];
  } | null;
}

interface ApplySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: TrackerJobItem | null;
  masterTypst?: string;
  masterFacts?: ResumeFacts | null;
  onVariantChange?: (jobId: string, variantId: string | null) => void;
}

type ApplyStep = "load" | "tailor" | "guardrail" | "score" | "export";
type PatchReviewDecision = "pending" | "accepted" | "rejected";

export function selectAcceptedPatchProposals(
  proposals: PatchProposal[],
  decisions: Record<string, PatchReviewDecision>
): PatchProposal[] {
  return proposals.filter((proposal) => decisions[proposal.id] === "accepted");
}

export function ApplySheetPatchCard({
  patch,
  decision,
  onAccept,
  onReject,
}: {
  patch: PatchProposal;
  decision: PatchReviewDecision;
  onAccept: () => void;
  onReject: () => void;
}) {
  return (
    <article data-testid={`apply-sheet-patch-${patch.id}`} className="rounded-lg border border-hairline bg-inset p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-foreground">{patch.operation.replace(/_/g, " ")} · {patch.targetSection}</span>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant={decision === "accepted" ? "default" : "outline"} onClick={onAccept} data-testid={`apply-sheet-accept-${patch.id}`}>Accept</Button>
          <Button type="button" size="sm" variant={decision === "rejected" ? "destructive" : "outline"} onClick={onReject} data-testid={`apply-sheet-reject-${patch.id}`}>Reject</Button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs font-mono whitespace-pre-wrap">
        <div className="rounded bg-red-950/30 p-2 text-text-secondary"><span className="mb-1 block text-xs uppercase text-muted-foreground">Before</span>{patch.before || "(empty)"}</div>
        <div className="rounded bg-status-success/15 p-2 text-status-success-soft"><span className="mb-1 block text-xs uppercase text-muted-foreground">After</span>{patch.after || "(empty)"}</div>
      </div>
      <p className="text-xs text-muted-foreground">{patch.rationale}</p>
    </article>
  );
}

export function ApplySheet({
  open,
  onOpenChange,
  job,
  masterTypst = "",
  masterFacts,
  onVariantChange,
}: ApplySheetProps) {
  const [currentStep, setCurrentStep] = useState<ApplyStep>("load");
  const [isProcessing, setIsProcessing] = useState(false);
  const [guardrailResult, setGuardrailResult] = useState<GuardrailResult | null>(null);
  const [atsScore, setAtsScore] = useState<AtsEvaluationResult | null>(null);
  const [tailoredTypst, setTailoredTypst] = useState<string>(masterTypst);
  const [appliedPatchCount, setAppliedPatchCount] = useState<number>(0);
  const [exportError, setExportError] = useState<string | null>(null);
  const [variantError, setVariantError] = useState<string | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(job?.appliedVariantId ?? null);
  const [patchBatch, setPatchBatch] = useState<{ batchId: string; revisionToken: string; baseTypstSource: string; jobId: string } | null>(null);
  const [demoLocalPatches, setDemoLocalPatches] = useState(false);
  const [demoPatchBaseSource, setDemoPatchBaseSource] = useState<string | null>(null);
  const [pendingPatches, setPendingPatches] = useState<PatchProposal[]>([]);
  const [patchGaps, setPatchGaps] = useState<Gap[]>([]);
  const [tailoringNotice, setTailoringNotice] = useState<string | null>(null);
  const [patchDecisions, setPatchDecisions] = useState<Record<string, PatchReviewDecision>>({});
  const [acknowledgedSkills, setAcknowledgedSkills] = useState<string[]>([]);
  const [skillsNeedingAck, setSkillsNeedingAck] = useState<string[]>([]);

  useEffect(() => {
    if (open && job) {
      setCurrentStep("load");
      setTailoredTypst(masterTypst);
      setAppliedPatchCount(0);
      setGuardrailResult(null);
      setAtsScore(null);
      setExportError(null);
      setVariantError(null);
      setPatchBatch(null);
      setDemoLocalPatches(false);
      setDemoPatchBaseSource(null);
      setPendingPatches([]);
      setPatchGaps([]);
      setTailoringNotice(null);
      setPatchDecisions({});
      setAcknowledgedSkills([]);
      setSkillsNeedingAck([]);
      setSelectedVariantId(job.appliedVariantId ?? null);

      if (!masterTypst) {
        let cancelled = false;
        (async () => {
          try {
            const demoConfig = await fetchDemoConfig();
            if (cancelled) return;
            if (!demoConfig?.demoMode) {
              const res = await fetch("/api/resumes");
              const { ok, data: json } = await readApiResponse<{
                success?: boolean;
                data?: { isMaster?: boolean; typstSource?: string }[];
              }>(res);
              if (!cancelled && ok && json?.success && Array.isArray(json.data) && json.data.length > 0) {
                const master = json.data.find((r) => r.isMaster) || json.data[0];
                if (master?.typstSource) {
                  setTailoredTypst(master.typstSource);
                  return;
                }
              }
            }
          } catch {}
          if (typeof window !== "undefined") {
            const localSource = localStorage.getItem("resumeforge_typst_source");
            if (!cancelled && localSource) {
              setTailoredTypst(localSource);
            }
          }
        })();
        return () => {
          cancelled = true;
        };
      }
    }
  }, [open, job, masterTypst]);

  if (!job) return null;

  const handleVariantSelectChange = async (variantId: string | null) => {
    setVariantError(null);
    const prevVariant = selectedVariantId;
    setSelectedVariantId(variantId);

    if (onVariantChange) {
      try {
        await Promise.resolve(onVariantChange(job.id, variantId));
      } catch {
        setSelectedVariantId(prevVariant);
        setVariantError("Failed to update sent variant.");
      }
      return;
    }
    try {
      const demoConfig = await fetchDemoConfig();
      const isLocalJob =
        demoConfig?.demoMode === true ||
        job.id.startsWith("guest-job-") ||
        job.id.startsWith("demo-sample-");
      if (isLocalJob) {
        try {
          const raw = localStorage.getItem("resumeforge_guest_jobs");
          const parsed = raw ? JSON.parse(raw) : [];
          if (Array.isArray(parsed)) {
            const updated = parsed.map((item) =>
              item && item.id === job.id ? { ...item, appliedVariantId: variantId } : item
            );
            localStorage.setItem("resumeforge_guest_jobs", JSON.stringify(updated));
          }
        } catch {}
        return;
      }

      const res = await fetch(`/api/jobs/${job.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantId }),
      });
      if (!res.ok) {
        const msg = await parseApiError(res, "Failed to update sent variant.");
        setSelectedVariantId(prevVariant);
        setVariantError(msg);
      }
    } catch {
      setSelectedVariantId(prevVariant);
      setVariantError("Network error updating sent variant.");
    }
  };

  const handleStartTailoring = async () => {
    setIsProcessing(true);
    setCurrentStep("tailor");
    setExportError(null);

    try {
      let workingTypst = tailoredTypst || masterTypst;
      if (!workingTypst && typeof window !== "undefined") {
        workingTypst = localStorage.getItem("resumeforge_typst_source") || "";
      }
      if (demoLocalPatches) {
        const baseSource = demoPatchBaseSource;
        if (!baseSource || workingTypst !== baseSource || localStorage.getItem("resumeforge_typst_source") !== baseSource) {
          throw new Error("The browser draft changed after these patches were generated. Generate patches again to protect your edits.");
        }
        const acceptedPatches = selectAcceptedPatchProposals(pendingPatches, patchDecisions);
        if (acceptedPatches.length === 0) throw new Error("Accept at least one patch before applying the local variant.");
        const reconstructed = applyPatchProposals(baseSource, acceptedPatches);
        const acceptedIds = acceptedPatches.map((patch) => patch.id);
        if (new Set(acceptedIds).size !== acceptedIds.length || reconstructed.appliedIds.length !== acceptedIds.length || acceptedIds.some((id) => !reconstructed.appliedIds.includes(id))) {
          throw new Error("The local proposal set changed. Generate patches again before applying.");
        }
        const rawFacts = localStorage.getItem("resumeforge_demo_master_facts");
        const facts = rawFacts ? JSON.parse(rawFacts) as ResumeFacts : null;
        if (!facts) throw new Error("Freeze a local master resume before applying patches.");
        const unacknowledged = checkGuardrail(baseSource, facts, { patches: acceptedPatches }).violations
          .filter((violation) => violation.kind === "skill" && typeof violation.actual === "string")
          .map((violation) => violation.actual as string);
        setSkillsNeedingAck(Array.from(new Set(unacknowledged)));
        if (unacknowledged.some((skill) => !acknowledgedSkills.includes(skill))) {
          throw new Error("Acknowledge each unverified skill below before applying these patches.");
        }
        assertCanApplyPatches(baseSource, facts, acceptedPatches, { acknowledgedSkills });
        assertCanApplyPatches(reconstructed.typstSource, facts, acceptedPatches, { acknowledgedSkills });
        const localContent = markDocumentAsPatched(reconstructed.typstSource);
        const { compileTypstToSvg } = await import("@/lib/typst/compiler");
        const compiled = await compileTypstToSvg(localContent);
        if (!compiled.success) throw new Error("The local resume does not compile. Review the generated patches.");
        localStorage.setItem("resumeforge_typst_source", localContent);
        workingTypst = localContent;
        setTailoredTypst(localContent);
        setAppliedPatchCount(acceptedIds.length);
        setDemoLocalPatches(false);
        setDemoPatchBaseSource(null);
        setPendingPatches([]);
        setPatchDecisions({});
      }
      if (patchBatch) {
        const acceptedPatches = selectAcceptedPatchProposals(pendingPatches, patchDecisions);
        if (acceptedPatches.length === 0) throw new Error("Accept at least one patch before applying the tailored variant.");
        if (workingTypst !== patchBatch.baseTypstSource) {
          throw new Error("The resume changed after these patches were generated. Generate patches again to protect your edits.");
        }
        const reconstructed = applyPatchProposals(patchBatch.baseTypstSource, acceptedPatches);
        const acceptedPatchIds = acceptedPatches.map((patch) => patch.id);
        if (reconstructed.appliedIds.length !== acceptedPatchIds.length || acceptedPatchIds.some((id) => !reconstructed.appliedIds.includes(id))) {
          throw new Error("The server proposal set changed. Generate patches again before applying.");
        }
        if (masterFacts) {
          const unacknowledged = checkGuardrail(workingTypst, masterFacts, { patches: acceptedPatches }).violations
            .filter((violation) => violation.kind === "skill" && typeof violation.actual === "string")
            .map((violation) => violation.actual as string);
          setSkillsNeedingAck(Array.from(new Set(unacknowledged)));
          if (unacknowledged.some((skill) => !acknowledgedSkills.includes(skill))) {
            throw new Error("Acknowledge each unverified skill below before applying these patches.");
          }
          assertCanApplyPatches(workingTypst, masterFacts, acceptedPatches, { acknowledgedSkills });
        }
        const preview = markDocumentAsPatched(reconstructed.typstSource);
        const { compileTypstToSvg } = await import("@/lib/typst/compiler");
        const compiled = await compileTypstToSvg(preview);
        if (!compiled.success) throw new Error("The reconstructed resume does not compile. Review the generated patches.");
        const applyRes = await fetch("/api/ai/apply-patches", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            batchId: patchBatch.batchId,
            revisionToken: patchBatch.revisionToken,
            acceptedPatchIds,
            acknowledgedSkills,
            variantTitle: `AI Tailored Variant — ${new Date().toLocaleDateString()}`,
          }),
        });
        const { ok: applyOk, data: applyJson, error: applyError } = await readApiResponse<{
          success?: boolean;
          data?: { typstContent: string };
        }>(applyRes, "Failed to save tailored variant.");
        if (!applyOk || !applyJson?.success || !applyJson.data) {
          throw new Error(applyError || "Failed to save tailored variant.");
        }
        workingTypst = applyJson.data.typstContent;
        setTailoredTypst(workingTypst);
        setAppliedPatchCount(acceptedPatchIds.length);
        setPatchBatch(null);
        setPendingPatches([]);
        setPatchDecisions({});
      }

      let reqs = job.requirements || {
        requiredSkills: [],
        preferredSkills: [],
        domainTerms: [],
      };

      const demoConfig = await fetchDemoConfig();
      const isDemo = demoConfig?.demoMode === true;

      if (
        reqs.requiredSkills.length === 0 &&
        reqs.preferredSkills.length === 0 &&
        job.rawDescription &&
        job.rawDescription.trim().length > 20
      ) {
        if (isDemo) {
          const parsed = parseJobDescription(job.rawDescription);
          reqs = {
            requiredSkills: parsed.requiredSkills || [],
            preferredSkills: parsed.preferredSkills || [],
            domainTerms: parsed.domainTerms || [],
          };
        } else {
          try {
            const extRes = await fetch("/api/jobs/extract", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ rawDescription: job.rawDescription }),
            });
            const { ok: extOk, status: extStatus, data: extJson, error: extError } =
              await readApiResponse<{
                success?: boolean;
                data?: {
                  requiredSkills?: string[];
                  preferredSkills?: string[];
                  domainTerms?: string[];
                };
              }>(extRes, "Failed to extract job requirements.");
            if (extStatus === 401) {
              setTailoringNotice(extError || "Sign in to extract job requirements.");
            } else if (extOk && extJson?.success && extJson.data) {
              reqs = {
                requiredSkills: extJson.data.requiredSkills || [],
                preferredSkills: extJson.data.preferredSkills || [],
                domainTerms: extJson.data.domainTerms || [],
              };
            }
          } catch {}
        }
      }

      // Generate a saved proposal batch for signed-in use, or a stateless BYOK
      // proposal set for the browser-local public demo.
      if (!patchBatch && !demoLocalPatches && (reqs.requiredSkills.length > 0 || reqs.preferredSkills.length > 0)) {
        const aiConfig = await resolveClientProviderConfig();
        if (!aiConfig) {
          setTailoringNotice(isDemo
            ? "Add your own provider API key in Settings to generate demo patches. Your key is used for this request only."
            : "Configure an AI provider to generate tailored patches.");
        } else {
          setTailoringNotice(null);
          const demoContext = isDemo ? getDemoContextFromBrowser() : undefined;
          if (isDemo && (!demoContext?.masterTypst || demoContext.masterTypst !== workingTypst || localStorage.getItem("resumeforge_typst_source") !== workingTypst)) {
            throw new Error("The browser resume changed. Reload the demo draft before generating patches.");
          }
          const patchRes = await fetch(isDemo ? "/api/demo/generate-patches" : "/api/ai/generate-patches", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              providerConfig: aiConfig,
              jobRequirements: {
                requiredSkills: reqs.requiredSkills,
                preferredSkills: reqs.preferredSkills,
                domainTerms: reqs.domainTerms,
                roleTitle: job.roleTitle || undefined,
                company: job.company || undefined,
              },
              ...(isDemo ? (demoContext || {}) : { jobId: job.id }),
            }),
          });
          const { ok: patchOk, data: patchJson, error: patchError } = await readApiResponse<{
            success?: boolean;
            data?: {
              verified?: PatchProposal[];
              gaps?: Gap[];
              batch?: { batchId: string; revisionToken: string; baseTypstSource: string; jobId: string };
            };
          }>(patchRes, "AI patch generation failed.");
          if (patchOk && patchJson?.success && Array.isArray(patchJson.data?.verified)) {
            const verified = patchJson.data.verified as PatchProposal[];
            setPatchGaps(Array.isArray(patchJson.data.gaps) ? patchJson.data.gaps as Gap[] : []);
            if (verified.length > 0) {
              if (isDemo) {
                if (workingTypst !== demoContext?.masterTypst || localStorage.getItem("resumeforge_typst_source") !== workingTypst) {
                  throw new Error("The browser resume changed during generation. Generate patches again.");
                }
                setDemoLocalPatches(true);
                setDemoPatchBaseSource(workingTypst);
                setPatchBatch(null);
              } else {
                const batch = patchJson.data.batch;
                if (!batch) throw new Error("Save this job before applying a persistent tailored variant.");
                if (workingTypst !== batch.baseTypstSource) throw new Error("The resume changed during generation. Generate patches again.");
                setPatchBatch(batch);
              }
              setPendingPatches(verified);
              setPatchDecisions(Object.fromEntries(verified.map((patch) => [patch.id, "pending"])));
              setSkillsNeedingAck([]);
            }
            if (masterFacts && verified.length > 0) {
              const unacknowledged = checkGuardrail(workingTypst, masterFacts, { patches: patchJson.data.verified }).violations
                .filter((violation) => violation.kind === "skill" && typeof violation.actual === "string")
                .map((violation) => violation.actual as string);
              setSkillsNeedingAck(Array.from(new Set(unacknowledged)));
            }
            if (verified.length > 0) {
              setCurrentStep("tailor");
              return;
            }
          }
          if (!patchOk) throw new Error(patchError || "AI patch generation failed.");
        }
      }

      // 1. Guardrail check
      let gResult: GuardrailResult;
      if (masterFacts) {
        gResult = checkGuardrail(workingTypst, masterFacts);
      } else {
        gResult = {
          passed: true,
          status: "clean",
          hasHardViolations: false,
          hasSoftViolations: false,
          violations: [],
        };
      }
      setGuardrailResult(gResult);
      setCurrentStep("guardrail");

      // 2. Score evaluation
      const score = evaluateAtsScore(workingTypst, reqs, "Full-stack");
      setAtsScore(score);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Tailoring failed");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      setExportError(null);
      const workingTypst = tailoredTypst || masterTypst;
      assertCanExport(workingTypst, masterFacts);

      const pdfBytes = await compileTypstToPdf(workingTypst);
      const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: "application/pdf" });
      const safeName = (job.company || "Job").replace(/[^a-zA-Z0-9_-]/g, "_");
      downloadBlob(blob, `${safeName}_Resume.pdf`);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Failed to download PDF");
    }
  };

  const handleDownloadDocx = async () => {
    try {
      setExportError(null);
      const workingTypst = tailoredTypst || masterTypst;
      assertCanExport(workingTypst, masterFacts);

      const docxBytes = await generateAtsDocx(workingTypst, {
        facts: masterFacts || undefined,
      });
      const blob = new Blob([docxBytes.buffer as ArrayBuffer], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      const safeName = (job.company || "Job").replace(/[^a-zA-Z0-9_-]/g, "_");
      downloadBlob(blob, `${safeName}_Resume.docx`);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Failed to download DOCX");
    }
  };

  const handleDownloadZip = async () => {
    try {
      setExportError(null);
      const workingTypst = tailoredTypst || masterTypst;
      assertCanExport(workingTypst, masterFacts);

      const zipBytes = await generateApplicationPackageZip({
        typstSource: workingTypst,
        masterFacts: masterFacts || undefined,
        job: job
          ? {
              company: job.company,
              roleTitle: job.roleTitle,
              location: job.location,
              salarySnippet: job.salarySnippet,
              requirements: job.requirements,
            }
          : null,
        atsScore: atsScore || undefined,
      });
      const blob = new Blob([zipBytes.buffer as ArrayBuffer], {
        type: "application/zip",
      });
      downloadBlob(blob, sanitizeZipFilename(job.company, job.roleTitle));
    } catch (err) {
      setExportError(
        err instanceof Error
          ? err.message
          : "Package creation failed. You can try again or download individual PDF / DOCX files below."
      );
    }
  };

  const stepIndex = {
    load: 1,
    tailor: 2,
    guardrail: 3,
    score: 4,
    export: 5,
  }[currentStep];

  const hasHardViolations = Boolean(guardrailResult?.hasHardViolations);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        data-testid="apply-sheet"
        className="w-full sm:max-w-lg bg-panel border-hairline text-foreground p-6 flex flex-col justify-between overflow-y-auto"
      >
        <div className="space-y-5">
          <SheetHeader>
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="border-amber-500/40 text-amber-400 bg-amber-950/20 text-xs">
                One-Click Apply
              </Badge>
              <span className="text-xs text-muted-foreground font-mono">Step {stepIndex} of 5</span>
            </div>
            <SheetTitle className="text-lg font-bold text-foreground flex items-center gap-2 pt-1">
              <Briefcase className="size-4 text-primary" />
              {job.roleTitle}
            </SheetTitle>
            <SheetDescription className="text-xs text-text-secondary font-medium">
              {job.company} {job.location ? `• ${job.location}` : ""}
            </SheetDescription>
          </SheetHeader>
          {(job.variants?.length ?? 0) > 0 && (
            <label className="block text-xs text-muted-foreground">
              Sent variant
              <select
                className="mt-1 w-full rounded border border-hairline bg-inset px-2 py-1.5 text-xs text-foreground"
                value={selectedVariantId ?? ""}
                aria-label="Sent variant"
                data-testid="apply-sheet-variant-select"
                onChange={(e) => {
                  void handleVariantSelectChange(e.target.value || null);
                }}
              >
                <option value="">No variant recorded</option>
                {job.variants?.map((variant) => (
                  <option key={variant.id} value={variant.id}>{variant.variantTitle}</option>
                ))}
              </select>
              {variantError && (
                <span className="mt-1 block text-xs text-red-400" role="alert">{variantError}</span>
              )}
            </label>
          )}

          {/* Progress Indicator */}
          <div className="space-y-1.5">
            <Progress value={(stepIndex / 5) * 100} className="h-1.5 bg-elevated" />
            <div className="flex justify-between text-xs text-muted-foreground font-mono">
              <span className={stepIndex >= 1 ? "text-primary" : ""}>1. Job</span>
              <span className={stepIndex >= 2 ? "text-primary" : ""}>2. Tailor</span>
              <span className={stepIndex >= 3 ? "text-primary" : ""}>3. Guardrail</span>
              <span className={stepIndex >= 4 ? "text-primary" : ""}>4. Score</span>
              <span className={stepIndex >= 5 ? "text-primary" : ""}>5. Apply</span>
            </div>
          </div>

          {/* Step 1: Job Details & Extracted Requirements */}
          <div className="space-y-3 p-3.5 bg-inset rounded-xl border border-hairline text-xs">
            <h4 className="font-semibold text-foreground flex items-center justify-between">
              <span>Target Role Profile</span>
              {job.salarySnippet && (
                <span className="text-status-success-soft text-xs font-mono">{job.salarySnippet}</span>
              )}
            </h4>

            {job.requirements?.requiredSkills && job.requirements.requiredSkills.length > 0 && (
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Required Skills:</span>
                <div className="flex flex-wrap gap-1">
                  {job.requirements.requiredSkills.map((s, i) => (
                    <Badge key={i} variant="secondary" className="text-xs bg-elevated text-text-secondary border border-hairline">
                      {s}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Step 2 & 3: Tailoring & Guardrail Results */}
          {(patchBatch || demoLocalPatches) && pendingPatches.length > 0 && (
            <div className="space-y-3" data-testid="apply-sheet-patch-review">
              <h4 className="text-xs font-semibold text-foreground">Review proposed changes</h4>
              {pendingPatches.map((patch) => (
                <ApplySheetPatchCard
                  key={patch.id}
                  patch={patch}
                  decision={patchDecisions[patch.id] ?? "pending"}
                  onAccept={() => setPatchDecisions((current) => ({ ...current, [patch.id]: "accepted" }))}
                  onReject={() => setPatchDecisions((current) => ({ ...current, [patch.id]: "rejected" }))}
                />
              ))}
            </div>
          )}
          {(patchBatch || demoLocalPatches) && skillsNeedingAck.length > 0 && (
            <div className="space-y-2 rounded-lg border border-amber-800/60 bg-amber-950/30 p-3 text-xs text-amber-200">
              <p>Confirm any unverified skills you have real experience with before applying:</p>
              {skillsNeedingAck.map((skill) => (
                <label key={skill} className="flex items-center gap-2">
                  <input type="checkbox" checked={acknowledgedSkills.includes(skill)} onChange={() => setAcknowledgedSkills((current) => current.includes(skill) ? current.filter((item) => item !== skill) : [...current, skill])} />
                  I have real experience with {skill}
                </label>
              ))}
            </div>
          )}
          {patchGaps.length > 0 && (
            <div className="space-y-1 rounded-lg border border-amber-800/60 bg-amber-950/30 p-3 text-xs text-amber-200" data-testid="apply-sheet-gaps">
              <p className="font-semibold">Requirements not covered by verified evidence</p>
              {patchGaps.map((gap, index) => (
                <p key={`${gap.requirement}-${index}`}>{gap.requirement}: {gap.recommendation}</p>
              ))}
            </div>
          )}
          {tailoringNotice && <p className="rounded-lg border border-hairline bg-inset p-3 text-xs text-text-secondary" role="status">{tailoringNotice}</p>}
          {guardrailResult && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-text-secondary">Guardrail Audit</h4>
                {appliedPatchCount > 0 && (
                  <Badge variant="outline" className="border-status-success/40 text-status-success-soft bg-status-success/15 text-xs">
                    {appliedPatchCount} AI Patch{appliedPatchCount === 1 ? "" : "es"} Applied
                  </Badge>
                )}
              </div>
              <GuardrailFeedback result={guardrailResult} />
            </div>
          )}

          {/* Step 4: ATS Score */}
          {atsScore && (
            <div className="p-3.5 bg-inset rounded-xl border border-hairline space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <BarChart3 className="size-3.5 text-primary" />
                  ATS Match Score
                </span>
                <Badge
                  variant="outline"
                  className={
                    atsScore.overallScore >= 80
                      ? "tabular-nums border-status-success/50 text-status-success bg-status-success/10"
                      : "tabular-nums border-status-warning/50 text-status-warning bg-status-warning/10"
                  }
                >
                  {atsScore.overallScore} / 100
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Matches {atsScore.requiredMatch.score}/{atsScore.requiredMatch.maxScore} required skills points.
              </p>
            </div>
          )}

          {exportError && (
            <div
              data-testid="apply-export-error-recovery"
              className="p-3 rounded-lg bg-red-950/40 border border-red-900 text-xs text-red-300 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="size-4 text-red-400 shrink-0" />
                  <span>{exportError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setExportError(null)}
                  className="text-red-400 hover:text-red-200 text-xs underline shrink-0 font-medium"
                >
                  Dismiss
                </button>
              </div>
              <div className="flex items-center gap-2 pt-1 border-t border-red-900/60 text-xs">
                <span className="text-red-300">Fallback direct downloads:</span>
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  data-testid="fallback-apply-pdf-btn"
                  className="px-2 py-0.5 rounded bg-red-900/40 hover:bg-red-800 text-red-100 border border-red-700 font-medium"
                >
                  PDF
                </button>
                <button
                  type="button"
                  onClick={handleDownloadDocx}
                  data-testid="fallback-apply-docx-btn"
                  className="px-2 py-0.5 rounded bg-red-900/40 hover:bg-red-800 text-red-100 border border-red-700 font-medium"
                >
                  DOCX
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Step 5: Downloads & Direct Application Link Footer */}
        <SheetFooter className="flex-col gap-2 pt-4 sm:flex-col">
          {!guardrailResult ? (
            <Button
              type="button"
              onClick={handleStartTailoring}
              disabled={isProcessing}
              data-testid="start-tailor-btn"
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs gap-2 shadow-lg shadow-primary/20"
            >
              {isProcessing ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
              {patchBatch || demoLocalPatches ? "Apply Verified Patches & Verify" : "Tailor & Verify Guardrail"}
            </Button>
          ) : (
            <div className="space-y-2 w-full">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDownloadPdf}
                  disabled={hasHardViolations}
                  data-testid="apply-download-pdf-btn"
                  className="w-full border-hairline bg-inset text-foreground hover:bg-elevated disabled:opacity-50 disabled:cursor-not-allowed text-xs gap-1.5"
                >
                  <Download className="size-3.5 text-signal" />
                  Download PDF
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDownloadDocx}
                  disabled={hasHardViolations}
                  data-testid="apply-download-docx-btn"
                  className="w-full border-hairline bg-inset text-foreground hover:bg-elevated disabled:opacity-50 disabled:cursor-not-allowed text-xs gap-1.5"
                >
                  <FileText className="size-3.5 text-signal" />
                  Download DOCX
                </Button>
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={handleDownloadZip}
                disabled={hasHardViolations}
                data-testid="apply-download-zip-btn"
                className="w-full border-hairline bg-inset text-foreground hover:bg-elevated disabled:opacity-50 disabled:cursor-not-allowed text-xs gap-1.5"
              >
                <Package className="size-3.5 text-primary" />
                Download Package (.zip)
              </Button>

              {job.jobUrl && (
                <a
                  href={job.jobUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="direct-apply-link-btn"
                  className="w-full inline-flex items-center justify-center rounded-md bg-status-success hover:bg-status-success/90 text-contrast-ink font-semibold text-xs py-2 px-4 gap-2 shadow-lg shadow-status-success/20 transition-colors"
                >
                  <ExternalLink className="size-3.5" />
                  Open Employer Application
                </a>
              )}
            </div>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
