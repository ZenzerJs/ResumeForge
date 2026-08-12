"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Search,
  Plus,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MapPin,
} from "lucide-react";
import { JobStatus, type WorkplaceFilter } from "@/lib/db/jobs";
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
import { type PostedWithin } from "@/lib/jobs/posted-within";

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

const WORKPLACE_OPTIONS: { value: WorkplaceFilter; label: string }[] = [
  { value: "all", label: "Any workplace" },
  { value: "remote", label: "Remote" },
  { value: "hybrid", label: "Hybrid" },
  { value: "onsite", label: "On-site" },
];

const FILTER_CONTROL =
  "min-h-11 rounded-md border border-slate-700 bg-rf-elevated px-2.5 text-[12.5px] text-rf-cloud placeholder-slate-500 transition-colors duration-150 focus:border-amber-500/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60";

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
  const [totalJobs, setTotalJobs] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [debouncedLocation, setDebouncedLocation] = useState("");
  const [workplace, setWorkplace] = useState<WorkplaceFilter>("all");
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

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchQuery.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedLocation(locationQuery.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [locationQuery]);

  const fetchJobs = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
        postedWithin,
      });
      if (debouncedSearch) params.set("q", debouncedSearch);
      if (debouncedLocation) params.set("location", debouncedLocation);
      if (workplace !== "all") params.set("workplace", workplace);
      if (statusFilter !== "ALL") {
        params.set("status", statusFilter);
      } else if (filterStatuses?.length) {
        params.set("status", filterStatuses.join(","));
      }
      const res = await fetch(`/api/jobs?${params.toString()}`);
      const json = await res.json();
      if (res.ok && json.success) {
        setJobs(json.data);
        setTotalJobs(json.meta?.total ?? json.data.length);
        setTotalPages(json.meta?.totalPages ?? 1);
        const notesMap: { [id: string]: string } = {};
        json.data.forEach((j: JobItem) => {
          notesMap[j.id] = j.notes || "";
        });
        setEditingNotes((prev) => ({ ...prev, ...notesMap }));
      }
    } catch (err) {
      console.error("Failed to fetch jobs:", err);
    } finally {
      setIsLoading(false);
    }
  }, [page, postedWithin, debouncedSearch, debouncedLocation, workplace, statusFilter, filterStatuses]);

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
  }, [searchQuery, locationQuery, workplace, statusFilter, postedWithin, filterStatuses]);

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
          prev.map((j) =>
            j.id === jobId
              ? { ...j, rawDescription: json.data.rawDescription, isPlaceholder: false }
              : j,
          ),
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
            "Couldn't extract automatically. Click Tailor Resume and paste using the Role / Company / Requirements format.",
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
  const pageJobs = jobs;
  const selectedJob = activeJobId ? jobs.find((j) => j.id === activeJobId) ?? null : null;

  const placeholderFiltered = jobs.filter(
    (j) => j.isPlaceholder ?? isPlaceholderDescription(j.rawDescription),
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
              j.id === job.id
                ? { ...j, rawDescription: json.data.rawDescription, isPlaceholder: false }
                : j,
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
          role="status"
          aria-live="polite"
          className="border-b border-amber-800/80 bg-amber-950/80 px-4 py-2 text-center text-xs font-medium text-amber-200"
        >
          {importNotice}
        </div>
      )}

      {/* Filter subheader — locked, not part of pane scroll */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-800 bg-rf-bg px-4 py-2.5">
        <div className="relative min-w-[180px] flex-1 sm:max-w-xs">
          <label htmlFor="tracker-job-search" className="sr-only">
            Search jobs, companies, or keywords
          </label>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input
            id="tracker-job-search"
            data-testid="tracker-job-search"
            type="search"
            placeholder="Search jobs, companies…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`${FILTER_CONTROL} w-full py-0 pl-8 pr-3`}
          />
        </div>

        <div className="relative min-w-[140px] flex-1 sm:max-w-[180px]">
          <label htmlFor="tracker-location-filter" className="sr-only">
            Filter by location
          </label>
          <MapPin className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input
            id="tracker-location-filter"
            data-testid="tracker-location-filter"
            type="search"
            placeholder="Location"
            value={locationQuery}
            onChange={(e) => setLocationQuery(e.target.value)}
            className={`${FILTER_CONTROL} w-full py-0 pl-8 pr-3`}
          />
        </div>

        <label htmlFor="tracker-posted-select" className="sr-only">
          How recently posted
        </label>
        <select
          id="tracker-posted-select"
          data-testid="tracker-posted-select"
          value={postedWithin}
          onChange={(e) => setPostedWithin(e.target.value as PostedWithin)}
          className={`${FILTER_CONTROL} cursor-pointer text-rf-meta`}
          aria-label="How recently posted"
        >
          {POSTED_OPTIONS.map(({ value, label }) => (
            <option key={value} value={value} data-testid={`tracker-posted-${value}`}>
              {label}
            </option>
          ))}
        </select>

        <label htmlFor="tracker-workplace-filter" className="sr-only">
          Workplace type
        </label>
        <select
          id="tracker-workplace-filter"
          data-testid="tracker-workplace-filter"
          value={workplace}
          onChange={(e) => setWorkplace(e.target.value as WorkplaceFilter)}
          className={`${FILTER_CONTROL} cursor-pointer text-rf-meta`}
          aria-label="Workplace type"
        >
          {WORKPLACE_OPTIONS.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <label htmlFor="tracker-status-filter" className="sr-only">
          Filter by status
        </label>
        <select
          id="tracker-status-filter"
          data-testid="tracker-status-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as JobStatus | "ALL")}
          className={`${FILTER_CONTROL} cursor-pointer text-rf-meta`}
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
            Pipeline: <span className="text-rf-cloud">{totalJobs}</span>
            {" · "}
            Applied <span className="text-amber-400">{pipelineApplied}</span>
            {" · "}
            Interviewing <span className="text-emerald-400">{pipelineInterviewing}</span>
          </span>
          <span>
            {isLoading ? "Loading…" : `${totalJobs} job${totalJobs !== 1 ? "s" : ""}`}
          </span>
          <Link
            href="/tailor"
            className="inline-flex min-h-11 items-center gap-1 rounded-md bg-amber-500 px-2.5 py-1.5 text-xs font-semibold text-rf-bg transition-colors duration-150 hover:bg-amber-400"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Job
          </Link>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* List pane — independent scroll */}
        <div className="flex min-h-0 w-full flex-col border-r border-slate-800 lg:w-[400px] lg:shrink-0">
          <div className="min-h-0 flex-1 overflow-y-auto" data-testid="tracker-job-list">
            {isLoading && (
              <div className="space-y-0 p-0">
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="h-[110px] w-full rounded-none border-b border-slate-800 bg-rf-surface" />
                ))}
              </div>
            )}

            {!isLoading && pageJobs.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-4 px-4 py-20 text-center">
                <Briefcase className="h-12 w-12 text-slate-700" />
                <div>
                  <p className="font-medium text-rf-meta">No jobs found</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {searchQuery || locationQuery
                      ? "Try adjusting search or location filters."
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
          {!isLoading && totalJobs > 0 && (
            <div className="flex shrink-0 items-center justify-between gap-2 border-t border-slate-800 bg-rf-bg px-3 py-2">
              <button
                type="button"
                data-testid="jobs-page-prev"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2.5 py-1.5 text-xs text-rf-meta transition-colors duration-150 hover:text-rf-cloud disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Prev
              </button>
              <span className="text-xs text-slate-500" data-testid="jobs-page-indicator">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                data-testid="jobs-page-next"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2.5 py-1.5 text-xs text-rf-meta transition-colors duration-150 hover:text-rf-cloud disabled:opacity-40"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Desktop detail pane — independent scroll */}
        <div
          className="hidden min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:flex"
          data-testid="tracker-job-detail"
        >
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
      </div>

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
