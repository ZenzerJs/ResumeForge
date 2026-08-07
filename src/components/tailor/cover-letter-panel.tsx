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

interface CoverLetterPanelProps {
  jobId: string;
  variantId?: string;
  company?: string;
  roleTitle?: string;
  rawDescription: string;
  extractedRequirements?: Record<string, unknown>;
  activeRoleProfile?: string;
}

export function CoverLetterPanel({
  jobId,
  variantId,
  company,
  roleTitle,
  rawDescription,
  activeRoleProfile = "Full-stack",
}: CoverLetterPanelProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [coverLetter, setCoverLetter] = useState<CoverLetterResponse | null>(null);
  const [activeFormat, setActiveFormat] = useState<"markdown" | "text">("markdown");
  const [copied, setCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Task 8.6: Load existing cover letter draft for jobId on mount
  React.useEffect(() => {
    if (!jobId) return;
    async function loadExistingDraft() {
      try {
        const res = await fetch(`/api/cover-letters?jobId=${jobId}`);
        const json = await res.json();
        if (res.ok && json.success && Array.isArray(json.data) && json.data.length > 0) {
          const draft = json.data[0];
          setCoverLetter({
            title: draft.title,
            salutation: draft.salutation || "Dear Hiring Team,",
            openingParagraph: draft.openingParagraph,
            bodyParagraphs: Array.isArray(draft.bodyParagraphs) ? draft.bodyParagraphs : [],
            closingParagraph: draft.closingParagraph,
            fullMarkdown: draft.fullMarkdown,
            evidenceCitations: Array.isArray(draft.evidenceCitations) ? draft.evidenceCitations : [],
            gapsAddressed: [],
          });
        }
      } catch {
        // Non-fatal
      }
    }
    loadExistingDraft();
  }, [jobId]);

  const handleGenerateCoverLetter = async () => {
    if (coverLetter && !confirm("Regenerate cover letter? This will create a new evidence-grounded draft for this job.")) {
      return;
    }

    setIsGenerating(true);
    setGenerateError(null);
    setCoverLetter(null);

    try {
      const res = await fetch("/api/ai/generate-cover-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          variantId,
          company: company || "Target Company",
          roleTitle: roleTitle || "Target Position",
          rawDescription,
          activeRoleProfile,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        setGenerateError(json.error || json.reason || "Failed to generate cover letter.");
        return;
      }

      setCoverLetter(json.data);
    } catch (err) {
      setGenerateError(`Generation error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const getFullContent = () => {
    if (!coverLetter) return "";
    if (activeFormat === "markdown") return coverLetter.fullMarkdown;

    // Plain text assembly
    return `${coverLetter.salutation}\n\n${coverLetter.openingParagraph}\n\n${coverLetter.bodyParagraphs.join(
      "\n\n"
    )}\n\n${coverLetter.closingParagraph}\n\nSincerely,\nCandidate`;
  };

  const handleCopy = () => {
    const textToCopy = getFullContent();
    if (!textToCopy) return;

    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownload = () => {
    const content = getFullContent();
    if (!content) return;

    const ext = activeFormat === "markdown" ? "md" : "txt";
    const filename = `Cover_Letter_${(company || "Company").replace(/\s+/g, "_")}.${ext}`;

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
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
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error("Failed to save cover letter:", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5"
      data-testid="cover-letter-panel"
    >
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <FileText className="h-5 w-5 text-indigo-400" />
            Tailored Cover Letter Generator
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
              Evidence Grounded
            </span>
          </h3>
          <p className="text-xs text-slate-400">
            Generate an evidence-backed cover letter grounded strictly in candidate Evidence Bank achievements.
          </p>
        </div>

        <button
          type="button"
          onClick={handleGenerateCoverLetter}
          disabled={isGenerating}
          data-testid="generate-cover-letter-btn"
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-xs rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 transition shrink-0"
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
          className="p-4 bg-red-950/60 border border-red-800/80 rounded-xl flex items-start gap-3 text-xs text-red-300"
        >
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-400 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold block text-red-200">Generation Error</span>
            <span>{generateError}</span>
          </div>
        </div>
      )}

      {/* Generated Cover Letter Workspace */}
      {coverLetter && (
        <div className="space-y-4" data-testid="cover-letter-workspace">
          {/* Format selector and action toolbar */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
            {/* Format toggle */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400 font-medium mr-1">View Format:</span>
              <button
                type="button"
                onClick={() => setActiveFormat("markdown")}
                data-testid="format-markdown-btn"
                className={`px-3 py-1 rounded-md text-xs font-mono transition flex items-center gap-1.5 ${
                  activeFormat === "markdown"
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-800 text-slate-400 hover:text-slate-200"
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
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-800 text-slate-400 hover:text-slate-200"
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
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-md font-medium transition flex items-center gap-1.5"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied!" : "Copy to Clipboard"}
              </button>

              <button
                type="button"
                onClick={handleDownload}
                data-testid="download-cover-letter-btn"
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-md font-medium transition flex items-center gap-1.5"
              >
                <Download className="h-3.5 w-3.5" />
                Download ({activeFormat === "markdown" ? ".md" : ".txt"})
              </button>

              <button
                type="button"
                onClick={handleSaveToDatabase}
                disabled={isSaving}
                data-testid="save-cover-letter-btn"
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs rounded-md font-medium transition flex items-center gap-1.5"
              >
                {isSaving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : saveSuccess ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                {saveSuccess ? "Saved to Database!" : "Save Cover Letter"}
              </button>
            </div>
          </div>

          {/* Evidence Citations Badges */}
          {coverLetter.evidenceCitations && coverLetter.evidenceCitations.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-xs bg-indigo-950/30 border border-indigo-900/40 rounded-lg p-3">
              <span className="text-indigo-300 font-semibold uppercase text-[10px] tracking-wider">
                Grounded Evidence Citations ({coverLetter.evidenceCitations.length}):
              </span>
              {coverLetter.evidenceCitations.map((cid) => (
                <span
                  key={cid}
                  data-testid="evidence-citation-badge"
                  className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800"
                >
                  ✓ {cid}
                </span>
              ))}
            </div>
          )}

          {/* Modular Paragraph Cards View */}
          <div className="space-y-3">
            {/* Salutation & Opening Hook */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-2">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                Salutation & Opening Hook
              </span>
              <p className="text-xs text-slate-200 font-medium">{coverLetter.salutation}</p>
              <p className="text-xs text-slate-300 leading-relaxed font-sans">{coverLetter.openingParagraph}</p>
            </div>

            {/* Body Paragraphs */}
            {coverLetter.bodyParagraphs.map((para, idx) => (
              <div key={idx} className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-2">
                <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">
                  Body Paragraph {idx + 1}
                </span>
                <p className="text-xs text-slate-200 leading-relaxed font-sans">{para}</p>
              </div>
            ))}

            {/* Closing */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-2">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                Closing Statement
              </span>
              <p className="text-xs text-slate-300 leading-relaxed font-sans">{coverLetter.closingParagraph}</p>
              <p className="text-xs text-slate-400 font-medium">Sincerely,<br />Candidate</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
