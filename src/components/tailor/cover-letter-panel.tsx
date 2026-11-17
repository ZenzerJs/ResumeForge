"use client";

import React, { useState } from "react";
import {
  FileText,
  Sparkles,
  Loader2,
  Copy,
  Check,
  Download,
  Save,
  AlertTriangle,
  CheckCircle2,
  FileCode2,
} from "lucide-react";
import type { CoverLetterResponse } from "@/lib/ai/cover-letter-schema";
import { resolveClientProviderConfig } from "@/lib/byok-vault";
import { getDemoContextFromBrowser } from "@/lib/demo-client";
import { fetchDemoConfig } from "@/components/auth/session-user";
import { downloadBlob } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface CoverLetterPanelProps {
  jobId: string;
  variantId?: string;
  company?: string;
  roleTitle?: string;
  rawDescription: string;
  extractedRequirements?: Record<string, unknown>;
  activeRoleProfile?: string;
  draftCoverLetter?: CoverLetterResponse | null;
  onDraftCoverLetterChange?: (draft: CoverLetterResponse | null) => void;
}

export function CoverLetterPanel({
  jobId,
  variantId,
  company,
  roleTitle,
  rawDescription,
  extractedRequirements,
  activeRoleProfile = "Full-stack",
  draftCoverLetter,
  onDraftCoverLetterChange,
}: CoverLetterPanelProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [internalCoverLetter, setInternalCoverLetter] = useState<CoverLetterResponse | null>(null);
  const coverLetter = draftCoverLetter !== undefined ? draftCoverLetter : internalCoverLetter;
  const setCoverLetter = onDraftCoverLetterChange ?? setInternalCoverLetter;
  const [activeFormat, setActiveFormat] = useState<"markdown" | "text">("markdown");
  const [copied, setCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [pendingRegenerateJob, setPendingRegenerateJob] = useState<{
    jobId: string;
    label: string;
  } | null>(null);
  const prevJobIdRef = React.useRef<string | undefined>(jobId);
  const draftCoverLetterRef = React.useRef(draftCoverLetter);
  draftCoverLetterRef.current = draftCoverLetter;
  const copyTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // Task 8.6: Load existing cover letter draft for jobId on mount or job switch
  React.useEffect(() => {
    setPendingRegenerateJob(null);
    const jobChanged = prevJobIdRef.current !== jobId;
    prevJobIdRef.current = jobId;
    if (!jobId) return;
    let cancelled = false;

    async function loadExistingDraft() {
      try {
        const config = await fetchDemoConfig();
        if (cancelled) return;
        setDemoMode(config.demoMode === true);
        if (!jobChanged && draftCoverLetterRef.current) return;
        if (config.demoMode) {
          const local = localStorage.getItem(`resumeforge_demo_cover_letter_${jobId}`);
          if (local) {
            setCoverLetter(JSON.parse(local) as CoverLetterResponse);
          } else if (jobChanged) {
            setCoverLetter(null);
          }
          return;
        }
        const res = await fetch(`/api/cover-letters?jobId=${jobId}`);
        const json = await res.json();
        if (cancelled) return;
        if (res.ok && json.success && Array.isArray(json.data) && json.data.length > 0) {
          const draft = json.data[0];
          setCoverLetter({
            title: draft.title,
            salutation: draft.salutation || "Dear Hiring Team,",
            openingParagraph: draft.openingParagraph,
            bodyParagraphs: Array.isArray(draft.bodyParagraphs) ? draft.bodyParagraphs : [],
            closingParagraph: draft.closingParagraph,
            fullMarkdown: draft.fullMarkdown ?? draft.proseMarkdown ?? "",
            evidenceCitations: Array.isArray(draft.evidenceCitations) ? draft.evidenceCitations : [],
            gapsAddressed: [],
          });
        } else if (jobChanged) {
          setCoverLetter(null);
        }
      } catch {
        // Non-fatal
      }
    }
    void loadExistingDraft();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  const performGenerateCoverLetter = async () => {
    setIsGenerating(true);
    setGenerateError(null);
    setCoverLetter(null);

    try {
      const providerConfig = (await resolveClientProviderConfig()) || undefined;
      const demoConfig = await fetchDemoConfig();
      const demoContext = demoConfig.demoMode ? getDemoContextFromBrowser() : undefined;
      if (demoConfig.demoMode && !demoContext) {
        setGenerateError("Add a local resume and verified evidence before generating a cover letter.");
        return;
      }

      const res = await fetch(demoConfig.demoMode ? "/api/demo/generate-cover-letter" : "/api/ai/generate-cover-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          variantId,
          company: company || "Target Company",
          roleTitle: roleTitle || "Target Position",
          rawDescription,
          extractedRequirements: extractedRequirements || undefined,
          activeRoleProfile,
          providerConfig,
          ...(demoConfig.demoMode ? { masterTypst: demoContext?.masterTypst, evidenceItems: demoContext?.evidenceItems } : {}),
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        setGenerateError(json.error || json.reason || "Failed to generate cover letter.");
        return;
      }

      setCoverLetter(json.data);
      if (demoConfig.demoMode) localStorage.setItem(`resumeforge_demo_cover_letter_${jobId}`, JSON.stringify(json.data));
    } catch (err) {
      setGenerateError(`Generation error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateCoverLetter = () => {
    if (coverLetter) {
      const targetName =
        roleTitle || company
          ? `${roleTitle || "this role"}${company ? ` at ${company}` : ""}`
          : "this job";
      setPendingRegenerateJob({ jobId, label: targetName });
      return;
    }
    void performGenerateCoverLetter();
  };

  const getFullContent = () => {
    if (!coverLetter) return "";
    if (activeFormat === "markdown") return coverLetter.fullMarkdown;

    const name =
      coverLetter.fullMarkdown.match(/Sincerely,\s*\n([^\n]+)/i)?.[1]?.trim() || "Candidate";

    return `${coverLetter.salutation}\n\n${coverLetter.openingParagraph}\n\n${coverLetter.bodyParagraphs.join(
      "\n\n"
    )}\n\n${coverLetter.closingParagraph}\n\nSincerely,\n${name}`;
  };

  const handleCopy = () => {
    const textToCopy = getFullContent();
    if (!textToCopy) return;

    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopied(false), 2500);
  };

  const handleDownload = () => {
    const content = getFullContent();
    if (!content) return;

    const ext = activeFormat === "markdown" ? "md" : "txt";
    const filename = `Cover_Letter_${(company || "Company").replace(/\s+/g, "_")}.${ext}`;

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    downloadBlob(blob, filename);
  };

  const handleSaveToDatabase = async () => {
    if (!coverLetter) return;

    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const res = await fetch("/api/cover-letters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          variantId: variantId || undefined,
          title: coverLetter.title || `Cover Letter — ${company || "Target Company"}`,
          salutation: coverLetter.salutation,
          openingParagraph: coverLetter.openingParagraph,
          bodyParagraphs: coverLetter.bodyParagraphs,
          closingParagraph: coverLetter.closingParagraph,
          fullMarkdown: coverLetter.fullMarkdown,
          evidenceCitations: coverLetter.evidenceCitations,
          status: "DRAFT",
        }),
      });

      if (res.ok) {
        setSaveSuccess(true);
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error("Failed to save cover letter:", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="bg-panel border border-hairline rounded-xl p-5 space-y-5"
      data-testid="cover-letter-panel"
    >
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <FileText className="h-5 w-5 text-signal" />
            Tailored Cover Letter Generator
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-signal/15 text-signal border border-signal/35">
              Evidence Grounded
            </span>
          </h3>
          <p className="text-sm text-muted-foreground">
            Generate an evidence-backed cover letter grounded strictly in candidate Evidence Bank achievements.
          </p>
        </div>

        <button
          type="button"
          onClick={handleGenerateCoverLetter}
          disabled={isGenerating}
          data-testid="generate-cover-letter-btn"
          className="px-4 py-2.5 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground font-semibold text-xs rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-primary/20 transition shrink-0"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating Cover Letter...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              {coverLetter ? "Regenerate Cover Letter" : "Generate Tailored Cover Letter"}
            </>
          )}
        </button>
      </div>

      {/* Error state */}
      {generateError && (
        <div
          data-testid="cover-letter-error"
          className="p-4 bg-status-danger/10 border border-status-danger/30 rounded-xl flex items-start gap-3 text-xs text-status-danger"
        >
          <AlertTriangle className="h-5 w-5 shrink-0 text-status-danger mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold block text-status-danger">Generation Error</span>
            <span>{generateError}</span>
          </div>
        </div>
      )}

      {/* Generated Cover Letter Workspace */}
      {coverLetter && (
        <div className="space-y-4" data-testid="cover-letter-workspace">
          {/* Format selector and action toolbar */}
          <div className="bg-inset border border-hairline rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
            {/* Format toggle */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground font-medium mr-1">View Format:</span>
              <button
                type="button"
                onClick={() => setActiveFormat("markdown")}
                data-testid="format-markdown-btn"
                className={`px-3 py-1 rounded-md text-xs font-mono transition flex items-center gap-1.5 ${
                  activeFormat === "markdown"
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "bg-elevated text-muted-foreground hover:text-foreground"
                }`}
              >
                <FileCode2 className="h-3.5 w-3.5" />
                Markdown
              </button>
              <button
                type="button"
                onClick={() => setActiveFormat("text")}
                data-testid="format-text-btn"
                className={`px-3 py-1 rounded-md text-xs font-mono transition flex items-center gap-1.5 ${
                  activeFormat === "text"
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "bg-elevated text-muted-foreground hover:text-foreground"
                }`}
              >
                <FileText className="h-3.5 w-3.5" />
                Plain Text
              </button>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopy}
                data-testid="copy-cover-letter-btn"
                className="px-3 py-1.5 bg-elevated hover:bg-control/30 text-foreground border border-hairline text-xs rounded-md font-medium transition flex items-center gap-1.5"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-status-success" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied!" : "Copy to Clipboard"}
              </button>

              <button
                type="button"
                onClick={handleDownload}
                data-testid="download-cover-letter-btn"
                className="px-3 py-1.5 bg-elevated hover:bg-control/30 text-foreground border border-hairline text-xs rounded-md font-medium transition flex items-center gap-1.5"
              >
                <Download className="h-3.5 w-3.5" />
                Download ({activeFormat === "markdown" ? ".md" : ".txt"})
              </button>

              {demoMode ? (
                <span className="px-3 py-1.5 text-xs text-muted-foreground" data-testid="cover-letter-local-only">
                  Saved in this browser
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleSaveToDatabase}
                  disabled={isSaving}
                  data-testid="save-cover-letter-btn"
                  className="px-3 py-1.5 bg-status-success hover:bg-status-success/90 disabled:opacity-50 text-contrast-ink text-xs rounded-md font-semibold transition-colors flex items-center gap-1.5"
                >
                  {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saveSuccess ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
                  {saveSuccess ? "Saved to Database!" : "Save Cover Letter"}
                </button>
              )}
            </div>
          </div>

          {/* Evidence Citations Badges */}
          {coverLetter.evidenceCitations && coverLetter.evidenceCitations.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-xs bg-signal/10 border border-signal/30 rounded-lg p-3">
              <span className="text-signal font-semibold uppercase text-xs tracking-wider">
                Grounded Evidence Citations ({coverLetter.evidenceCitations.length}):
              </span>
              {coverLetter.evidenceCitations.map((cid) => (
                <span
                  key={cid}
                  data-testid="evidence-citation-badge"
                  className="text-xs font-mono px-2 py-0.5 rounded bg-signal/15 text-signal border border-signal/35"
                >
                  ✓ {cid}
                </span>
              ))}
            </div>
          )}

          {/* Letter body — markdown shows assembled letter; text shows modular paragraphs */}
          {activeFormat === "markdown" ? (
            <div
              data-testid="cover-letter-markdown-view"
              className="bg-inset border border-hairline rounded-xl p-5 text-sm text-foreground leading-relaxed whitespace-pre-wrap font-sans"
            >
              {coverLetter.fullMarkdown}
            </div>
          ) : (
            <div className="space-y-3" data-testid="cover-letter-plain-view">
              <div className="bg-inset border border-hairline rounded-xl p-4 space-y-2">
                <span className="text-xs uppercase font-bold text-muted-foreground tracking-wider">
                  Salutation & Opening Hook
                </span>
                <p className="text-sm text-foreground font-medium">{coverLetter.salutation}</p>
                <p className="text-sm text-text-secondary leading-relaxed font-sans">{coverLetter.openingParagraph}</p>
              </div>

              {coverLetter.bodyParagraphs.map((para, idx) => (
                <div key={idx} className="bg-inset border border-hairline rounded-xl p-4 space-y-2">
                  <span className="text-xs uppercase font-bold text-signal tracking-wider">
                    Body Paragraph {idx + 1}
                  </span>
                  <p className="text-sm text-foreground leading-relaxed font-sans">{para}</p>
                </div>
              ))}

              <div className="bg-inset border border-hairline rounded-xl p-4 space-y-2">
                <span className="text-xs uppercase font-bold text-muted-foreground tracking-wider">
                  Closing Statement
                </span>
                <p className="text-sm text-text-secondary leading-relaxed font-sans">{coverLetter.closingParagraph}</p>
                <p className="text-sm text-muted-foreground font-medium whitespace-pre-line">
                  {`Sincerely,\n${
                    coverLetter.fullMarkdown.match(/Sincerely,\s*\n([^\n]+)/i)?.[1]?.trim() || "Candidate"
                  }`}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pendingRegenerateJob)}
        onOpenChange={(open) => {
          if (!open) setPendingRegenerateJob(null);
        }}
        title="Regenerate Cover Letter"
        description={
          pendingRegenerateJob
            ? `Regenerate the cover letter for ${pendingRegenerateJob.label}? This creates a new evidence-grounded draft and replaces the current draft in view.`
            : ""
        }
        confirmLabel="Regenerate"
        isConfirming={isGenerating}
        dialogTestId="regenerate-cover-letter-confirm-modal"
        confirmTestId="confirm-regenerate-cover-letter-btn"
        cancelTestId="cancel-regenerate-cover-letter-btn"
        onConfirm={async () => {
          if (!pendingRegenerateJob || pendingRegenerateJob.jobId !== jobId) {
            setPendingRegenerateJob(null);
            return;
          }
          setPendingRegenerateJob(null);
          await performGenerateCoverLetter();
        }}
      />
    </div>
  );
}
