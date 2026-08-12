"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ExternalLink,
  Loader2,
  Save,
  X,
  DownloadCloud,
  Check,
  MoreHorizontal,
  Sparkles,
  FileText,
  Building2,
  MapPin,
  Banknote,
  Clock,
  ChevronDown,
} from "lucide-react";
import { JobStatus } from "@/lib/db/jobs";
import {
  extractLocationFromNotes,
  extractApplyUrlFromNotes,
  extractPostingDateFromNotes,
  extractSalaryFromNotes,
  isPlaceholderDescription,
} from "@/lib/ingestion/helpers";
import {
  buildEvidenceMatchChecklist,
  type EvidenceMatchChecklist,
} from "@/lib/jobs/evidence-match-checklist";
import type { EvidenceItemWithBullets } from "@/lib/matching/matcher";
import type { JobItem } from "@/components/tracker/job-types";
import { isSafeHref } from "@/lib/security/safe-fetch";
import { convertHtmlToCleanMarkdown } from "@/lib/ingestion/jd-format";

const STATUS_LABELS: Record<JobStatus, string> = {
  SAVED: "Saved",
  APPLIED: "Applied",
  INTERVIEWING: "Interviewing",
  OFFER: "Offer",
  REJECTED: "Rejected",
  ARCHIVED: "Archived",
};

const ALL_STATUSES = Object.keys(STATUS_LABELS) as JobStatus[];

interface JobDetailPaneProps {
  job: JobItem;
  notesValue: string;
  isSavingNotes: boolean;
  isUpdatingStatus: boolean;
  isFetchingFullText: boolean;
  tier2Notice?: string;
  showNotes: boolean;
  isSheet?: boolean;
  onClose?: () => void;
  onStatusChange: (jobId: string, status: JobStatus) => void;
  onNotesChange: (jobId: string, value: string) => void;
  onSaveNotes: (jobId: string) => void;
  onFetchFullText: (jobId: string) => void;
}

