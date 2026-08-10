"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import {
  Search,
  Plus,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { JobStatus } from "@/lib/db/jobs";
import { AppShell } from "@/components/design-system/app-shell";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrackerSubNav,
  TrackerRefreshButton,
} from "@/components/tracker/tracker-sub-nav";
import { JobListRow } from "@/components/tracker/job-list-row";
import { JobDetailPane } from "@/components/tracker/job-detail-pane";
import type {
  JobItem,
  JobVariant,
  JobCoverLetter,
} from "@/components/tracker/job-types";
import {
  extractLocationFromNotes,
  extractApplyUrlFromNotes,
  extractPostingDateFromNotes,
  extractSalaryFromNotes,
  isPlaceholderDescription,
} from "@/lib/ingestion/helpers";
import {
  filterByPostedWithin,
  type PostedWithin,
} from "@/lib/jobs/posted-within";

export type { JobItem, JobVariant, JobCoverLetter };

export {
  extractLocationFromNotes,
  extractApplyUrlFromNotes,
  extractPostingDateFromNotes,
  extractSalaryFromNotes,
  isPlaceholderDescription,
};

const PAGE_SIZE = 40;

const STATUS_LABELS: Record<JobStatus, string> = {
  SAVED: "Saved",
  APPLIED: "Applied",
  INTERVIEWING: "Interviewing",
  OFFER: "Offer",
  REJECTED: "Rejected",
  ARCHIVED: "Archived",
};

const ALL_STATUSES = Object.keys(STATUS_LABELS) as JobStatus[];

const POSTED_OPTIONS: { value: PostedWithin; label: string }[] = [
  { value: "all", label: "Any time" },
  { value: "1d", label: "Last 24h" },
  { value: "3d", label: "Last 3 days" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
];

interface TrackerFeedProps {
  filterStatuses?: JobStatus[];
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let index = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) {
      const current = items[index++];
      await worker(current);
    }
  });
  await Promise.all(runners);
}

