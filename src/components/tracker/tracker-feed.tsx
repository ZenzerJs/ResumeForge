"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import {
  Search,
  Plus,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MapPin,
  Columns3,
  LayoutList,
} from "lucide-react";
import { JobStatus, type WorkplaceFilter } from "@/lib/db/jobs";
import { AppShell } from "@/components/design-system/app-shell";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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
  normalizeLocation,
  extractApplyUrlFromNotes,
  extractPostingDateFromNotes,
  extractSalaryFromNotes,
  isPlaceholderDescription,
} from "@/lib/ingestion/helpers";
import { matchesPostedWithin, type PostedWithin } from "@/lib/jobs/posted-within";
import {
  buildTrackerDisambiguators,
  collapseDuplicateTrackerJobs,
} from "@/lib/jobs/posting-identity";
import { fetchDemoConfig, fetchSessionUser } from "@/components/auth/session-user";
import { parseJobDescription } from "@/lib/jd-parser/parser";
import {
  HydratedJobDetailSchema,
  type HydratedJobDetail,
} from "@/lib/jd-parser/types";

export type { JobItem, JobVariant, JobCoverLetter };

export {
  extractLocationFromNotes,
  normalizeLocation,
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

const CANADIAN_CITIES: { value: string; label: string }[] = [
  { value: "ALL", label: "All Locations" },
  { value: "toronto", label: "Toronto, ON" },
  { value: "vancouver", label: "Vancouver, BC" },
  { value: "montreal", label: "Montreal, QC" },
  { value: "ottawa", label: "Ottawa, ON" },
  { value: "calgary", label: "Calgary, AB" },
  { value: "waterloo", label: "Waterloo / Kitchener, ON" },
  { value: "edmonton", label: "Edmonton, AB" },
  { value: "victoria", label: "Victoria, BC" },
  { value: "halifax", label: "Halifax, NS" },
  { value: "quebec", label: "Quebec City, QC" },
];

const MIN_SALARY_OPTIONS: { value: string; label: string }[] = [
  { value: "0", label: "Any Salary" },
  { value: "60000", label: "$60k+" },
  { value: "80000", label: "$80k+" },
  { value: "100000", label: "$100k+" },
  { value: "120000", label: "$120k+" },
  { value: "150000", label: "$150k+" },
];

const FILTER_CONTROL =
  "h-11 py-0 leading-normal rounded-md border border-hairline bg-inset px-2.5 text-xs text-rf-cloud placeholder-muted-foreground transition-colors duration-150 focus:border-primary/60";

type ApiPayload<T = unknown> = {
  success?: boolean;
  data?: T;
  error?: string;
  message?: string;
  meta?: {
    total?: number;
    totalPages?: number;
    counts?: { applied: number; interviewing: number };
  };
  cached?: boolean;
  createdCount?: number;
  skippedCount?: number;
  results?: Array<{
    id?: string;
    status?: string;
    rawDescription?: string;
    job?: unknown;
    source?: string;
    skipped?: boolean;
    success?: boolean;
  }>;
};

async function readJsonSafe<T = unknown>(res: Response): Promise<ApiPayload<T> | null> {
  try {
    return (await res.json()) as ApiPayload<T>;
  } catch {
    return null;
  }
}

export function applyHydratedDetailToJobItem(
  job: JobItem,
  detail: HydratedJobDetail
): JobItem {
  return {
    ...job,
    rawDescription: detail.rawDescription,
    isPlaceholder: detail.isPlaceholder,
    hasFullDescription: detail.hasFullDescription,
    extractedRequirements: detail.extractedRequirements,
    requirementsStatus: detail.requirementsStatus,
    requirementsSource: detail.requirementsSource,
    extractFailure: detail.extractFailure,
    notes: detail.notes ?? job.notes,
    salaryLabel: detail.salaryLabel ?? job.salaryLabel,
    company: detail.company ?? job.company,
    roleTitle: detail.roleTitle ?? job.roleTitle,
  };
}

/**
 * Select job IDs eligible for automatic background hydration on /tracker.
 * Cached descriptions with unparsed requirements parse locally without external HTTP,
 * whereas placeholder descriptions requiring external scraping are fetched only for the active job.
 */
export function selectPendingHydrationJobIds(
  jobs: JobItem[],
  activeJobId: string | null,
  attemptedIds: Set<string>
): string[] {
  return jobs
    .filter((j) => {
      if (attemptedIds.has(j.id)) return false;
      const isPlaceholder = j.isPlaceholder ?? isPlaceholderDescription(j.rawDescription);
      const needsDescription = isPlaceholder && !j.extractFailure && j.id === activeJobId;
      const needsRequirements = !isPlaceholder && j.requirementsStatus === "unparsed";
      return needsDescription || needsRequirements;
    })
    .sort((a, b) => Number(b.id === activeJobId) - Number(a.id === activeJobId))
    .map((j) => j.id);
}

export type TrackerAuthStatus = "pending" | "authenticated" | "guest";

export function canAutoHydrateTrackerJobs(params: {
  isLoading: boolean;
  isDemoMode: boolean;
  authStatus: TrackerAuthStatus;
}): boolean {
  return !params.isLoading && !params.isDemoMode && params.authStatus === "authenticated";
}

export function mergePatchedGuestJobs<T extends { id: string }>(prev: T[], next: T[]): T[] {
  return prev.map((job) => next.find((item) => item.id === job.id) ?? job);
}

function formatApiError(res: Response, json: ApiPayload | null, fallback: string): string {
  return json?.message || json?.error || `${fallback} (HTTP ${res.status}).`;
}

interface TrackerFeedProps {
  filterStatuses?: JobStatus[];
}

export function TrackerFeed({ filterStatuses }: TrackerFeedProps) {
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [totalJobs, setTotalJobs] = useState(0);
  const [pipelineCounts, setPipelineCounts] = useState({ applied: 0, interviewing: 0 });
  const [totalPages, setTotalPages] = useState(1);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [authStatus, setAuthStatus] = useState<TrackerAuthStatus>("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [debouncedLocation, setDebouncedLocation] = useState("");
  const [isLocationDropdownOpen, setIsLocationDropdownOpen] = useState(false);
  const [activeLocationIndex, setActiveLocationIndex] = useState(-1);
  const locationComboboxRef = useRef<HTMLDivElement | null>(null);
  const locationListboxId = "tracker-location-listbox";
  const [minSalary, setMinSalary] = useState("0");
  const [workplace, setWorkplace] = useState<WorkplaceFilter>("all");
  const [statusFilter, setStatusFilter] = useState<JobStatus | "ALL">("ALL");
  const [postedWithin, setPostedWithin] = useState<PostedWithin>("all");
  const [page, setPage] = useState(1);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [pendingDeleteJob, setPendingDeleteJob] = useState<{
    id: string;
    label: string;
  } | null>(null);
  const [editingNotes, setEditingNotes] = useState<{ [id: string]: string }>({});
  const [isSavingNotes, setIsSavingNotes] = useState<{ [id: string]: boolean }>({});
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<{ [id: string]: boolean }>({});
  const [isFetchingTier2, setIsFetchingTier2] = useState<Record<string, boolean>>({});
  const [hydratingIds, setHydratingIds] = useState<Record<string, boolean>>({});
  const [tier2Notice, setTier2Notice] = useState<Record<string, string>>({});
  const [isImporting, setIsImporting] = useState(false);
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const [hydrateProgress, setHydrateProgress] = useState<{ done: number; total: number } | null>(null);
  const [viewMode, setViewMode] = useState<"split" | "kanban">("split");
  const [draggedJobId, setDraggedJobId] = useState<string | null>(null);
  const hydrateAttemptedRef = useRef<Set<string>>(new Set());
  const mountedRef = useRef(true);
  const activeCardRef = useRef<HTMLDivElement | null>(null);
  const sheetOpenerRef = useRef<HTMLElement | null>(null);

  const restoreTrackerListFocus = () => {
    const opener = sheetOpenerRef.current;
    if (opener && document.body.contains(opener)) {
      opener.focus();
      return;
    }
    const activeTarget = activeCardRef.current?.querySelector<HTMLElement>("button, a");
    if (activeTarget && document.body.contains(activeTarget)) {
      activeTarget.focus();
      return;
    }
    const firstRowTarget = document.querySelector<HTMLElement>(
      '[data-testid="tracker-job-list"] button, [data-testid="tracker-job-list"] a'
    );
    if (firstRowTarget && document.body.contains(firstRowTarget)) {
      firstRowTarget.focus();
      return;
    }
    document.getElementById("tracker-job-search")?.focus();
  };

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

  const fetchJobsAbortRef = useRef<AbortController | null>(null);
  const noticeTimerRef = useRef<number | null>(null);

  const scheduleNoticeClear = useCallback(() => {
    if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = window.setTimeout(() => setImportNotice(null), 6000);
  }, []);

  const fetchJobs = useCallback(async () => {
    fetchJobsAbortRef.current?.abort();
    const controller = new AbortController();
    fetchJobsAbortRef.current = controller;

    try {
      setIsLoading(true);
      const demoConfig = await fetchDemoConfig();
      if (controller.signal.aborted) return;
      setIsDemoMode(demoConfig?.demoMode === true);
      if (demoConfig?.demoMode) {
        let localJobs: JobItem[] = [];
        try {
          const raw = localStorage.getItem("resumeforge_guest_jobs");
          const parsed = raw ? JSON.parse(raw) : [];
          if (Array.isArray(parsed)) {
            localJobs = parsed.map((job) => {
              const isPlaceholder = isPlaceholderDescription(job.rawDescription);
              const existingReqs = job.extractedRequirements || {
                requiredSkills: [],
                preferredSkills: [],
                domainTerms: [],
              };
              const hasAnyReq =
                (existingReqs.requiredSkills?.length ?? 0) +
                  (existingReqs.preferredSkills?.length ?? 0) +
                  (existingReqs.domainTerms?.length ?? 0) >
                0;
              const shouldParse =
                !isPlaceholder &&
                !hasAnyReq &&
                job.requirementsSource !== "manual" &&
                (!job.requirementsStatus || job.requirementsStatus === "unparsed");
              const extractedRequirements = shouldParse
                ? parseJobDescription(job.rawDescription || "")
                : existingReqs;
              return {
                ...job,
                source: job.source || "pasted",
                status: ALL_STATUSES.includes(job.status) ? job.status : "SAVED",
                createdAt: job.createdAt || new Date().toISOString(),
                notes: job.notes || "",
                isPlaceholder,
                hasFullDescription: !isPlaceholder,
                extractedRequirements,
                requirementsStatus: job.requirementsStatus
                  ? job.requirementsStatus
                  : !isPlaceholder
                    ? "ready"
                    : job.extractFailure
                      ? "unavailable"
                      : "unparsed",
                variants: Array.isArray(job.variants) ? job.variants : [],
                coverLetters: Array.isArray(job.coverLetters) ? job.coverLetters : [],
              };
            });
          }
        } catch {
          localJobs = [];
        }
        let filtered = localJobs.filter((job) => {
          const statuses = statusFilter !== "ALL" ? [statusFilter] : filterStatuses;
          if (statuses?.length && !statuses.includes(job.status)) return false;
          const search = debouncedSearch.toLowerCase();
          const fullText = `${job.roleTitle || ""} ${job.company || ""} ${job.rawDescription || ""} ${job.notes || ""}`.toLowerCase();
          if (search && !fullText.includes(search)) return false;
          const location = extractLocationFromNotes(job.notes || "").toLowerCase();
          if (debouncedLocation && !location.includes(debouncedLocation.toLowerCase())) return false;
          if (workplace !== "all" && !new RegExp(workplace, "i").test(`${location} ${job.notes || ""}`)) return false;
          if (!matchesPostedWithin(extractPostingDateFromNotes(job.notes || ""), postedWithin, new Date(), job.createdAt)) return false;
          return true;
        });
        if (minSalary !== "0") {
          const minimum = Number(minSalary);
          filtered = filtered.filter((job) => {
            const salary = extractSalaryFromNotes(job.notes || "", job.rawDescription || "");
            const amount = salary?.match(/[\d,]+/)?.[0]?.replace(/,/g, "");
            return amount ? Number(amount) >= minimum : false;
          });
        }
        const dedupedFiltered = collapseDuplicateTrackerJobs(filtered);
        const total = dedupedFiltered.length;
        const totalPageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
        const visible = dedupedFiltered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
        setJobs(visible);
        setTotalJobs(total);
        setTotalPages(totalPageCount);
        setPipelineCounts({
          applied: dedupedFiltered.filter((job) => job.status === "APPLIED").length,
          interviewing: dedupedFiltered.filter((job) => job.status === "INTERVIEWING").length,
        });
        setEditingNotes(Object.fromEntries(visible.map((job) => [job.id, job.notes || ""])));
        setLastSyncAt(null);
        return;
      }
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
      const res = await fetch(`/api/jobs?${params.toString()}`, {
        signal: controller.signal,
      });
      const json = await readJsonSafe<JobItem[]>(res);
      if (!controller.signal.aborted && res.ok && json?.success && Array.isArray(json.data)) {
        setJobs(json.data);
        setTotalJobs(json.meta?.total ?? json.data.length);
        setTotalPages(json.meta?.totalPages ?? 1);
        setPipelineCounts(
          json.meta?.counts ?? { applied: 0, interviewing: 0 }
        );
        const notesMap: { [id: string]: string } = {};
        json.data.forEach((j: JobItem) => {
          notesMap[j.id] = j.notes || "";
        });
        setEditingNotes((prev) => ({ ...prev, ...notesMap }));
      } else if (!controller.signal.aborted && (!res.ok || !json?.success)) {
        setImportNotice(formatApiError(res, json, "Failed to load jobs"));
        scheduleNoticeClear();
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      console.error("Failed to fetch jobs:", err);
      if (!controller.signal.aborted) {
        setImportNotice("Network error loading jobs.");
        scheduleNoticeClear();
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, [page, postedWithin, debouncedSearch, debouncedLocation, workplace, statusFilter, filterStatuses, minSalary, scheduleNoticeClear]);

  useEffect(() => {
    void fetchJobs();
    return () => {
      fetchJobsAbortRef.current?.abort();
    };
  }, [fetchJobs]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current);
    };
  }, []);

  // Desktop: open the first job so the detail pane is never an empty void.
  useEffect(() => {
    if (isLoading || activeJobId || jobs.length === 0) return;
    if (window.matchMedia("(min-width: 1024px)").matches) {
      setActiveJobId(jobs[0].id);
    }
  }, [isLoading, activeJobId, jobs]);

  useEffect(() => {
    if (!isDemoMode || isLoading || !activeJobId || jobs.some((job) => job.id === activeJobId)) return;
    const nextActiveId = jobs[0]?.id ?? null;
    setActiveJobId(nextActiveId);
    if (nextActiveId) sessionStorage.setItem("resumeforge_active_job_id", nextActiveId);
    else sessionStorage.removeItem("resumeforge_active_job_id");
  }, [isDemoMode, isLoading, activeJobId, jobs]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const demoConfig = await fetchDemoConfig();
      if (cancelled) return;
      const demo = demoConfig?.demoMode === true;
      setIsDemoMode(demo);
      if (demo) {
        setAuthStatus("guest");
        return;
      }
      const user = await fetchSessionUser();
      if (cancelled) return;
      setAuthStatus(user ? "authenticated" : "guest");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Automatically hydrate cached descriptions with unparsed requirements and the active placeholder job.
  // Avoid bulk-scraping unselected placeholder URLs on mount so initial page load stays responsive.
  // Gate on resolved authentication so signed-out self-hosted guests and demo guests trigger zero hydrate requests.
  useEffect(() => {
    if (!canAutoHydrateTrackerJobs({ isLoading, isDemoMode, authStatus })) return;
    const attempted = hydrateAttemptedRef.current;
    const pendingIds = selectPendingHydrationJobIds(jobs, activeJobId, attempted);
    if (pendingIds.length === 0) return;
    pendingIds.forEach((id) => attempted.add(id));

    void (async () => {
      const BATCH = 8;
      let done = 0;
      setHydrateProgress({ done: 0, total: pendingIds.length });
      setHydratingIds((prev) => {
        const next = { ...prev };
        pendingIds.forEach((id) => {
          next[id] = true;
        });
        return next;
      });
      try {
        for (let i = 0; i < pendingIds.length; i += BATCH) {
          if (!mountedRef.current) return;
          const ids = pendingIds.slice(i, i + BATCH);
          try {
            const res = await fetch("/api/jobs/hydrate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ids }),
            });
            const json = await readJsonSafe(res);
            if (!mountedRef.current) return;
            if (res.status === 401 || res.status === 429) {
              break;
            }
            if (res.ok && json?.success) {
              const results = (json.results ?? []) as Array<{
                id: string;
                status: string;
                rawDescription?: string;
                job?: unknown;
              }>;
              const hydratedById = new Map<string, HydratedJobDetail>();
              const fallbackDescById = new Map<string, string>();
              const failedIds = new Set<string>();

              for (const r of results) {
                const parsedDetail = r.job ? HydratedJobDetailSchema.safeParse(r.job) : null;
                if (parsedDetail?.success) {
                  hydratedById.set(r.id, parsedDetail.data);
                } else if (r.rawDescription) {
                  fallbackDescById.set(r.id, r.rawDescription);
                }
                if (r.status === "failed") {
                  failedIds.add(r.id);
                }
              }

              if (hydratedById.size > 0 || fallbackDescById.size > 0 || failedIds.size > 0) {
                setJobs((prev) =>
                  prev.map((j) => {
                    const detail = hydratedById.get(j.id);
                    if (detail) {
                      return applyHydratedDetailToJobItem(j, detail);
                    }
                    if (fallbackDescById.has(j.id)) {
                      return {
                        ...j,
                        rawDescription: fallbackDescById.get(j.id),
                        isPlaceholder: false,
                        hasFullDescription: true,
                        extractFailure: null,
                      };
                    }
                    if (failedIds.has(j.id)) {
                      const isPlaceholder = j.isPlaceholder ?? isPlaceholderDescription(j.rawDescription);
                      return {
                        ...j,
                        extractFailure: j.extractFailure ?? "failed",
                        requirementsStatus: isPlaceholder ? "unavailable" : j.requirementsStatus,
                      };
                    }
                    return j;
                  }),
                );
              }
            }
          } catch {
            // Best effort; the manual "Pull Full Description" / Retry button remains in the detail pane.
          }
          if (mountedRef.current) {
            setHydratingIds((prev) => {
              const next = { ...prev };
              ids.forEach((id) => {
                delete next[id];
              });
              return next;
            });
          }
          done += ids.length;
          if (mountedRef.current) setHydrateProgress({ done, total: pendingIds.length });
        }
      } finally {
        if (mountedRef.current) {
          setHydratingIds((prev) => {
            const next = { ...prev };
            pendingIds.forEach((id) => {
              delete next[id];
            });
            return next;
          });
          setHydrateProgress(null);
        }
      }
    })();
  }, [jobs, isLoading, isDemoMode, authStatus, activeJobId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const demoConfig = await fetchDemoConfig();
      if (cancelled) return;
      setIsDemoMode(demoConfig?.demoMode === true);
      if (demoConfig?.demoMode === true) return;
      const statusRes = await fetch("/api/connectors/status");
      if (!statusRes.ok) return;
      const json = await readJsonSafe<{ providers?: Array<{ lastSyncAt?: string | null }> }>(statusRes);
      {
        if (cancelled || !json?.success) return;
        const times = (json.data?.providers ?? [])
          .map((provider: { lastSyncAt?: string | null }) => provider.lastSyncAt)
          .filter((value: string | null | undefined): value is string => Boolean(value))
          .sort();
        setLastSyncAt(times.at(-1) ?? null);
      }
    })().catch(() => {
        // Status is optional chrome.
      });
    return () => {
      cancelled = true;
    };
  }, [isImporting, isDemoMode]);

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
      sheetOpenerRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setMobileSheetOpen(true);
    }
  };

  const handleCloseSheet = () => {
    setMobileSheetOpen(false);
  };

  const handleStatusChange = async (jobId: string, newStatus: JobStatus) => {
    await patchJob(jobId, { status: newStatus });
  };

  const handleVariantChange = async (jobId: string, variantId: string | null) => {
    await patchJob(jobId, { variantId });
  };

  const patchJob = async (jobId: string, body: { status?: JobStatus; variantId?: string | null }) => {
    setIsUpdatingStatus((p) => ({ ...p, [jobId]: true }));
    try {
      if (isDemoMode) {
        const rows = JSON.parse(localStorage.getItem("resumeforge_guest_jobs") || "[]");
        if (!Array.isArray(rows)) throw new Error("Invalid local tracker data");
        const next = rows.map((job) => job.id === jobId ? {
          ...job,
          ...(body.status ? { status: body.status, appliedAt: body.status === "APPLIED" ? new Date().toISOString() : job.appliedAt ?? null } : {}),
          ...(body.variantId !== undefined ? { appliedVariantId: body.variantId } : {}),
        } : job);
        localStorage.setItem("resumeforge_guest_jobs", JSON.stringify(next));
        setJobs((prev) => mergePatchedGuestJobs(prev, next));
        return;
      }
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await readJsonSafe<{
        status: JobStatus;
        appliedAt: string | null;
        appliedVariantId?: string | null;
      }>(res);
      if (res.ok && json?.success && json.data) {
        const updated = json.data;
        setJobs((prev) =>
          prev.map((j) =>
            j.id === jobId
              ? {
                  ...j,
                  status: updated.status,
                  appliedAt: updated.appliedAt,
                  appliedVariantId: updated.appliedVariantId ?? null,
                }
              : j,
          ),
        );
        setTier2Notice((p) => ({ ...p, [jobId]: "" }));
      } else {
        const msg =
          res.status === 404
            ? "Shared catalog postings are read-only and cannot be updated."
            : formatApiError(res, json, "Failed to update application");
        setTier2Notice((p) => ({ ...p, [jobId]: msg }));
        setImportNotice(msg);
        scheduleNoticeClear();
      }
    } catch (err) {
      console.error("Failed to update application", err);
      const msg =
        err instanceof Error && err.message
          ? err.message
          : "Network error updating application.";
      setTier2Notice((p) => ({ ...p, [jobId]: msg }));
      setImportNotice(msg);
      scheduleNoticeClear();
    } finally {
      setIsUpdatingStatus((p) => ({ ...p, [jobId]: false }));
    }
  };

  const handleSaveNotes = async (jobId: string) => {
    setIsSavingNotes((p) => ({ ...p, [jobId]: true }));
    try {
      if (isDemoMode) {
        const rows = JSON.parse(localStorage.getItem("resumeforge_guest_jobs") || "[]");
        if (!Array.isArray(rows)) throw new Error("Invalid local tracker data");
        const notes = editingNotes[jobId] || "";
        localStorage.setItem("resumeforge_guest_jobs", JSON.stringify(rows.map((job) => job.id === jobId ? { ...job, notes } : job)));
        setJobs((prev) => prev.map((job) => job.id === jobId ? { ...job, notes } : job));
        return;
      }
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: editingNotes[jobId] || "" }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success) {
        const nextNotes = json.data?.notes ?? (editingNotes[jobId] || "");
        setJobs((prev) => prev.map((job) => (job.id === jobId ? { ...job, notes: nextNotes } : job)));
        setTier2Notice((p) => ({ ...p, [jobId]: "" }));
      } else {
        const msg =
          res.status === 404
            ? "Shared catalog postings are read-only and cannot have notes edited."
            : json?.error || "Unable to save notes on this job posting.";
        setTier2Notice((p) => ({ ...p, [jobId]: msg }));
        setImportNotice(msg);
      }
    } catch {
      console.error("Failed to save notes");
      setImportNotice("Network error saving notes.");
    } finally {
      setIsSavingNotes((p) => ({ ...p, [jobId]: false }));
    }
  };

  const handleDeleteJob = (jobId: string) => {
    const job = jobs.find((item) => item.id === jobId);
    const label = job
      ? `${job.roleTitle || "Untitled Role"}${job.company ? ` at ${job.company}` : ""}`
      : "this job posting";
    setPendingDeleteJob({ id: jobId, label });
  };

  const performDeleteJob = async (jobId: string): Promise<boolean> => {
    if (!jobs.some((item) => item.id === jobId)) {
      return false;
    }
    try {
      if (isDemoMode) {
        const rows = JSON.parse(localStorage.getItem("resumeforge_guest_jobs") || "[]");
        if (!Array.isArray(rows)) throw new Error("Invalid local tracker data");
        localStorage.setItem("resumeforge_guest_jobs", JSON.stringify(rows.filter((job) => job.id !== jobId)));
        setJobs((prev) => prev.filter((job) => job.id !== jobId));
        if (activeJobId === jobId) {
          setActiveJobId(null);
          sessionStorage.removeItem("resumeforge_active_job_id");
          setMobileSheetOpen(false);
        }
        return true;
      }
      const res = await fetch(`/api/jobs/${jobId}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        const msg =
          res.status === 409
            ? json?.error || "Cannot delete this job posting because it has dependent history."
            : res.status === 404
              ? "Only your personal job postings can be deleted; shared catalog postings cannot be deleted."
              : json?.error || "Failed to delete job posting.";
        setTier2Notice((p) => ({ ...p, [jobId]: msg }));
        setImportNotice(msg);
        return false;
      }
      setJobs((prev) => prev.filter((j) => j.id !== jobId));
      if (activeJobId === jobId) {
        setActiveJobId(null);
        sessionStorage.removeItem("resumeforge_active_job_id");
        setMobileSheetOpen(false);
      }
      return true;
    } catch {
      console.error("Failed to delete job");
      setImportNotice("Network error deleting job posting.");
      return false;
    }
  };

  const handleFetchFullText = async (jobId: string) => {
    setIsFetchingTier2((p) => ({ ...p, [jobId]: true }));
    setTier2Notice((p) => ({ ...p, [jobId]: "" }));

    if (isDemoMode) {
      setTier2Notice((p) => ({ ...p, [jobId]: "Paste the job description in Tailor to use it in this local demo." }));
      setIsFetchingTier2((p) => ({ ...p, [jobId]: false }));
      return;
    }

    try {
      const res = await fetch(`/api/jobs/${jobId}/fetch-fulltext`, { method: "POST" });
      const json = await readJsonSafe<HydratedJobDetail | { rawDescription: string }>(res);
      const parsedDetail = json?.data ? HydratedJobDetailSchema.safeParse(json.data) : null;
      if (res.ok && json?.success && json.data) {
        if (parsedDetail?.success) {
          const detail = parsedDetail.data;
          setJobs((prev) =>
            prev.map((j) => (j.id === jobId ? applyHydratedDetailToJobItem(j, detail) : j)),
          );
        } else {
          const rawDescription = json.data.rawDescription;
          setJobs((prev) =>
            prev.map((j) =>
              j.id === jobId
                ? { ...j, rawDescription, isPlaceholder: false, hasFullDescription: true, extractFailure: null }
                : j,
            ),
          );
        }
        setTier2Notice((p) => ({
          ...p,
          [jobId]: json.cached
            ? "Loaded full description from cache."
            : "Successfully extracted full job description!",
        }));
      } else {
        if (parsedDetail?.success) {
          const detail = parsedDetail.data;
          setJobs((prev) =>
            prev.map((j) => (j.id === jobId ? applyHydratedDetailToJobItem(j, detail) : j)),
          );
        } else {
          setJobs((prev) =>
            prev.map((j) =>
              j.id === jobId
                ? {
                    ...j,
                    extractFailure: j.extractFailure ?? "failed",
                    requirementsStatus:
                      (j.isPlaceholder ?? isPlaceholderDescription(j.rawDescription))
                        ? "unavailable"
                        : j.requirementsStatus,
                  }
                : j,
            ),
          );
        }
        setTier2Notice((p) => ({
          ...p,
          [jobId]:
            json?.message ||
            json?.error ||
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
    if (isDemoMode) {
      setImportNotice("Demo tracker uses browser-local jobs. Add or edit jobs here; live import and connector sync require self-hosting.");
      scheduleNoticeClear();
      return;
    }
    const sessionUser = await fetchSessionUser();
    if (!sessionUser) {
      setImportNotice("Live import needs sign-in.");
      scheduleNoticeClear();
      return;
    }
    try {
      setIsImporting(true);
      setImportNotice("Syncing live feeds from public connectors & source listings…");

      const [bulkRes, syncRes] = await Promise.allSettled([
        fetch("/api/jobs/bulk-import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }),
        fetch("/api/connectors/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }),
      ]);

      let trackerPart = "Tracker: import failed.";
      if (bulkRes.status === "fulfilled") {
        const bulkJson = await readJsonSafe(bulkRes.value);
        if (bulkRes.value.ok && bulkJson?.success) {
          trackerPart = `Tracker: ${bulkJson.createdCount} new (${bulkJson.skippedCount} already saved).`;
        } else {
          trackerPart = `Tracker: ${formatApiError(bulkRes.value, bulkJson, "import failed")}`;
        }
      }

      let feedPart = "Discover feed: sync failed.";
      if (syncRes.status === "fulfilled") {
        const syncJson = await readJsonSafe<{
          summary?: { totalInserted: number; totalFound: number; providerCount: number };
          results?: Array<{ source: string; skipped?: boolean; success?: boolean }>;
        }>(syncRes.value);
        const summary = syncJson?.data?.summary;
        const results = syncJson?.data?.results ?? [];
        const skipped = results.filter((result) => result.skipped);
        if (syncRes.value.ok && syncJson?.success && summary) {
          const ran = Math.max(0, summary.providerCount - skipped.length);
          feedPart = `Discover feed: ${summary.totalInserted} new of ${summary.totalFound} from ${ran} sources.`;
          if (skipped.length > 0) {
            feedPart += ` Skipped: ${skipped.map((result) => result.source).join(", ")}.`;
          }
        } else {
          feedPart = `Discover feed: ${formatApiError(syncRes.value, syncJson, "sync failed")}`;
        }
      }

      setImportNotice(`${trackerPart} ${feedPart}`);
      fetchJobs();
      scheduleNoticeClear();
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

  const handleJobLoaded = useCallback((loaded: JobItem) => {
    setJobs((prev) => prev.map((j) => (j.id === loaded.id ? { ...j, ...loaded } : j)));
  }, []);

  const effectiveStatuses = filterStatuses ?? ALL_STATUSES;
  const pageJobs = jobs;
  const disambiguatorById = useMemo(() => buildTrackerDisambiguators(pageJobs), [pageJobs]);
  const selectedJob = activeJobId ? jobs.find((j) => j.id === activeJobId) ?? null : null;

  const pipelineApplied = pipelineCounts.applied;
  const pipelineInterviewing = pipelineCounts.interviewing;

  const filteredLocationCities = useMemo(
    () =>
      CANADIAN_CITIES.filter(
        (c) =>
          c.label.toLowerCase().includes(locationQuery.toLowerCase()) ||
          c.value.toLowerCase().includes(locationQuery.toLowerCase())
      ),
    [locationQuery]
  );

  const selectLocationOption = (option: (typeof CANADIAN_CITIES)[number]) => {
    setLocationQuery(option.value === "ALL" ? "" : option.label);
    setIsLocationDropdownOpen(false);
    setActiveLocationIndex(-1);
  };

  useEffect(() => {
    if (!isLocationDropdownOpen) return;
    const onPointerDownOutside = (event: PointerEvent) => {
      if (
        locationComboboxRef.current &&
        !locationComboboxRef.current.contains(event.target as Node)
      ) {
        setIsLocationDropdownOpen(false);
        setActiveLocationIndex(-1);
      }
    };
    document.addEventListener("pointerdown", onPointerDownOutside);
    return () => document.removeEventListener("pointerdown", onPointerDownOutside);
  }, [isLocationDropdownOpen]);

  return (
    <AppShell variant="tracker">
      <TrackerSubNav
        actions={
          <div className="flex items-center gap-2">
            {hydrateProgress ? (
              <span
                role="status"
                aria-live="polite"
                data-testid="hydrate-status"
                className="hidden items-center gap-1.5 text-xs tabular-nums text-text-secondary sm:inline-flex"
                title="Descriptions are fetched automatically and saved, so each posting is only fetched once."
              >
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                Saving descriptions {hydrateProgress.done}/{hydrateProgress.total}
              </span>
            ) : null}
            <TrackerRefreshButton
              onClick={handleRefreshFromSource}
              isImporting={isImporting}
              lastSyncAt={lastSyncAt}
            />
          </div>
        }
      />

      {importNotice && (
        <div
          data-testid="import-status-notice"
          role="status"
          aria-live="polite"
          className="border-b border-status-warning/40 bg-status-warning/15 px-4 py-2 text-center text-xs font-medium text-status-warning"
        >
          {importNotice}
        </div>
      )}

      {/* Filter subheader — sticky glass bar under TrackerSubNav */}
      <div className="sticky top-11 z-10 flex shrink-0 flex-wrap items-center gap-2 border-b glass-bar px-3 py-2 sm:px-4 sm:py-2.5">
        <div className="relative w-full sm:w-auto sm:min-w-[180px] sm:flex-1 sm:max-w-xs">
          <label htmlFor="tracker-job-search" className="sr-only">
            Search jobs, companies, or keywords
          </label>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
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

        <div ref={locationComboboxRef} className="relative min-w-0 flex-1 basis-[calc(50%-0.25rem)] sm:basis-auto sm:min-w-[140px] sm:max-w-[180px]">
          <label htmlFor="tracker-location-filter" className="sr-only">
            Filter by location
          </label>
          <MapPin className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            id="tracker-location-filter"
            data-testid="tracker-location-filter"
            type="search"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={isLocationDropdownOpen && filteredLocationCities.length > 0}
            aria-controls={locationListboxId}
            aria-activedescendant={
              isLocationDropdownOpen &&
              activeLocationIndex >= 0 &&
              filteredLocationCities[activeLocationIndex]
                ? `${locationListboxId}-option-${activeLocationIndex}`
                : undefined
            }
            placeholder="City (Toronto)"
            value={locationQuery}
            onChange={(e) => {
              setLocationQuery(e.target.value);
              setIsLocationDropdownOpen(true);
              setActiveLocationIndex(-1);
            }}
            onFocus={() => {
              setIsLocationDropdownOpen(true);
              setActiveLocationIndex(-1);
            }}
            onBlur={(e) => {
              if (!locationComboboxRef.current?.contains(e.relatedTarget as Node | null)) {
                setIsLocationDropdownOpen(false);
                setActiveLocationIndex(-1);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                if (!isLocationDropdownOpen) {
                  setIsLocationDropdownOpen(true);
                  setActiveLocationIndex(filteredLocationCities.length > 0 ? 0 : -1);
                } else if (filteredLocationCities.length > 0) {
                  setActiveLocationIndex((prev) =>
                    prev < filteredLocationCities.length - 1 ? prev + 1 : 0
                  );
                }
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                if (!isLocationDropdownOpen) {
                  setIsLocationDropdownOpen(true);
                  setActiveLocationIndex(filteredLocationCities.length - 1);
                } else if (filteredLocationCities.length > 0) {
                  setActiveLocationIndex((prev) =>
                    prev > 0 ? prev - 1 : filteredLocationCities.length - 1
                  );
                }
              } else if (e.key === "Home" && isLocationDropdownOpen && filteredLocationCities.length > 0) {
                e.preventDefault();
                setActiveLocationIndex(0);
              } else if (e.key === "End" && isLocationDropdownOpen && filteredLocationCities.length > 0) {
                e.preventDefault();
                setActiveLocationIndex(filteredLocationCities.length - 1);
              } else if (
                e.key === "Enter" &&
                isLocationDropdownOpen &&
                activeLocationIndex >= 0 &&
                filteredLocationCities[activeLocationIndex]
              ) {
                e.preventDefault();
                selectLocationOption(filteredLocationCities[activeLocationIndex]);
              } else if (e.key === "Escape" && isLocationDropdownOpen) {
                e.preventDefault();
                e.stopPropagation();
                setIsLocationDropdownOpen(false);
                setActiveLocationIndex(-1);
              }
            }}
            className={`${FILTER_CONTROL} w-full py-0 pl-8 pr-3`}
          />
          {isLocationDropdownOpen && filteredLocationCities.length > 0 && (
            <div
              id={locationListboxId}
              role="listbox"
              aria-label="Location suggestions"
              className="absolute left-0 top-full z-50 mt-1 max-h-56 w-full min-w-[200px] max-w-[calc(100vw-1.5rem)] sm:w-56 overflow-auto rounded-[10px] border border-hairline bg-elevated p-1 shadow-2xl"
            >
              {filteredLocationCities.map((c, index) => {
                const isActive = index === activeLocationIndex;
                return (
                  <button
                    key={c.value}
                    id={`${locationListboxId}-option-${index}`}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    tabIndex={-1}
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={() => selectLocationOption(c)}
                    className={`flex w-full items-center gap-2 rounded-[6px] px-3 py-1.5 text-left text-xs transition ${
                      isActive
                        ? "bg-primary/20 text-primary"
                        : "text-on-surface-variant hover:bg-primary/15 hover:text-primary"
                    }`}
                  >
                    <MapPin className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
                    <span>{c.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <label htmlFor="tracker-posted-select" className="sr-only">
          How recently posted
        </label>
        <select
          id="tracker-posted-select"
          data-testid="tracker-posted-select"
          value={postedWithin}
          onChange={(e) => setPostedWithin(e.target.value as PostedWithin)}
          className={`${FILTER_CONTROL} min-w-0 flex-1 basis-[calc(50%-0.25rem)] sm:basis-auto sm:flex-none cursor-pointer text-rf-meta`}
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
          className={`${FILTER_CONTROL} min-w-0 flex-1 basis-[calc(50%-0.25rem)] sm:basis-auto sm:flex-none cursor-pointer text-rf-meta`}
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
          className={`${FILTER_CONTROL} min-w-0 flex-1 basis-[calc(50%-0.25rem)] sm:basis-auto sm:flex-none cursor-pointer text-rf-meta`}
          aria-label="Filter by status"
        >
          <option value="ALL">All Statuses</option>
          {effectiveStatuses.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>

        <div className="flex w-full flex-wrap items-center justify-between gap-2 sm:ml-auto sm:w-auto sm:justify-end sm:gap-3 text-xs text-muted-foreground">
          <div
            className="flex items-center rounded-md border border-hairline bg-inset p-0.5"
            role="tablist"
            aria-label="Tracker display mode"
          >
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === "split"}
              onClick={() => setViewMode("split")}
              data-testid="tracker-view-split"
              className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-mono font-semibold transition ${
                viewMode === "split"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutList className="h-3.5 w-3.5" />
              <span>Split View</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === "kanban"}
              onClick={() => setViewMode("kanban")}
              data-testid="tracker-view-kanban"
              className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-mono font-semibold transition ${
                viewMode === "kanban"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Columns3 className="h-3.5 w-3.5" />
              <span>Kanban Board</span>
            </button>
          </div>

          <span className="tabular-nums">
            {isLoading ? (
              "Loading…"
            ) : (
              <>
                <span className="text-rf-cloud">{totalJobs}</span> job{totalJobs !== 1 ? "s" : ""}
              </>
            )}
          </span>
          <span className="hidden tabular-nums md:inline">
            Applied <span className="text-primary">{pipelineApplied}</span>
            {" · "}
            Interviewing <span className="text-status-success">{pipelineInterviewing}</span>
          </span>
          <Link
            href="/tailor"
            className="inline-flex min-h-11 items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground transition-colors duration-150 hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Job
          </Link>
        </div>
      </div>

      {viewMode === "kanban" ? (
        <div
          data-testid="tracker-kanban-board"
          tabIndex={0}
          role="region"
          aria-label="Kanban pipeline stages"
          onKeyDown={(e) => {
            if (e.target !== e.currentTarget) return;
            if (e.key === "ArrowRight") {
              e.preventDefault();
              e.currentTarget.scrollBy({ left: 260, behavior: "smooth" });
            } else if (e.key === "ArrowLeft") {
              e.preventDefault();
              e.currentTarget.scrollBy({ left: -260, behavior: "smooth" });
            }
          }}
          className="flex min-h-0 flex-1 gap-4 overflow-x-auto snap-x snap-mandatory md:snap-none bg-transparent p-4 xl:grid xl:grid-cols-5 xl:overflow-x-visible xl:snap-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        >
          {(["SAVED", "APPLIED", "INTERVIEWING", "OFFER", "REJECTED"] as JobStatus[]).map(
            (stage) => {
              const stageJobs = pageJobs.filter((j) => j.status === stage);
              return (
                <div
                  key={stage}
                  data-testid={`kanban-col-${stage}`}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (draggedJobId) {
                      void handleStatusChange(draggedJobId, stage);
                      setDraggedJobId(null);
                    }
                  }}
                  className="flex h-full w-[82vw] max-w-72 sm:w-72 shrink-0 snap-start flex-col rounded-xl surface-raised overflow-hidden xl:w-full xl:max-w-none xl:min-w-0 xl:shrink xl:snap-align-none"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-hairline bg-inset/90 px-3.5 py-2.5">
                    <span className="min-w-0 truncate font-mono text-xs font-bold uppercase tracking-wider text-foreground">
                      {STATUS_LABELS[stage]}
                    </span>
                    <span className="shrink-0 rounded-full bg-elevated border border-hairline px-2 py-0.5 font-mono text-xs font-semibold text-primary">
                      {stageJobs.length}
                    </span>
                  </div>

                  <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                    {stageJobs.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-hairline p-6 text-center text-xs font-mono text-muted-foreground">
                        Drop job card here
                      </div>
                    ) : (
                      stageJobs.map((job) => {
                        const disambiguator = disambiguatorById.get(job.id);
                        const cardLocation = extractLocationFromNotes(job.notes);
                        return (
                          <div
                            key={job.id}
                            draggable
                            onDragStart={() => setDraggedJobId(job.id)}
                            data-testid={`kanban-card-${job.id}`}
                            className="min-w-0 rounded-lg surface-raised card-lift p-3 cursor-grab active:cursor-grabbing space-y-2"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveJobId(job.id);
                                  setViewMode("split");
                                }}
                                className="min-w-0 text-left group"
                              >
                                <h3 className="text-xs font-bold text-foreground group-hover:text-primary transition line-clamp-2 break-words">
                                  {job.roleTitle}
                                </h3>
                                <p className="text-xs font-mono text-muted-foreground mt-0.5 truncate">
                                  {job.company}
                                  {cardLocation ? ` · ${cardLocation}` : ""}
                                </p>
                                {disambiguator ? (
                                  <span className="mt-1 inline-block rounded border border-hairline bg-inset px-1.5 py-0.5 font-mono text-xs text-text-secondary">
                                    {disambiguator}
                                  </span>
                                ) : null}
                              </button>
                            </div>

                            <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-hairline">
                              <select
                                value={job.status}
                                onChange={(e) =>
                                  void handleStatusChange(job.id, e.target.value as JobStatus)
                                }
                                aria-label={`Change status for ${job.roleTitle}`}
                                className="min-w-0 max-w-full rounded-[6px] border border-control/70 bg-inset px-2 py-0.5 text-xs font-mono text-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                              >
                                {(["SAVED", "APPLIED", "INTERVIEWING", "OFFER", "REJECTED"] as JobStatus[]).map(
                                  (st) => (
                                    <option key={st} value={st}>
                                      {STATUS_LABELS[st]}
                                    </option>
                                  )
                                )}
                              </select>

                              <Link
                                href={`/tailor?jobId=${job.id}&tab=overview`}
                                className="shrink-0 text-xs font-mono font-semibold text-primary hover:underline"
                              >
                                Tailor →
                              </Link>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            }
          )}
        </div>
      ) : (
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* List pane — independent scroll */}
        <div className="flex min-h-0 w-full flex-col border-r border-hairline lg:w-[400px] lg:shrink-0">
          <div className="min-h-0 flex-1 overflow-y-auto" data-testid="tracker-job-list">
            {isLoading && (
              <div className="space-y-0 p-0">
                {[...Array(6)].map((_, i) => (
                  <div
                    key={i}
                    className="flex gap-3 surface-raised border-x-0 border-t-0 border-b border-hairline px-4 py-3.5"
                  >
                    <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                    <div className="min-w-0 flex-1 space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <Skeleton className="h-3.5 w-44 max-w-full" />
                          <Skeleton className="h-3 w-32" />
                        </div>
                        <Skeleton className="h-5 w-20 rounded-full shrink-0" />
                      </div>
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Skeleton className="h-7 w-24 rounded-[6px]" />
                        <Skeleton className="h-7 w-7 rounded-[6px]" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!isLoading && pageJobs.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-4 px-4 py-20 text-center">
                <Briefcase className="h-12 w-12 text-muted-foreground/50" />
                <div>
                  <p className="font-medium text-rf-meta">No jobs found</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {searchQuery || locationQuery
                      ? "Try adjusting search or location filters."
                      : "Go to the Tailor workspace to paste a job posting."}
                  </p>
                </div>
                <Link
                  href="/tailor"
                  className="mt-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-colors duration-150 hover:bg-primary/90"
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
                  disambiguator={disambiguatorById.get(job.id)}
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
            <div className="flex shrink-0 items-center justify-between gap-2 border-t glass-bar px-3 py-2">
              <button
                type="button"
                data-testid="jobs-page-prev"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex min-h-11 sm:min-h-0 items-center gap-1 rounded-md border border-hairline bg-inset px-3 py-2 sm:px-2.5 sm:py-1.5 text-xs text-rf-meta transition-colors duration-150 hover:text-rf-cloud disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Prev
              </button>
              <span className="text-xs tabular-nums text-muted-foreground" data-testid="jobs-page-indicator">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                data-testid="jobs-page-next"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="inline-flex min-h-11 sm:min-h-0 items-center gap-1 rounded-md border border-hairline bg-inset px-3 py-2 sm:px-2.5 sm:py-1.5 text-xs text-rf-meta transition-colors duration-150 hover:text-rf-cloud disabled:opacity-40"
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
              isHydrating={Boolean(hydratingIds[selectedJob.id])}
              tier2Notice={tier2Notice[selectedJob.id]}
              showNotes
              onStatusChange={handleStatusChange}
              onVariantChange={handleVariantChange}
              onNotesChange={(id, value) =>
                setEditingNotes((prev) => ({ ...prev, [id]: value }))
              }
              onSaveNotes={handleSaveNotes}
              onFetchFullText={handleFetchFullText}
              onJobLoaded={handleJobLoaded}
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-rf-surface px-6 text-center">
              <p className="text-sm text-rf-meta">Select a job to view details and evidence match.</p>
            </div>
          )}
        </div>
      </div>
      )}

      {/* Mobile full-screen detail sheet */}
      {mobileSheetOpen && selectedJob && (
        <div className="lg:hidden">
          <JobDetailPane
            job={selectedJob}
            notesValue={editingNotes[selectedJob.id] ?? ""}
            isSavingNotes={Boolean(isSavingNotes[selectedJob.id])}
            isUpdatingStatus={Boolean(isUpdatingStatus[selectedJob.id])}
            isFetchingFullText={Boolean(isFetchingTier2[selectedJob.id])}
            isHydrating={Boolean(hydratingIds[selectedJob.id])}
            tier2Notice={tier2Notice[selectedJob.id]}
            showNotes
            isSheet
            onClose={handleCloseSheet}
            onSheetCloseAutoFocus={(event) => {
              event.preventDefault();
              restoreTrackerListFocus();
            }}
            onStatusChange={handleStatusChange}
            onVariantChange={handleVariantChange}
            onNotesChange={(id, value) =>
              setEditingNotes((prev) => ({ ...prev, [id]: value }))
            }
            onSaveNotes={handleSaveNotes}
            onFetchFullText={handleFetchFullText}
            onJobLoaded={handleJobLoaded}
          />
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pendingDeleteJob)}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteJob(null);
        }}
        title="Delete Job Posting"
        description={
          pendingDeleteJob
            ? `Delete "${pendingDeleteJob.label}" from your job tracker? This action cannot be undone.`
            : ""
        }
        confirmLabel="Delete Posting"
        tone="destructive"
        dialogTestId="delete-job-confirm-modal"
        confirmTestId="confirm-delete-job-btn"
        cancelTestId="cancel-delete-job-btn"
        onConfirm={async () => {
          if (!pendingDeleteJob) return;
          const targetId = pendingDeleteJob.id;
          const deleted = await performDeleteJob(targetId);
          setPendingDeleteJob(null);
          if (deleted) {
            requestAnimationFrame(() => restoreTrackerListFocus());
          }
        }}
      />
    </AppShell>
  );
}
