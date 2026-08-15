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
} from "lucide-react";
import { GuardrailFeedback } from "@/components/ui/guardrail-feedback";
import { GuardrailResult } from "@/lib/guardrail/types";
import { checkGuardrail } from "@/lib/guardrail/check";
import { evaluateAtsScore } from "@/lib/ats-evaluator/evaluator";
import { AtsEvaluationResult } from "@/lib/ats-evaluator/types";
import { generateAtsDocx } from "@/lib/export/docx";
import { compileTypstToPdf } from "@/lib/typst/compiler";
import { ResumeFacts } from "@/lib/facts/types";

export interface TrackerJobItem {
  id: string;
  company: string;
  roleTitle: string;
  jobUrl?: string | null;
  status: string;
  source?: string;
  location?: string | null;
  salarySnippet?: string | null;
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
}

type ApplyStep = "load" | "tailor" | "guardrail" | "score" | "export";

export function ApplySheet({
  open,
  onOpenChange,
  job,
  masterTypst = "",
  masterFacts,
}: ApplySheetProps) {
  const [currentStep, setCurrentStep] = useState<ApplyStep>("load");
  const [isProcessing, setIsProcessing] = useState(false);
  const [guardrailResult, setGuardrailResult] = useState<GuardrailResult | null>(null);
  const [atsScore, setAtsScore] = useState<AtsEvaluationResult | null>(null);
  const [tailoredTypst, setTailoredTypst] = useState<string>(masterTypst);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    if (open && job) {
      setCurrentStep("load");
      setTailoredTypst(masterTypst);
      setGuardrailResult(null);
      setAtsScore(null);
      setExportError(null);
    }
  }, [open, job, masterTypst]);

  if (!job) return null;

  const handleStartTailoring = async () => {
    setIsProcessing(true);
    setCurrentStep("tailor");

    try {
      // Simulate/Trigger tailoring flow
      await new Promise((r) => setTimeout(r, 400));

      const workingTypst = tailoredTypst || masterTypst;

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
      const reqs = job.requirements || {
        requiredSkills: [],
        preferredSkills: [],
        domainTerms: [],
      };
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
      const pdfBytes = await compileTypstToPdf(tailoredTypst || masterTypst);
      const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${job.company.replace(/\s+/g, "_")}_Resume.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Failed to download PDF");
    }
  };

  const handleDownloadDocx = async () => {
    try {
      setExportError(null);
      const docxBytes = await generateAtsDocx(tailoredTypst || masterTypst, {
        facts: masterFacts || undefined,
      });
      const blob = new Blob([docxBytes.buffer as ArrayBuffer], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${job.company.replace(/\s+/g, "_")}_Resume.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Failed to download DOCX");
    }
  };

  const stepIndex = {
    load: 1,
    tailor: 2,
    guardrail: 3,
    score: 4,
    export: 5,
  }[currentStep];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        data-testid="apply-sheet"
        className="w-full sm:max-w-lg bg-slate-950 border-slate-800 text-slate-100 p-6 flex flex-col justify-between overflow-y-auto"
      >
        <div className="space-y-5">
          <SheetHeader>
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="border-amber-500/40 text-amber-400 bg-amber-950/20 text-xs">
                One-Click Apply
              </Badge>
              <span className="text-[11px] text-slate-400 font-mono">Step {stepIndex} of 5</span>
            </div>
            <SheetTitle className="text-lg font-bold text-white flex items-center gap-2 pt-1">
              <Briefcase className="size-4 text-amber-400" />
              {job.roleTitle}
            </SheetTitle>
            <SheetDescription className="text-xs text-slate-300 font-medium">
              {job.company} {job.location ? `• ${job.location}` : ""}
            </SheetDescription>
          </SheetHeader>

          {/* Progress Indicator */}
          <div className="space-y-1.5">
            <Progress value={(stepIndex / 5) * 100} className="h-1.5 bg-slate-800" />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span className={stepIndex >= 1 ? "text-amber-400" : ""}>1. Job</span>
              <span className={stepIndex >= 2 ? "text-amber-400" : ""}>2. Tailor</span>
              <span className={stepIndex >= 3 ? "text-amber-400" : ""}>3. Guardrail</span>
              <span className={stepIndex >= 4 ? "text-amber-400" : ""}>4. Score</span>
              <span className={stepIndex >= 5 ? "text-amber-400" : ""}>5. Apply</span>
            </div>
          </div>

          {/* Step 1: Job Details & Extracted Requirements */}
          <div className="space-y-3 p-3.5 bg-slate-900/80 rounded-xl border border-slate-800 text-xs">
            <h4 className="font-semibold text-slate-200 flex items-center justify-between">
              <span>Target Role Profile</span>
              {job.salarySnippet && (
                <span className="text-emerald-400 text-[11px] font-mono">{job.salarySnippet}</span>
              )}
            </h4>

            {job.requirements?.requiredSkills && job.requirements.requiredSkills.length > 0 && (
              <div className="space-y-1">
                <span className="text-[11px] text-slate-400">Required Skills:</span>
                <div className="flex flex-wrap gap-1">
                  {job.requirements.requiredSkills.map((s, i) => (
                    <Badge key={i} variant="secondary" className="text-[10px] bg-slate-800 text-slate-200">
                      {s}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Step 2 & 3: Tailoring & Guardrail Results */}
          {guardrailResult && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-slate-300">Guardrail Audit</h4>
              <GuardrailFeedback result={guardrailResult} />
            </div>
          )}

          {/* Step 4: ATS Score */}
          {atsScore && (
            <div className="p-3.5 bg-slate-900/80 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <BarChart3 className="size-3.5 text-amber-400" />
                  ATS Match Score
                </span>
                <Badge
                  variant="outline"
                  className={
                    atsScore.overallScore >= 80
                      ? "border-emerald-500/50 text-emerald-400 bg-emerald-950/30"
                      : "border-amber-500/50 text-amber-400 bg-amber-950/30"
                  }
                >
                  {atsScore.overallScore} / 100
                </Badge>
              </div>
              <p className="text-[11px] text-slate-400">
                Matches {atsScore.requiredMatch.score}/{atsScore.requiredMatch.maxScore} required skills points.
              </p>
            </div>
          )}

          {exportError && (
            <div className="p-3 rounded-lg bg-red-950/40 border border-red-900 text-xs text-red-300 flex items-center gap-2">
              <AlertCircle className="size-4 text-red-400 shrink-0" />
              <span>{exportError}</span>
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
              className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs gap-2 shadow-lg shadow-amber-500/20"
            >
              {isProcessing ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
              Tailor &amp; Verify Guardrail
            </Button>
          ) : (
            <div className="space-y-2 w-full">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDownloadPdf}
                  data-testid="apply-download-pdf-btn"
                  className="w-full border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 text-xs gap-1.5"
                >
                  <Download className="size-3.5 text-indigo-400" />
                  Download PDF
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDownloadDocx}
                  data-testid="apply-download-docx-btn"
                  className="w-full border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 text-xs gap-1.5"
                >
                  <FileText className="size-3.5 text-blue-400" />
                  Download DOCX
                </Button>
              </div>

              {job.jobUrl && (
                <a
                  href={job.jobUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="direct-apply-link-btn"
                  className="w-full inline-flex items-center justify-center rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs py-2 px-4 gap-2 shadow-lg shadow-emerald-600/20 transition-colors"
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
