"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ExternalLink,
  FileText,
  Loader2,
  MoreHorizontal,
  Trash2,
  DownloadCloud,
} from "lucide-react";
import { JobStatus } from "@/lib/db/jobs";
import {
  extractLocationFromNotes,
  extractApplyUrlFromNotes,
  extractPostingDateFromNotes,
  extractSalaryFromNotes,
  isPlaceholderDescription,
} from "@/lib/ingestion/helpers";
import type { JobItem } from "@/components/tracker/job-types";
import { isSafeHref } from "@/lib/security/safe-fetch";
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

const AVATAR_COLORS = [
  "bg-sky-500",
  "bg-rose-400",
  "bg-emerald-400",
  "bg-amber-500 text-rf-bg",
  "bg-cyan-400",
  "bg-orange-400",
  "bg-teal-400",
];

export function companyAvatarClass(company?: string | null): string {
  const seed = (company || "J").charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[seed];
}

interface JobListRowProps {
  job: JobItem;
  isSelected: boolean;
  isUpdatingStatus: boolean;
  isFetchingFullText: boolean;
  onSelect: (jobId: string) => void;
  onStatusChange: (jobId: string, status: JobStatus) => void;
  onFetchFullText: (jobId: string) => void;
  onDelete: (jobId: string) => void;
  onToggleNotes: (jobId: string) => void;
  rowRef?: React.Ref<HTMLDivElement>;
}

export function JobListRow({
  job,
  isSelected,
  isUpdatingStatus,
  isFetchingFullText,
  onSelect,
  onStatusChange,
  onFetchFullText,
  onDelete,
  onToggleNotes,
  rowRef,
}: JobListRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const location = extractLocationFromNotes(job.notes);
  const applyUrl = extractApplyUrlFromNotes(job.notes);
  const datePosted = extractPostingDateFromNotes(job.notes);
  const salary = extractSalaryFromNotes(job.notes);
  const isPlaceholder = job.isPlaceholder ?? isPlaceholderDescription(job.rawDescription);
  const companyInitial = job.company ? job.company[0].toUpperCase() : "J";
  const hasCoverLetter = Boolean(job.coverLetters && job.coverLetters.length > 0);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  const metaParts = [
    job.company || "Unknown Company",
    location || null,
    datePosted || null,
  ].filter(Boolean);

  return (
    <div
      ref={rowRef}
      data-testid={`tracker-job-card-${job.id}`}
      role="button"
      tabIndex={0}
      onClick={() => onSelect(job.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(job.id);
        }
      }}
      className={cn(
        "flex gap-3 border-b border-slate-800/80 px-4 py-3.5 cursor-pointer transition-colors duration-150",
        isSelected
          ? "bg-rf-surface shadow-[inset_3px_0_0_#f59e0b]"
          : "bg-rf-bg hover:bg-[#0e1219]",
      )}
    >
      <div
        className={cn(
          "flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg text-sm font-bold text-rf-bg",
          companyAvatarClass(job.company),
        )}
      >
        {companyInitial}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-[13.5px] font-semibold leading-snug text-rf-cloud">
              {job.roleTitle || "Untitled Role"}
            </h3>
            <p className="mt-0.5 text-xs text-rf-meta">{metaParts.join(" · ")}</p>
          </div>

          <div
            className="shrink-0"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {isUpdatingStatus ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-rf-meta" />
            ) : (
              <select
                value={job.status}
                data-testid={`job-status-select-${job.id}`}
                onChange={(e) => onStatusChange(job.id, e.target.value as JobStatus)}
                className="appearance-none rounded-full border border-slate-700 bg-rf-elevated px-2.5 py-1 pr-6 text-[11px] text-rf-meta transition-colors duration-150 focus:border-amber-500/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 cursor-pointer"
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

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {salary ? (
            <span className="rounded border border-emerald-800/60 bg-emerald-950/50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-400">
              {salary}
            </span>
          ) : (
            <span className="py-0.5 text-[11px] italic text-slate-500">No salary</span>
          )}
          {isPlaceholder && (
            <span className="text-[11px] text-slate-500">Needs description</span>
          )}
        </div>

        <div
          className="relative mt-2.5 flex items-center gap-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          <Link
            href={`/tailor?jobId=${job.id}`}
            data-testid={`tailor-resume-btn-${job.id}`}
            onClick={() => {
              sessionStorage.setItem("resumeforge_active_job_id", job.id);
            }}
            className="rounded-md bg-amber-500 px-2.5 py-1.5 text-xs font-bold text-rf-bg transition-colors duration-150 hover:bg-amber-400"
          >
            Tailor Resume
          </Link>

          {isSafeHref(applyUrl) ? (
            <a
              href={applyUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-testid={`open-original-btn-${job.id}`}
              title="Open posting"
              className="rounded-md border border-slate-700 p-1.5 text-rf-meta transition-colors duration-150 hover:text-rf-cloud"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : (
            <button
              type="button"
              disabled
              data-testid={`open-original-btn-disabled-${job.id}`}
              title="No external apply link"
              className="cursor-not-allowed rounded-md border border-slate-800 p-1.5 text-slate-600 opacity-60"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
          )}

          <div className="relative ml-auto" ref={menuRef}>
            <button
              type="button"
              aria-label="More actions"
              onClick={() => setMenuOpen((o) => !o)}
              className="rounded-md p-1.5 text-slate-500 transition-colors duration-150 hover:bg-rf-elevated hover:text-rf-cloud"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 z-20 mt-1 w-52 overflow-hidden rounded-lg border border-slate-700 bg-rf-elevated shadow-xl">
                <Link
                  href={`/tailor?jobId=${job.id}&tab=cover-letter`}
                  onClick={() => {
                    sessionStorage.setItem("resumeforge_active_job_id", job.id);
                    setMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-rf-cloud transition-colors duration-150 hover:bg-slate-800"
                >
                  <FileText className="h-3.5 w-3.5 text-amber-400" />
                  {hasCoverLetter ? "Open Cover Letter" : "Cover Letter"}
                </Link>

                {isPlaceholder && (
                  <button
                    type="button"
                    disabled={isFetchingFullText}
                    onClick={() => {
                      onFetchFullText(job.id);
                      setMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-rf-cloud transition-colors duration-150 hover:bg-slate-800 disabled:opacity-50"
                  >
                    {isFetchingFullText ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <DownloadCloud className="h-3.5 w-3.5 text-amber-400" />
                    )}
                    Pull Full Description
                  </button>
                )}

                <button
                  type="button"
                  data-testid={`notes-toggle-btn-${job.id}`}
                  onClick={() => {
                    onToggleNotes(job.id);
                    setMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-rf-cloud transition-colors duration-150 hover:bg-slate-800"
                >
                  <FileText className="h-3.5 w-3.5" />
                  Notes
                </button>

                <button
                  type="button"
                  data-testid={`delete-job-btn-${job.id}`}
                  onClick={() => {
                    onDelete(job.id);
                    setMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-red-400 transition-colors duration-150 hover:bg-red-950/40"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