export function TrackerFeed({ filterStatuses }: TrackerFeedProps) {
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<JobStatus | "ALL">("ALL");
  const [postedWithin, setPostedWithin] = useState<PostedWithin>("all");
  const [page, setPage] = useState(1);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [editingNotes, setEditingNotes] = useState<{ [id: string]: string }>({});
  const [isSavingNotes, setIsSavingNotes] = useState<{ [id: string]: boolean }>({});
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<{ [id: string]: boolean }>({});
  const [isFetchingTier2, setIsFetchingTier2] = useState<Record<string, boolean>>({});
  const [tier2Notice, setTier2Notice] = useState<Record<string, string>>({});
  const [isImporting, setIsImporting] = useState(false);
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const [isBulkImportingDescriptions, setIsBulkImportingDescriptions] = useState(false);
  const activeCardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const saved = sessionStorage.getItem("resumeforge_active_job_id");
    if (saved) setActiveJobId(saved);
  }, []);

  const fetchJobs = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/jobs");
      const json = await res.json();
      if (res.ok && json.success) {
        setJobs(json.data);
        const notesMap: { [id: string]: string } = {};
        json.data.forEach((j: JobItem) => {
          notesMap[j.id] = j.notes || "";
        });
        setEditingNotes(notesMap);
      }
    } catch (err) {
      console.error("Failed to fetch jobs:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    if (!isLoading && activeJobId && activeCardRef.current) {
      activeCardRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [isLoading, activeJobId, page]);

  // Reset page when filters/search change
  useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter, postedWithin, filterStatuses]);

  const handleSelectJob = (jobId: string) => {
    setActiveJobId(jobId);
    sessionStorage.setItem("resumeforge_active_job_id", jobId);
    // Mobile: open full-screen sheet
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches) {
      setMobileSheetOpen(true);
    }
  };

  const handleCloseSheet = () => {
    setMobileSheetOpen(false);
  };

  const handleStatusChange = async (jobId: string, newStatus: JobStatus) => {
    setIsUpdatingStatus((p) => ({ ...p, [jobId]: true }));
    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setJobs((prev) =>
          prev.map((j) =>
            j.id === jobId ? { ...j, status: newStatus, appliedAt: json.data.appliedAt } : j,
          ),
        );
      }
    } catch {
      console.error("Failed to update status");
    } finally {
      setIsUpdatingStatus((p) => ({ ...p, [jobId]: false }));
    }
  };

  const handleSaveNotes = async (jobId: string) => {
    setIsSavingNotes((p) => ({ ...p, [jobId]: true }));
    try {
      await fetch(`/api/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: editingNotes[jobId] || "" }),
      });
    } catch {
      console.error("Failed to save notes");
    } finally {
      setIsSavingNotes((p) => ({ ...p, [jobId]: false }));
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    if (!confirm("Delete this job posting from the tracker?")) return;
    try {
      await fetch(`/api/jobs/${jobId}`, { method: "DELETE" });
      setJobs((prev) => prev.filter((j) => j.id !== jobId));
      if (activeJobId === jobId) {
        setActiveJobId(null);
        sessionStorage.removeItem("resumeforge_active_job_id");
        setMobileSheetOpen(false);
      }
    } catch {
      console.error("Failed to delete job");
    }
  };

  const handleFetchFullText = async (jobId: string) => {
    setIsFetchingTier2((p) => ({ ...p, [jobId]: true }));
    setTier2Notice((p) => ({ ...p, [jobId]: "" }));

    try {
      const res = await fetch(`/api/jobs/${jobId}/fetch-fulltext`, { method: "POST" });
      const json = await res.json();
      if (res.ok && json.success && json.data) {
        setJobs((prev) =>
          prev.map((j) => (j.id === jobId ? { ...j, rawDescription: json.data.rawDescription } : j)),
        );
        setTier2Notice((p) => ({
          ...p,
          [jobId]: json.cached
            ? "Loaded full description from cache."
            : "Successfully extracted full job description!",
        }));
      } else {
        setTier2Notice((p) => ({
          ...p,
          [jobId]:
            json.error ||
            "Couldn't extract automatically. Click Tailor Resume to paste manually.",
        }));
      }
    } catch {
      setTier2Notice((p) => ({ ...p, [jobId]: "Network error fetching full description." }));
    } finally {
      setIsFetchingTier2((p) => ({ ...p, [jobId]: false }));
    }
  };

  const handleRefreshFromSource = async () => {
    try {
      setIsImporting(true);
      setImportNotice(null);
      const res = await fetch("/api/jobs/bulk-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json();

      if (res.ok && json.success) {
        setImportNotice(
          `Imported ${json.createdCount} new jobs (${json.skippedCount} existing skipped).`,
        );
        fetchJobs();
        setTimeout(() => setImportNotice(null), 5000);
      } else {
        setImportNotice(json.error || "Failed to refresh jobs from source.");
      }
    } catch (err) {
      console.error("Failed to refresh jobs from source:", err);
      setImportNotice("Network error refreshing jobs.");
    } finally {
      setIsImporting(false);
    }
  };

  const handleToggleNotes = (jobId: string) => {
    handleSelectJob(jobId);
  };

  const effectiveStatuses = filterStatuses ?? ALL_STATUSES;

  const filteredJobs = useMemo(
    () =>
      filterByPostedWithin(
        jobs.filter((j) => {
          const matchStatus =
            statusFilter === "ALL"
              ? effectiveStatuses.includes(j.status)
              : j.status === statusFilter && effectiveStatuses.includes(j.status);
          const q = searchQuery.toLowerCase().trim();
          const matchSearch =
            !q ||
            (j.company || "").toLowerCase().includes(q) ||
            (j.roleTitle || "").toLowerCase().includes(q) ||
            j.rawDescription.toLowerCase().includes(q);
          return matchStatus && matchSearch;
        }),
        postedWithin,
        (j) => extractPostingDateFromNotes(j.notes) || null,
        (j) => j.createdAt,
      ),
    [jobs, statusFilter, searchQuery, postedWithin, effectiveStatuses],
  );

  const totalPages = Math.max(1, Math.ceil(filteredJobs.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageJobs = filteredJobs.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Selected job from full filtered list (even if off-page)
  const selectedJob = activeJobId
    ? filteredJobs.find((j) => j.id === activeJobId) ?? null
    : null;

  // If selected job is off current page, jump to its page
  useEffect(() => {
    if (!activeJobId) return;
    const idx = filteredJobs.findIndex((j) => j.id === activeJobId);
    if (idx < 0) return;
    const targetPage = Math.floor(idx / PAGE_SIZE) + 1;
    setPage((p) => (p === targetPage ? p : targetPage));
  }, [activeJobId, filteredJobs]);

  const placeholderFiltered = filteredJobs.filter((j) =>
    isPlaceholderDescription(j.rawDescription),
  );

  const handleBulkImportDescriptions = async () => {
    if (placeholderFiltered.length === 0) {
      setImportNotice("No placeholder jobs in the current filter to import.");
      setTimeout(() => setImportNotice(null), 4000);
      return;
    }

    setIsBulkImportingDescriptions(true);
    let success = 0;
    let failed = 0;
    const total = placeholderFiltered.length;
    setImportNotice(`Importing descriptions: 0 / ${total}…`);

    await runWithConcurrency(placeholderFiltered, 3, async (job) => {
      try {
        const res = await fetch(`/api/jobs/${job.id}/fetch-fulltext`, { method: "POST" });
        const json = await res.json();
        if (res.ok && json.success && json.data) {
          success += 1;
          setJobs((prev) =>
            prev.map((j) =>
              j.id === job.id ? { ...j, rawDescription: json.data.rawDescription } : j,
            ),
          );
        } else {
          failed += 1;
        }
      } catch {
        failed += 1;
      }
      setImportNotice(
        `Importing descriptions: ${success + failed} / ${total} (${success} ok, ${failed} failed)…`,
      );
    });

    setImportNotice(
      `Imported descriptions: ${success} succeeded, ${failed} failed of ${total}.`,
    );
    setIsBulkImportingDescriptions(false);
    setTimeout(() => setImportNotice(null), 6000);
  };

  const pipelineApplied = jobs.filter(
    (j) => j.status === "APPLIED" || j.status === "INTERVIEWING" || j.status === "OFFER",
  ).length;
  const pipelineInterviewing = jobs.filter((j) => j.status === "INTERVIEWING").length;

  return (
    <AppShell variant="tracker">
      <TrackerSubNav
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="bulk-import-descriptions-btn"
              onClick={handleBulkImportDescriptions}
              disabled={isBulkImportingDescriptions || isLoading}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-rf-surface px-3 py-1.5 text-xs font-medium text-rf-cloud transition-colors duration-150 hover:bg-rf-elevated disabled:opacity-50"
              title="Pull full descriptions for filtered placeholder jobs"
            >
              {isBulkImportingDescriptions ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : null}
              <span className="hidden sm:inline">Import descriptions</span>
              <span className="sm:hidden">Import</span>
            </button>
            <TrackerRefreshButton onClick={handleRefreshFromSource} isImporting={isImporting} />
          </div>
        }
      />

      {importNotice && (
        <div
          data-testid="import-status-notice"
          className="border-b border-amber-800/80 bg-amber-950/80 px-4 py-2 text-center text-xs font-medium text-amber-200"
        >
          {importNotice}
        </div>
      )}

      {/* Sticky filter bar */}
      <div className="sticky top-[96px] z-[9] flex flex-wrap items-center gap-2 border-b border-slate-800 bg-rf-bg px-4 py-2.5">
        <div className="relative min-w-[180px] flex-1 sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search company, role…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-md border border-slate-700 bg-rf-elevated py-1.5 pl-8 pr-3 text-[12.5px] text-rf-cloud placeholder-slate-500 transition-colors duration-150 focus:border-amber-500/60 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {POSTED_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setPostedWithin(value)}
              data-testid={`tracker-posted-${value}`}
              className={
                postedWithin === value
                  ? "rounded-md border border-amber-500 bg-amber-500/15 px-2.5 py-1.5 text-[12.5px] text-amber-400 transition-colors duration-150"
                  : "rounded-md border border-slate-700 bg-rf-elevated px-2.5 py-1.5 text-[12.5px] text-rf-meta transition-colors duration-150 hover:text-rf-cloud"
              }
            >
              {label}
            </button>
          ))}
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as JobStatus | "ALL")}
          className="rounded-md border border-slate-700 bg-rf-elevated px-2.5 py-1.5 text-[12.5px] text-rf-meta transition-colors duration-150 focus:border-amber-500/60 focus:outline-none cursor-pointer"
          aria-label="Filter by status"
        >
          <option value="ALL">All Statuses</option>
          {effectiveStatuses.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>

        <div className="ml-auto flex flex-wrap items-center gap-3 text-[12.5px] text-slate-500">
          <span className="hidden md:inline">
            Pipeline: <span className="text-rf-cloud">{jobs.length}</span>
            {" · "}
            Applied <span className="text-amber-400">{pipelineApplied}</span>
            {" · "}
            Interviewing <span className="text-emerald-400">{pipelineInterviewing}</span>
          </span>
          <span>
            {isLoading ? "Loading…" : `${filteredJobs.length} job${filteredJobs.length !== 1 ? "s" : ""}`}
          </span>
          <Link
            href="/tailor"
            className="inline-flex items-center gap-1 rounded-md bg-amber-500 px-2.5 py-1.5 text-xs font-semibold text-rf-bg transition-colors duration-150 hover:bg-amber-400"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Job
          </Link>
        </div>
      </div>

      <main className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* List pane */}
        <div className="flex max-h-[calc(100vh-160px)] w-full flex-col border-r border-slate-800 lg:max-h-none lg:h-full lg:min-h-0 lg:w-[400px] lg:shrink-0">
          <div className="min-h-0 flex-1 overflow-y-auto">
            {isLoading && (
              <div className="space-y-0 p-0">
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="h-[110px] w-full rounded-none border-b border-slate-800 bg-rf-surface" />
                ))}
              </div>
            )}

            {!isLoading && filteredJobs.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-4 px-4 py-20 text-center">
                <Briefcase className="h-12 w-12 text-slate-700" />
                <div>
                  <p className="font-medium text-rf-meta">No jobs found</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {searchQuery
                      ? "Try adjusting your search query."
                      : "Go to the Tailor workspace to paste a job posting."}
                  </p>
                </div>
                <Link
                  href="/tailor"
                  className="mt-2 rounded-lg bg-amber-500 px-4 py-2 text-xs font-semibold text-rf-bg transition-colors duration-150 hover:bg-amber-400"
                >
                  Add Your First Job
                </Link>
              </div>
            )}

            {!isLoading &&
              pageJobs.map((job) => (
                <JobListRow
                  key={job.id}
                  job={job}
                  isSelected={job.id === activeJobId}
                  isUpdatingStatus={Boolean(isUpdatingStatus[job.id])}
                  isFetchingFullText={Boolean(isFetchingTier2[job.id])}
                  onSelect={handleSelectJob}
                  onStatusChange={handleStatusChange}
                  onFetchFullText={handleFetchFullText}
                  onDelete={handleDeleteJob}
                  onToggleNotes={handleToggleNotes}
                  rowRef={job.id === activeJobId ? activeCardRef : undefined}
                />
              ))}
          </div>

          {/* Pagination */}
          {!isLoading && filteredJobs.length > 0 && (
            <div className="flex shrink-0 items-center justify-between gap-2 border-t border-slate-800 bg-rf-bg px-3 py-2">
              <button
                type="button"
                data-testid="jobs-page-prev"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2.5 py-1.5 text-xs text-rf-meta transition-colors duration-150 hover:text-rf-cloud disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Prev
              </button>
              <span className="text-xs text-slate-500" data-testid="jobs-page-indicator">
                Page {safePage} of {totalPages}
              </span>
              <button
                type="button"
                data-testid="jobs-page-next"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2.5 py-1.5 text-xs text-rf-meta transition-colors duration-150 hover:text-rf-cloud disabled:opacity-40"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Desktop detail pane */}
        <div className="hidden min-h-0 min-w-0 flex-1 lg:block">
          {selectedJob ? (
            <JobDetailPane
              job={selectedJob}
              notesValue={editingNotes[selectedJob.id] ?? ""}
              isSavingNotes={Boolean(isSavingNotes[selectedJob.id])}
              isUpdatingStatus={Boolean(isUpdatingStatus[selectedJob.id])}
              isFetchingFullText={Boolean(isFetchingTier2[selectedJob.id])}
              tier2Notice={tier2Notice[selectedJob.id]}
              showNotes
              onStatusChange={handleStatusChange}
              onNotesChange={(id, value) =>
                setEditingNotes((prev) => ({ ...prev, [id]: value }))
              }
              onSaveNotes={handleSaveNotes}
              onFetchFullText={handleFetchFullText}
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-rf-surface px-6 text-center">
              <p className="text-sm text-rf-meta">Select a job to view details and evidence match.</p>
            </div>
          )}
        </div>
      </main>

      {/* Mobile full-screen detail sheet */}
      {mobileSheetOpen && selectedJob && (
        <div className="lg:hidden">
          <JobDetailPane
            job={selectedJob}
            notesValue={editingNotes[selectedJob.id] ?? ""}
            isSavingNotes={Boolean(isSavingNotes[selectedJob.id])}
            isUpdatingStatus={Boolean(isUpdatingStatus[selectedJob.id])}
            isFetchingFullText={Boolean(isFetchingTier2[selectedJob.id])}
            tier2Notice={tier2Notice[selectedJob.id]}
            showNotes
            isSheet
            onClose={handleCloseSheet}
            onStatusChange={handleStatusChange}
            onNotesChange={(id, value) =>
              setEditingNotes((prev) => ({ ...prev, [id]: value }))
            }
            onSaveNotes={handleSaveNotes}
            onFetchFullText={handleFetchFullText}
          />
        </div>
      )}
    </AppShell>
  );
}