export function JobDetailPane({
  job,
  notesValue,
  isSavingNotes,
  isUpdatingStatus,
  isFetchingFullText,
  tier2Notice,
  showNotes,
  isSheet = false,
  onClose,
  onStatusChange,
  onNotesChange,
  onSaveNotes,
  onFetchFullText,
}: JobDetailPaneProps) {
  const [evidence, setEvidence] = useState<EvidenceItemWithBullets[]>([]);
  const [evidenceLoaded, setEvidenceLoaded] = useState(false);
  const [detailJob, setDetailJob] = useState<JobItem>(job);

  useEffect(() => {
    setDetailJob(job);
    if (job.rawDescription) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/jobs/${job.id}`);
        const json = await res.json();
        if (!cancelled && res.ok && json.success) {
          setDetailJob({ ...job, ...json.data });
        }
      } catch {
        // keep slim list row
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [job]);

  const location = extractLocationFromNotes(detailJob.notes);
  const applyUrl = extractApplyUrlFromNotes(detailJob.notes);
  const datePosted = extractPostingDateFromNotes(detailJob.notes);
  const salary = extractSalaryFromNotes(detailJob.notes, detailJob.rawDescription);
  const isPlaceholder = isPlaceholderDescription(detailJob.rawDescription);
  const companyInitial = detailJob.company ? detailJob.company[0].toUpperCase() : "J";
  const hasCoverLetter = Boolean(detailJob.coverLetters && detailJob.coverLetters.length > 0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/evidence");
        const json = await res.json();
        if (!cancelled && res.ok && json.success) {
          setEvidence(json.data as EvidenceItemWithBullets[]);
        }
      } catch {
        // non-blocking
      } finally {
        if (!cancelled) setEvidenceLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const checklist: EvidenceMatchChecklist = useMemo(
    () => buildEvidenceMatchChecklist(job.extractedRequirements, evidence),
    [job.extractedRequirements, evidence],
  );

  const coverTestId = hasCoverLetter
    ? `open-cover-letter-btn-${job.id}`
    : `generate-cover-letter-btn-${job.id}`;

  const content = (
    <div className={isSheet ? "p-margin-desktop" : "relative z-10 min-h-0 flex-1 overflow-y-auto p-margin-desktop"}>
      <div className="max-w-4xl mx-auto space-y-6 relative z-10">
        {/* Mobile close button */}
        {isSheet && (
          <div className="flex justify-end mb-2">
            <button
              type="button"
              onClick={onClose}
              aria-label="Close detail sheet"
              data-testid="job-detail-close-btn"
              className="p-2 rounded-lg bg-surface-variant border border-outline-variant text-on-surface"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Detail Header Card */}
        <div className="bg-surface/80 backdrop-blur-md border border-outline-variant rounded-xl p-6 shadow-[0_0_15px_rgba(255,140,0,0.05)]">
          <div className="flex gap-6 items-start">
            <div className="w-16 h-16 rounded-lg bg-surface-variant border border-outline flex items-center justify-center shrink-0 text-3xl font-bold text-primary shadow-[0_0_15px_rgba(255,140,0,0.1)]">
              {companyInitial}
            </div>
            <div className="flex-1">
              <h1 className="font-page-title-mobile text-2xl md:text-3xl text-on-surface mb-2 tracking-tighter font-bold">
                {job.roleTitle || "Untitled Role"}
              </h1>
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm font-body-dense text-on-surface-variant mb-4">
                <span className="flex items-center gap-1">
                  <Building2 className="h-4 w-4 shrink-0" aria-hidden />
                  {job.company || "Unknown Company"}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4 shrink-0" aria-hidden />
                  {location || "Location unlisted"}
                </span>
                <span className="flex items-center gap-1">
                  <Banknote className="h-4 w-4 shrink-0" aria-hidden />
                  {salary || "No salary listed"}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4 shrink-0" aria-hidden />
                  {datePosted ? `Posted ${datePosted}` : "Recently posted"}
                </span>
              </div>

              {/* Primary Actions */}
              <div className="flex flex-wrap gap-3 items-center">
                <Link
                  href={`/tailor?jobId=${job.id}`}
                  onClick={() => sessionStorage.setItem("resumeforge_active_job_id", job.id)}
                  className="px-5 py-2 rounded bg-primary text-on-primary font-section-label text-xs font-bold hover:bg-primary-fixed hover:shadow-[0_0_15px_rgba(255,140,0,0.3)] transition-all flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  Tailor Resume
                </Link>

                <Link
                  href={`/tailor?jobId=${job.id}&tab=cover-letter`}
                  data-testid={coverTestId}
                  onClick={() => sessionStorage.setItem("resumeforge_active_job_id", job.id)}
                  className="px-4 py-2 rounded bg-transparent border border-outline text-on-surface font-section-label text-xs hover:border-primary hover:text-primary transition-colors flex items-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  {hasCoverLetter ? "Open Cover Letter" : "Generate Cover Letter"}
                </Link>

                {isSafeHref(applyUrl) ? (
                  <a
                    href={applyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 rounded bg-surface-variant border border-transparent text-on-surface font-section-label text-xs hover:border-outline-variant transition-colors flex items-center gap-2"
                  >
                    Open Posting <ExternalLink className="w-4 h-4" />
                  </a>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="px-4 py-2 rounded bg-surface-variant/50 border border-transparent text-on-surface-variant/50 font-section-label text-xs cursor-not-allowed"
                  >
                    Open Posting
                  </button>
                )}

                <div className="ml-auto">
                  {isUpdatingStatus ? (
                    <Loader2 className="h-4 w-4 animate-spin text-on-surface-variant" />
                  ) : (
                    <select
                      value={job.status}
                      onChange={(e) => onStatusChange(job.id, e.target.value as JobStatus)}
                      className="bg-surface border border-outline-variant rounded px-3 py-1.5 text-xs font-mono-data text-on-surface-variant focus:border-primary focus:ring-1 focus:ring-primary transition-all cursor-pointer"
                      aria-label="Job status"
                    >
                      {ALL_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 2 Sub-Columns */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Left Sub-column: Match & Notes */}
          <div className="xl:col-span-1 space-y-6">
            {/* Match Score Module */}
            <div className="bg-surface/80 backdrop-blur-md border border-outline-variant rounded-xl p-5 shadow-[0_0_15px_rgba(255,140,0,0.05)]">
              <details className="group" open>
                <summary className="flex justify-between items-center cursor-pointer mb-4 border-b border-outline-variant/50 pb-2 outline-none">
                  <h3 className="font-section-label text-xs text-on-surface-variant uppercase tracking-widest">
                    EVIDENCE MATCH &amp; GAPS
                  </h3>
                  <ChevronDown
                    className="h-5 w-5 text-on-surface-variant transition-transform group-open:rotate-180"
                    aria-hidden
                  />
                </summary>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full border-2 border-primary/40 flex items-center justify-center font-bold text-xs text-primary bg-primary/10">
                    {checklist.percent}%
                  </div>
                  <div className="text-sm font-body-dense text-on-surface-variant">
                    <span className="text-on-surface font-bold">
                      {checklist.percent >= 70
                        ? "High match"
                        : checklist.percent >= 40
                        ? "Partial match"
                        : "Low match"}
                    </span>{" "}
                    — {checklist.matched} of {checklist.total} requirements backed by evidence.
                  </div>
                </div>
                <ul className="space-y-2 font-mono-data text-xs">
                  {checklist.items.map((item) => (
                    <li key={item.label} className="flex items-center gap-2 text-on-surface-variant">
                      {item.matched ? (
                        <Check className="h-4 w-4 shrink-0 text-secondary" aria-hidden />
                      ) : (
                        <X className="h-4 w-4 shrink-0 text-error" aria-hidden />
                      )}
                      <span>{item.label}</span>
                    </li>
                  ))}
                </ul>
              </details>
            </div>

            {/* Notes Module */}
            {showNotes && (
              <div className="bg-surface/80 backdrop-blur-md border border-outline-variant rounded-xl p-5 shadow-[0_0_15px_rgba(255,140,0,0.05)] flex flex-col">
                <h3 className="font-section-label text-xs text-on-surface-variant mb-3 border-b border-outline-variant/50 pb-2 uppercase tracking-widest">
                  NOTES
                </h3>
                <label htmlFor={`notes-${job.id}`} className="sr-only">
                  Job notes
                </label>
                <textarea
                  id={`notes-${job.id}`}
                  data-testid={`notes-textarea-${job.id}`}
                  value={notesValue}
                  onChange={(e) => onNotesChange(job.id, e.target.value)}
                  className="w-full bg-background border border-outline-variant rounded p-3 text-sm font-mono-data text-on-surface outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors resize-y min-h-[120px] mb-3"
                  placeholder="Add custom notes here…"
                />
                <button
                  type="button"
                  data-testid={`notes-save-btn-${job.id}`}
                  disabled={isSavingNotes}
                  onClick={() => onSaveNotes(job.id)}
                  className="px-3 py-1.5 rounded bg-surface-variant border border-outline text-on-surface text-xs font-mono-data self-start hover:border-primary hover:text-primary transition-colors flex items-center gap-1 disabled:opacity-50 min-h-11"
                >
                  {isSavingNotes ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  Save Notes
                </button>
              </div>
            )}
          </div>

          {/* Right Sub-column: Job Details */}
          <div className="xl:col-span-2">
            <div className="bg-surface/80 backdrop-blur-md border border-outline-variant rounded-xl p-6 shadow-[0_0_15px_rgba(255,140,0,0.05)] h-full flex flex-col">
              <div className="flex justify-between items-center mb-4 border-b border-outline-variant/50 pb-2 sticky top-0 bg-surface/90 backdrop-blur-md z-10 py-2">
                <h3 className="font-section-label text-xs text-on-surface-variant uppercase tracking-widest">
                  JOB DETAILS
                </h3>
                {isPlaceholder && (
                  <button
                    type="button"
                    data-testid={`fetch-fulltext-btn-${job.id}`}
                    disabled={isFetchingFullText}
                    onClick={() => onFetchFullText(job.id)}
                    className="inline-flex items-center gap-1.5 rounded border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-mono-data text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
                  >
                    {isFetchingFullText ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <DownloadCloud className="h-3 w-3" />
                    )}
                    Pull Full Description
                  </button>
                )}
              </div>

              {tier2Notice && (
                <p className="mb-2 text-xs italic text-primary/90">{tier2Notice}</p>
              )}

              <div className="prose prose-invert max-w-none font-body-regular text-sm text-on-surface/90 space-y-4 pr-2 whitespace-pre-wrap leading-relaxed">
                {convertHtmlToCleanMarkdown(detailJob.rawDescription ?? "")}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (isSheet) {
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col bg-background overflow-y-auto"
        data-testid="job-detail-sheet"
        role="dialog"
        aria-modal="true"
      >
        {content}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background/50 relative" data-testid="job-detail-pane">
      {content}
    </div>
  );
}
