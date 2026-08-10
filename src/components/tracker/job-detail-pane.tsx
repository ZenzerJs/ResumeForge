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
import { companyAvatarClass } from "@/components/tracker/job-list-row";
import { cn } from "@/lib/utils";

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
  /** Mobile full-screen sheet mode */
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

  const location = extractLocationFromNotes(job.notes);
  const applyUrl = extractApplyUrlFromNotes(job.notes);
  const datePosted = extractPostingDateFromNotes(job.notes);
  const salary = extractSalaryFromNotes(job.notes);
  const isPlaceholder = isPlaceholderDescription(job.rawDescription);
  const companyInitial = job.company ? job.company[0].toUpperCase() : "J";
  const hasCoverLetter = Boolean(job.coverLetters && job.coverLetters.length > 0);

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

  const metaLine = [
    job.company || "Unknown Company",
    location || null,
    datePosted ? `Posted ${datePosted}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const ringDeg = Math.round((checklist.percent / 100) * 360);

  const coverTestId = hasCoverLetter
    ? `open-cover-letter-btn-${job.id}`
    : `generate-cover-letter-btn-${job.id}`;

  const content = (
    <div className={cn("mx-auto max-w-[640px]", isSheet ? "p-5 pb-16" : "px-8 py-7 pb-16")}>
      {isSheet && (
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close job detail"
            data-testid="job-detail-close-btn"
            className="rounded-lg border border-slate-700 p-2 text-rf-meta transition-colors duration-150 hover:bg-rf-elevated hover:text-rf-cloud"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="mb-4 flex items-start gap-3.5">
        <div
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-[10px] text-lg font-extrabold text-rf-bg",
            companyAvatarClass(job.company),
          )}
        >
          {companyInitial}
        </div>
        <div className="min-w-0">
          <h2 className="m-0 text-xl font-bold text-rf-cloud">
            {job.roleTitle || "Untitled Role"}
          </h2>
          <p className="mt-1 text-[13px] text-rf-meta">{metaLine}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {salary ? (
              <span className="rounded border border-emerald-800/60 bg-emerald-950/50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-400">
                {salary}
              </span>
            ) : (
              <span className="text-[11px] italic text-slate-500">No salary listed</span>
            )}
          </div>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Link
          href={`/tailor?jobId=${job.id}`}
          onClick={() => sessionStorage.setItem("resumeforge_active_job_id", job.id)}
          className="rounded-lg bg-amber-500 px-4 py-2 text-[13px] font-bold text-rf-bg transition-colors duration-150 hover:bg-amber-400"
        >
          Tailor Resume
        </Link>

        <Link
          href={`/tailor?jobId=${job.id}&tab=cover-letter`}
          data-testid={coverTestId}
          onClick={() => sessionStorage.setItem("resumeforge_active_job_id", job.id)}
          className="rounded-lg border border-slate-700 px-3.5 py-2 text-[13px] text-rf-cloud transition-colors duration-150 hover:bg-rf-elevated"
        >
          {hasCoverLetter ? "Open Cover Letter" : "Generate Cover Letter"}
        </Link>

        {applyUrl && applyUrl.startsWith("http") ? (
          <a
            href={applyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3.5 py-2 text-[13px] text-rf-cloud transition-colors duration-150 hover:bg-rf-elevated"
          >
            Open Posting
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : (
          <button
            type="button"
            disabled
            className="cursor-not-allowed rounded-lg border border-slate-800 px-3.5 py-2 text-[13px] text-slate-600 opacity-60"
          >
            Open Posting
          </button>
        )}

        <div className="ml-auto">
          {isUpdatingStatus ? (
            <Loader2 className="h-4 w-4 animate-spin text-rf-meta" />
          ) : (
            <select
              value={job.status}
              onChange={(e) => onStatusChange(job.id, e.target.value as JobStatus)}
              className="appearance-none rounded-lg border border-slate-700 bg-rf-elevated px-3 py-2 text-xs text-rf-meta transition-colors duration-150 focus:border-amber-500/60 focus:outline-none cursor-pointer"
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

      <div className="mb-4 rounded-[10px] border border-slate-800 bg-rf-elevated p-4">
        <h3 className="mb-3 text-[12.5px] font-bold uppercase tracking-wide text-rf-meta">
          Match against your Evidence Bank
        </h3>
        {!evidenceLoaded ? (
          <div className="flex items-center gap-2 text-xs text-rf-meta">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading evidence…
          </div>
        ) : checklist.total === 0 ? (
          <p className="text-xs text-rf-meta">
            No extracted requirements for this posting yet.
          </p>
        ) : (
          <>
            <div className="mb-3.5 flex items-center gap-2.5">
              <div
                className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full"
                style={{
                  background: `conic-gradient(#3ecf8e 0deg ${ringDeg}deg, #26313f ${ringDeg}deg 360deg)`,
                }}
                aria-hidden
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-rf-elevated text-[10.5px] font-bold text-emerald-400">
                  {checklist.percent}%
                </span>
              </div>
              <p className="text-[13px] text-rf-meta">
                {checklist.percent >= 70
                  ? "Solid match"
                  : checklist.percent >= 40
                    ? "Partial match"
                    : "Low match"}{" "}
                —{" "}
                <span className="font-semibold text-rf-cloud">
                  {checklist.matched} of {checklist.total}
                </span>{" "}
                stated requirements backed by evidence
              </p>
            </div>
            <ul className="flex flex-col gap-2">
              {checklist.items.map((item) => (
                <li
                  key={item.label}
                  className={cn(
                    "flex items-center gap-2 text-[12.5px]",
                    item.matched ? "text-rf-cloud" : "text-rf-meta",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold",
                      item.matched
                        ? "bg-emerald-950 text-emerald-400"
                        : "bg-red-950/80 text-red-400",
                    )}
                  >
                    {item.matched ? <Check className="h-2.5 w-2.5" /> : "✕"}
                  </span>
                  {item.label}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="mb-4 rounded-[10px] border border-slate-800 bg-rf-elevated p-4">
        <h3 className="mb-3 text-[12.5px] font-bold uppercase tracking-wide text-rf-meta">
          Job details
        </h3>
        {isPlaceholder && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-slate-500">Needs description</span>
            <button
              type="button"
              data-testid={`fetch-fulltext-btn-${job.id}`}
              disabled={isFetchingFullText}
              onClick={() => onFetchFullText(job.id)}
              className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/15 px-2.5 py-1 text-[11px] font-medium text-amber-400 transition-colors duration-150 hover:bg-amber-500/25 disabled:opacity-50"
            >
              {isFetchingFullText ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <DownloadCloud className="h-3 w-3" />
              )}
              Pull Full Description
            </button>
          </div>
        )}
        {tier2Notice && (
          <p className="mb-2 text-[11px] italic text-amber-300/90">{tier2Notice}</p>
        )}
        <div className="whitespace-pre-wrap text-[13px] leading-relaxed text-slate-300">
          {job.rawDescription}
        </div>
      </div>

      {showNotes && (
        <div className="rounded-[10px] border border-slate-800 bg-rf-elevated p-4 space-y-2">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-rf-meta">
            Notes
          </label>
          <textarea
            rows={4}
            data-testid={`notes-textarea-${job.id}`}
            value={notesValue}
            onChange={(e) => onNotesChange(job.id, e.target.value)}
            placeholder="Interview notes, contacts, next steps..."
            className="w-full resize-none rounded-lg border border-slate-800 bg-rf-bg p-3 font-mono text-xs text-rf-cloud placeholder-slate-600 transition-colors duration-150 focus:border-amber-500/60 focus:outline-none"
          />
          <button
            type="button"
            data-testid={`notes-save-btn-${job.id}`}
            onClick={() => onSaveNotes(job.id)}
            disabled={isSavingNotes}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/15 px-3 py-1.5 text-xs font-medium text-amber-400 transition-colors duration-150 hover:bg-amber-500/25 disabled:opacity-50"
          >
            {isSavingNotes ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Save Notes
          </button>
        </div>
      )}
    </div>
  );

  if (isSheet) {
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col bg-rf-surface"
        data-testid="job-detail-sheet"
        role="dialog"
        aria-modal="true"
      >
        <div className="min-h-0 flex-1 overflow-y-auto">{content}</div>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-rf-surface" data-testid="job-detail-pane">
      {content}
    </div>
  );
}
