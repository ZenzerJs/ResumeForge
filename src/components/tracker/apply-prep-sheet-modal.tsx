"use client";

import React, { useState } from "react";
import {
  X,
  Copy,
  Check,
  Briefcase,
  ExternalLink,
  User,
  FileText,
  Sparkles,
  ClipboardList,
} from "lucide-react";
import { isSafeHref } from "@/lib/security/safe-fetch";

interface ApplyPrepSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: {
    company: string;
    title: string;
    applyUrl?: string | null;
    location?: string | null;
    notes?: string | null;
  };
  coverLetter?: string | null;
  matchedHighlights?: string[];
  candidateInfo?: {
    name?: string;
    email?: string;
    phone?: string;
    linkedin?: string;
    github?: string;
    portfolio?: string;
  };
}

export function ApplyPrepSheetModal({
  isOpen,
  onClose,
  job,
  coverLetter,
  matchedHighlights = [],
  candidateInfo = {
    name: "Candidate",
    email: "candidate@resumeforge.dev",
    phone: "+1 (555) 019-2834",
    linkedin: "https://linkedin.com/in/candidate",
    github: "https://github.com/candidate",
    portfolio: "https://candidate.dev",
  },
}: ApplyPrepSheetModalProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  const copyToClipboard = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      console.error("Failed to copy");
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
      data-testid="apply-prep-sheet-modal"
    >
      <div className="relative flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl border border-slate-700 bg-[#0b1326] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">
                Application Prep Sheet — {job.company}
              </h2>
              <p className="text-xs text-slate-400">{job.title}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            data-testid="close-prep-sheet-btn"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label="Close prep sheet"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="space-y-5 overflow-y-auto p-6 text-xs">
          {/* Section 1: Contact Info */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" /> Candidate Information
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-lg border border-slate-800 bg-slate-900/60 p-3">
              {Object.entries(candidateInfo).map(([key, val]) => {
                if (!val) return null;
                const isCopied = copiedKey === `contact-${key}`;
                return (
                  <div
                    key={key}
                    className="flex items-center justify-between gap-2 rounded bg-slate-800/60 px-2.5 py-1.5"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] uppercase text-slate-500 block">{key}</span>
                      <span className="truncate text-slate-200 block">{val}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(`contact-${key}`, val)}
                      className="shrink-0 p-1 text-slate-400 hover:text-amber-400 transition-colors"
                      title={`Copy ${key}`}
                    >
                      {isCopied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 2: Matched Highlights */}
          {matchedHighlights.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" /> Top Evidence Highlights for Form Answers
                </span>
                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard("all-highlights", matchedHighlights.join("\n\n"))
                  }
                  className="text-[11px] text-amber-400 hover:underline flex items-center gap-1"
                >
                  {copiedKey === "all-highlights" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  Copy All Bullets
                </button>
              </div>
              <div className="space-y-1.5 rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                {matchedHighlights.map((hl, idx) => (
                  <div
                    key={idx}
                    className="flex items-start justify-between gap-2 rounded bg-slate-800/40 p-2 text-slate-300"
                  >
                    <span className="flex-1 leading-relaxed">• {hl}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(`hl-${idx}`, hl)}
                      className="shrink-0 p-1 text-slate-400 hover:text-amber-400"
                      title="Copy bullet point"
                    >
                      {copiedKey === `hl-${idx}` ? (
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 3: Cover Letter */}
          {coverLetter && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" /> Tailored Cover Letter
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard("cover-letter", coverLetter)}
                  className="text-[11px] text-amber-400 hover:underline flex items-center gap-1"
                >
                  {copiedKey === "cover-letter" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  Copy Full Letter
                </button>
              </div>
              <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-slate-300 whitespace-pre-wrap leading-relaxed">
                {coverLetter}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-800 px-6 py-3 bg-slate-900/40">
          <span className="text-[11px] text-slate-500">Ready to submit application</span>
          <div className="flex items-center gap-2">
            {job.applyUrl && isSafeHref(job.applyUrl) && (
              <a
                href={job.applyUrl}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="prep-sheet-open-portal-btn"
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-amber-400"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open Job Portal
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
