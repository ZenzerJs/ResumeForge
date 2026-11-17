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
  Clock,
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
import { isSafeHref } from "@/lib/security/safe-url";
import { cn } from "@/lib/utils";
import { CompanyAvatar } from "@/components/tracker/company-avatar";

const STATUS_LABELS: Record<JobStatus, string> = {
  SAVED: "Saved",
  APPLIED: "Applied",
  INTERVIEWING: "Interviewing",
  OFFER: "Offer",
  REJECTED: "Rejected",
  ARCHIVED: "Archived",
};

const STATUS_BADGE_CLASSES: Record<JobStatus, string> = {
  INTERVIEWING: "border-signal/40 bg-signal/10 text-signal",
  APPLIED: "border-ember/40 bg-ember/10 text-ember",
  OFFER: "border-primary/45 bg-primary/12 text-primary",
  SAVED: "border-outline/70 bg-popover text-on-surface-variant",
  REJECTED: "border-status-danger/40 bg-status-danger/10 text-status-danger",
  ARCHIVED: "border-hairline bg-inset text-text-muted",
};

const ALL_STATUSES = Object.keys(STATUS_LABELS) as JobStatus[];

interface JobListRowProps {
  job: JobItem;
  isSelected: boolean;
  isUpdatingStatus: boolean;
  isFetchingFullText: boolean;
  disambiguator?: string | null;
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
  disambiguator,
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
  const salary =
    job.salaryLabel !== undefined
      ? job.salaryLabel
      : extractSalaryFromNotes(job.notes, job.rawDescription);
  const isPlaceholder = job.isPlaceholder ?? isPlaceholderDescription(job.rawDescription);
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

  return (
    <div
      ref={rowRef}
      data-testid={`tracker-job-card-${job.id}`}
      style={
        isSelected
          ? {
              backgroundImage:
                "linear-gradient(90deg, rgb(var(--accent-action) / 0.09), transparent 60%)",
              boxShadow: "inset 3px 0 0 rgb(var(--accent-action)), var(--shadow-2)",
            }
          : undefined
      }
      className={cn(
        "relative flex gap-3 border-b border-border px-4 py-3.5 card-lift hover:z-10",
        isSelected
          ? "bg-card shadow-[var(--shadow-2)]"
          : "bg-panel/60 hover:bg-panel",
      )}
    >
      <CompanyAvatar company={job.company} className="relative z-10 pointer-events-none h-[34px] w-[34px]" />

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            data-testid={`job-select-btn-${job.id}`}
            aria-pressed={isSelected}
            aria-label={`${job.roleTitle || "Untitled Role"} at ${job.company || "Unknown Company"}`}
            onClick={() => onSelect(job.id)}
            className="min-w-0 flex-1 rounded-[6px] text-left after:absolute after:inset-0 after:z-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <span className="relative z-[1] block min-w-0">
              <h3 className="text-body-dense font-semibold leading-snug text-foreground">
                {job.roleTitle || "Untitled Role"}
              </h3>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                <span>{job.company || "Unknown Company"}</span>
                {location ? <span>· {location}</span> : null}
                {disambiguator ? (
                  <span
                    data-testid={`job-disambiguator-${job.id}`}
                    className="rounded border border-hairline bg-inset px-1.5 py-0.5 font-mono text-xs text-text-secondary"
                  >
                    {disambiguator}
                  </span>
                ) : null}
                {datePosted ? (
                  <span className="inline-flex items-center gap-1">
                    · <Clock className="h-3 w-3 shrink-0" aria-hidden /> {datePosted}
                  </span>
                ) : null}
              </p>
            </span>
          </button>

          <div
            className="relative z-10 shrink-0"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {isUpdatingStatus ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            ) : (
              <select
                value={job.status}
                data-testid={`job-status-select-${job.id}`}
                onChange={(e) => onStatusChange(job.id, e.target.value as JobStatus)}
                className={cn(
                  "appearance-none rounded-full border px-2.5 py-1 pr-6 text-xs font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background cursor-pointer",
                  STATUS_BADGE_CLASSES[job.status] ?? STATUS_BADGE_CLASSES.SAVED,
                )}
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
            <span className="rounded border border-secondary/40 bg-secondary/10 px-1.5 py-0.5 text-xs font-semibold text-secondary">
              {salary}
            </span>
          ) : (
            <span className="py-0.5 text-xs italic text-muted-foreground">No salary</span>
          )}
          {isPlaceholder && (
            <span className="text-xs text-muted-foreground">Needs description</span>
          )}
        </div>

        <div
          className="relative z-10 mt-2.5 flex items-center gap-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          <Link
            href={`/tailor?jobId=${job.id}`}
            data-testid={`tailor-resume-btn-${job.id}`}
            onClick={() => {
              sessionStorage.setItem("resumeforge_active_job_id", job.id);
            }}
            className={cn(
              "rounded-[6px] px-2.5 py-1.5 text-xs font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              isSelected
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "border border-outline text-foreground hover:border-foreground"
            )}
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
              className="rounded-[6px] border border-outline/70 p-1.5 text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : (
            <button
              type="button"
              disabled
              data-testid={`open-original-btn-disabled-${job.id}`}
              title="No external apply link"
              className="cursor-not-allowed rounded-[6px] border border-border p-1.5 text-muted-foreground opacity-60"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
          )}

          <div className="relative ml-auto" ref={menuRef}>
            <button
              type="button"
              aria-label="More actions"
              onClick={() => setMenuOpen((o) => !o)}
              className="rounded-[6px] p-1.5 text-muted-foreground transition-colors duration-150 hover:bg-popover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 z-20 mt-1 w-52 overflow-hidden rounded-[10px] border border-outline/70 bg-popover shadow-xl">
                <Link
                  href={`/tailor?jobId=${job.id}&tab=cover-letter`}
                  onClick={() => {
                    sessionStorage.setItem("resumeforge_active_job_id", job.id);
                    setMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-popover-foreground transition-colors duration-150 hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                >
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
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
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-popover-foreground transition-colors duration-150 hover:bg-card disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                  >
                    {isFetchingFullText ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <DownloadCloud className="h-3.5 w-3.5 text-muted-foreground" />
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
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-popover-foreground transition-colors duration-150 hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
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
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-destructive transition-colors duration-150 hover:bg-destructive/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
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
