"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import {
  Search,
  ExternalLink,
  Sparkles,
  Building2,
  MapPin,
  Calendar,
  CheckCircle2,
  Loader2,
  RefreshCw,
  X,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Globe2,
  Compass,
  SlidersHorizontal,
  AlertTriangle,
} from "lucide-react";
import { AppShell } from "@/components/design-system/app-shell";
import { CommandButton } from "@/components/design-system/command-button";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TrackerSubNav } from "@/components/tracker/tracker-sub-nav";
import { fetchDemoConfig, fetchSessionUser } from "@/components/auth/session-user";
import { isSafeHref } from "@/lib/security/safe-url";
import { type PostedWithin } from "@/lib/jobs/posted-within";
import { parseJobDescription } from "@/lib/jd-parser/parser";
import { isPlaceholderDescription } from "@/lib/ingestion/helpers";
import type { ScoreBreakdown } from "@/lib/scoring/blended-sort";
import { displayScore } from "@/lib/scoring/blended-display";
import type { CompatibilityResult } from "@/lib/scoring/compatibility-engine";
import { JobCardSignalBadge } from "@/components/tracker/job-card-signal-badge";
import { CompanyAvatar } from "@/components/tracker/company-avatar";
import { FitPercentageDial } from "@/components/tracker/fit-percentage-dial";
import { TechDiffPillList } from "@/components/tracker/tech-diff-pill-list";
import { normalizeCompanyIntel, formatFundingBadge, formatH1BBadge } from "@/lib/companyIntel";

export interface IngestedJobItem {
  id: string;
  externalId: string;
  source: string;
  companyName: string;
  title: string;
  location: string;
  workplaceType: string;
  isCanadianEligible: boolean;
  description: string;
  descriptionHtml: string;
  applyUrl: string;
  postedAt: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  createdAt: string;
  blendedScore?: number;
  scoreBreakdown?: ScoreBreakdown;
  compatibility?: CompatibilityResult;
  trackedJob?: {
    id: string;
    status: string;
  } | null;
}

const SOURCES: { value: string; label: string }[] = [
  { value: "ALL", label: "All Sources" },
  { value: "GREENHOUSE", label: "Greenhouse" },
  { value: "LEVER", label: "Lever" },
  { value: "ASHBY", label: "Ashby" },
  { value: "ADZUNA_CA", label: "Adzuna CA" },
  { value: "JOBICY", label: "Jobicy" },
  { value: "REMOTIVE", label: "Remotive" },
  { value: "REMOTEOK", label: "RemoteOK" },
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

const RADIUS_OPTIONS: { value: string; label: string }[] = [
  { value: "10", label: "Within 10 km" },
  { value: "25", label: "Within 25 km" },
  { value: "50", label: "Within 50 km" },
  { value: "100", label: "Within 100 km" },
  { value: "250", label: "Within 250 km" },
  { value: "9999", label: "Any distance" },
];

const MIN_SALARY_OPTIONS: { value: string; label: string }[] = [
  { value: "0", label: "Any Salary" },
  { value: "60000", label: "$60k+" },
  { value: "80000", label: "$80k+" },
  { value: "100000", label: "$100k+" },
  { value: "120000", label: "$120k+" },
  { value: "150000", label: "$150k+" },
];

const MIN_SCORE_OPTIONS: { value: string; label: string }[] = [
  { value: "0", label: "All Match Tiers" },
  { value: "50", label: "50%+ Match" },
  { value: "70", label: "70%+ Match" },
  { value: "80", label: "80%+ High Match" },
];

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "blended", label: "Blended Match" },
  { value: "newest", label: "Newest First" },
  { value: "ats", label: "Highest ATS Match" },
  { value: "salary", label: "Salary: High to Low" },
];

const WORKPLACE_OPTIONS: { value: string; label: string }[] = [
  { value: "ALL", label: "Any workplace" },
  { value: "REMOTE", label: "Remote" },
  { value: "HYBRID", label: "Hybrid" },
  { value: "ON_SITE", label: "On-site" },
];

const POSTED_OPTIONS: { value: PostedWithin; label: string }[] = [
  { value: "all", label: "Any time" },
  { value: "1d", label: "Last 24h" },
  { value: "3d", label: "Last 3 days" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
];

const CURATED_COMPANIES: { label: string; query: string }[] = [
  { label: "All Companies", query: "" },
  { label: "Stripe", query: "Stripe" },
  { label: "Shopify", query: "Shopify" },
  { label: "Linear", query: "Linear" },
  { label: "Vercel", query: "Vercel" },
  { label: "Anthropic", query: "Anthropic" },
  { label: "OpenAI", query: "OpenAI" },
  { label: "Cloudflare", query: "Cloudflare" },
  { label: "Datadog", query: "Datadog" },
  { label: "Wealthsimple", query: "Wealthsimple" },
  { label: "Cohere", query: "Cohere" },
  { label: "Tailscale", query: "Tailscale" },
];

const FILTER_CONTROL =
  "min-h-11 rounded-md border border-hairline bg-rf-elevated px-2.5 text-sm text-rf-cloud placeholder:text-muted-foreground transition-colors duration-150 focus:border-primary/60";

type FeedNotification = {
  message: string;
  tone: "success" | "error" | "info";
};

export function extractPromotedJobId(data: unknown): { id: string | null; status: string } {
  if (!data || typeof data !== "object") return { id: null, status: "SAVED" };
  const record = data as {
    id?: unknown;
    status?: unknown;
    job?: { id?: unknown; status?: unknown };
  };
  const rawId = record.id ?? record.job?.id;
  const rawStatus = record.status ?? record.job?.status;
  return {
    id: typeof rawId === "string" && rawId.length > 0 ? rawId : null,
    status: typeof rawStatus === "string" && rawStatus.length > 0 ? rawStatus : "SAVED",
  };
}

async function readJsonSafe(res: Response): Promise<Record<string, unknown> | null> {
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function DiscoverFeed() {
  const [jobs, setJobs] = useState<IngestedJobItem[]>([]);
  const [totalJobs, setTotalJobs] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("ALL");
  const [workplaceFilter, setWorkplaceFilter] = useState("ALL");
  const [cityFilter, setCityFilter] = useState("ALL");
  const [hasEvidence, setHasEvidence] = useState(false);
  const [clientSkills, setClientSkills] = useState<string[]>([]);
  const [radiusFilter, setRadiusFilter] = useState("100");
  const [minSalaryFilter, setMinSalaryFilter] = useState("0");
  const [minScoreFilter, setMinScoreFilter] = useState("0");
  const [sortOrder, setSortOrder] = useState("blended");
  const [canadianOnly, setCanadianOnly] = useState(false);
  const [postedWithin, setPostedWithin] = useState<PostedWithin>("all");

  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [notification, setNotification] = useState<FeedNotification | null>(null);

  const activeSecondaryFilterCount =
    (minSalaryFilter !== "0" ? 1 : 0) +
    (sourceFilter !== "ALL" ? 1 : 0) +
    (workplaceFilter !== "ALL" ? 1 : 0) +
    (canadianOnly ? 1 : 0) +
    (postedWithin !== "all" ? 1 : 0);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchQuery.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    let cancelled = false;
    async function loadSkills() {
      const skillSet = new Set<string>();
      try {
        const demoConfig = await fetchDemoConfig();
        if (!demoConfig?.demoMode) {
          const res = await fetch("/api/evidence");
          const json = await readJsonSafe(res);
          if (res.ok && json?.success && Array.isArray(json.data)) {
            for (const item of json.data as Array<{ tags?: string[] }>) {
              if (Array.isArray(item.tags)) {
                item.tags.forEach((t: string) => skillSet.add(t.toLowerCase()));
              }
            }
          }
        }
      } catch {}
      if (typeof window !== "undefined") {
        try {
          const guestRaw = localStorage.getItem("resumeforge_guest_evidence");
          const guestList = guestRaw ? JSON.parse(guestRaw) : [];
          if (Array.isArray(guestList)) {
            for (const item of guestList) {
              if (Array.isArray(item.tags)) {
                item.tags.forEach((t: string) => skillSet.add(t.toLowerCase()));
              }
            }
          }
        } catch {}
      }
      if (!cancelled && skillSet.size > 0) {
        setClientSkills(Array.from(skillSet));
      }
    }
    void loadSkills();
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchAbortRef = useRef<AbortController | null>(null);

  const fetchIngestedJobs = useCallback(async () => {
    fetchAbortRef.current?.abort();
    const controller = new AbortController();
    fetchAbortRef.current = controller;

    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: "30",
        postedWithin,
        sort: sortOrder,
      });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (sourceFilter !== "ALL") params.set("source", sourceFilter);
      if (workplaceFilter !== "ALL") params.set("workplace", workplaceFilter);
      if (cityFilter !== "ALL") {
        params.set("city", cityFilter);
        params.set("radiusKm", radiusFilter);
      }
      if (minSalaryFilter !== "0") params.set("minSalary", minSalaryFilter);
      if (minScoreFilter !== "0") params.set("minScore", minScoreFilter);
      if (canadianOnly) params.set("canadianOnly", "true");

      const res = await fetch(`/api/connectors/jobs?${params.toString()}`, {
        signal: controller.signal,
      });
      const json = await readJsonSafe(res);
      if (!controller.signal.aborted && res.ok && json?.success) {
        const meta = json.meta as { total?: number; totalPages?: number } | undefined;
        setJobs((json.data as IngestedJobItem[]) || []);
        setTotalJobs(meta?.total ?? 0);
        setTotalPages(meta?.totalPages ?? 1);
        setHasEvidence(Boolean(json.hasEvidence));
      } else if (!controller.signal.aborted && (!res.ok || !json?.success)) {
        const errMsg =
          (typeof json?.message === "string" && json.message) ||
          (typeof json?.error === "string" && json.error) ||
          `Failed to load discovered jobs (HTTP ${res.status}).`;
        setNotification({ message: errMsg, tone: "error" });
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      console.error("Failed to fetch connector jobs:", err);
      if (!controller.signal.aborted) {
        setNotification({ message: "Network error loading discovered jobs.", tone: "error" });
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, [
    page,
    debouncedSearch,
    sourceFilter,
    workplaceFilter,
    cityFilter,
    radiusFilter,
    minSalaryFilter,
    minScoreFilter,
    sortOrder,
    canadianOnly,
    postedWithin,
  ]);

  useEffect(() => {
    void fetchIngestedJobs();
    return () => {
      fetchAbortRef.current?.abort();
    };
  }, [fetchIngestedJobs]);

  const activeClientSkills = useMemo(
    () => clientSkills.filter((s) => s.length >= 2),
    [clientSkills]
  );

  const jobCardMeta = useMemo(() => {
    const map = new Map<
      string,
      {
        fundingBadge: ReturnType<typeof formatFundingBadge>;
        h1bBadge: ReturnType<typeof formatH1BBadge>;
        matchedClientSkills: string[];
        clientSkillPct: number | null;
      }
    >();
    const denom = Math.min(clientSkills.length, 8);
    for (const j of jobs) {
      const intel = normalizeCompanyIntel(j.companyName);
      const fundingBadge = formatFundingBadge(intel.fundingIntel);
      const h1bBadge = formatH1BBadge(intel.h1bIntel);
      const haystack = `${j.title} ${j.description || ""}`.toLowerCase();
      const matchedClientSkills =
        activeClientSkills.length > 0
          ? activeClientSkills.filter((s) => haystack.includes(s))
          : [];
      const clientSkillPct =
        clientSkills.length > 0
          ? Math.min(98, Math.max(15, Math.round((matchedClientSkills.length / denom) * 100)))
          : null;
      map.set(j.id, { fundingBadge, h1bBadge, matchedClientSkills, clientSkillPct });
    }
    return map;
  }, [jobs, activeClientSkills, clientSkills.length]);

  // Reset to page 1 on filter changes
  useEffect(() => {
    setPage(1);
  }, [
    searchQuery,
    sourceFilter,
    workplaceFilter,
    cityFilter,
    radiusFilter,
    minSalaryFilter,
    minScoreFilter,
    sortOrder,
    canadianOnly,
    postedWithin,
  ]);

  const handleSyncPublicFeeds = async () => {
    try {
      setIsSyncing(true);
      setNotification(null);
      const demoConfig = await fetchDemoConfig();
      if (demoConfig?.demoMode) {
        setNotification({
          message:
            "Demo feed uses preloaded public jobs. Live connector sync requires signing in or self-hosting.",
          tone: "info",
        });
        return;
      }
      const sessionUser = await fetchSessionUser();
      if (!sessionUser) {
        setNotification({
          message: "Live import needs sign-in.",
          tone: "info",
        });
        return;
      }
      const res = await fetch("/api/connectors/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const json = await readJsonSafe(res);
      if (res.ok && json?.success) {
        const data = json.data as { summary?: { totalFound: number; totalInserted: number; providerCount: number } } | undefined;
        const summary = data?.summary;
        const msg = summary
          ? `Synced ${summary.totalFound} jobs (${summary.totalInserted} new) from ${summary.providerCount} public connectors!`
          : "Sync completed successfully!";
        setNotification({ message: msg, tone: "success" });
        fetchIngestedJobs();
      } else {
        const errMsg =
          (typeof json?.message === "string" && json.message) ||
          (typeof json?.error === "string" && json.error) ||
          (res.status === 401
            ? "Sign in to sync public job connectors."
            : `Sync failed (HTTP ${res.status}).`);
        setNotification({ message: errMsg, tone: "error" });
      }
    } catch {
      setNotification({ message: "Failed to connect to ingestion service.", tone: "error" });
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePromoteJob = async (job: IngestedJobItem) => {
    try {
      setPromotingId(job.id);
      const res = await fetch("/api/connectors/promote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ingestedJobId: job.id }),
      });
      const json = await readJsonSafe(res);
      const { id: promotedId, status: promotedStatus } = extractPromotedJobId(json?.data);

      if (res.ok && json?.success && promotedId) {
        setJobs((prev) =>
          prev.map((item) =>
            item.id === job.id
              ? {
                  ...item,
                  trackedJob: {
                    id: promotedId,
                    status: promotedStatus,
                  },
                }
              : item
          )
        );
        setNotification({
          message: `Promoted "${job.title}" at ${job.companyName} to your Job Tracker!`,
          tone: "success",
        });
      } else if (res.ok && json?.success) {
        setNotification({
          message: "Failed to save job to tracker: missing job ID in response.",
          tone: "error",
        });
      } else {
        const demoConfig = await fetchDemoConfig();
        if (demoConfig?.demoMode && res.status === 401 && typeof window !== "undefined") {
          const guestId = `guest-job-${Date.now()}`;
          try {
            const raw = localStorage.getItem("resumeforge_guest_jobs");
            const existing = raw ? JSON.parse(raw) : [];
            const list = Array.isArray(existing) ? existing : [];
            list.unshift({
              id: guestId,
              company: job.companyName,
              roleTitle: job.title,
              rawDescription: job.description || "",
              source: job.source || "connector",
              status: "SAVED",
              createdAt: new Date().toISOString(),
              notes: [job.location ? `Location: ${job.location}` : "", job.applyUrl ? `Apply: ${job.applyUrl}` : ""]
                .filter(Boolean)
                .join("\n"),
              extractedRequirements:
                job.description && !isPlaceholderDescription(job.description)
                  ? parseJobDescription(job.description)
                  : { requiredSkills: [], preferredSkills: [], domainTerms: [] },
              requirementsStatus:
                job.description && !isPlaceholderDescription(job.description) ? "ready" : "unparsed",
              variants: [],
              coverLetters: [],
            });
            localStorage.setItem("resumeforge_guest_jobs", JSON.stringify(list));
            setJobs((prev) =>
              prev.map((item) =>
                item.id === job.id
                  ? {
                      ...item,
                      trackedJob: {
                        id: guestId,
                        status: "SAVED",
                      },
                    }
                  : item
              )
            );
            setNotification({
              message: `Saved "${job.title}" at ${job.companyName} to your local demo tracker!`,
              tone: "success",
            });
            return;
          } catch {
            setNotification({
              message: "Demo mode: unable to save job to local browser storage.",
              tone: "error",
            });
            return;
          }
        }
        const errMsg =
          (typeof json?.message === "string" && json.message) ||
          (typeof json?.error === "string" && json.error) ||
          (res.status === 401
            ? "Sign in to save discovered jobs to your tracker."
            : `Failed to save job to tracker (HTTP ${res.status}).`);
        setNotification({ message: errMsg, tone: "error" });
      }
    } catch {
      setNotification({ message: "Error promoting job to tracker.", tone: "error" });
    } finally {
      setPromotingId(null);
    }
  };

  const formatSalary = (j: IngestedJobItem) => {
    if (!j.salaryMin && !j.salaryMax) return null;
    const currency = j.salaryCurrency?.trim();
    const suffix = currency ? ` ${currency}` : "";
    if (j.salaryMin && j.salaryMax) {
      return `$${j.salaryMin.toLocaleString()} – $${j.salaryMax.toLocaleString()}${suffix}`;
    }
    if (j.salaryMin) {
      return `From $${j.salaryMin.toLocaleString()}${suffix}`;
    }
    return `Up to $${j.salaryMax?.toLocaleString()}${suffix}`;
  };

  return (
    <AppShell variant="tracker" layout="page">
      <TrackerSubNav
        actions={
          <CommandButton
            variant="secondary"
            size="sm"
            disabled={isSyncing}
            onClick={handleSyncPublicFeeds}
            aria-label={isSyncing ? "Syncing public feeds" : "Sync public feeds"}
            data-testid="sync-connectors-btn"
          >
            {isSyncing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            {isSyncing ? "Syncing Feeds…" : "Sync Public Feeds"}
          </CommandButton>
        }
      />

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-xl surface-raised edge-glow p-4 sm:p-6">
          <div className="flex min-w-0 items-start gap-3 border-l-2 border-primary pl-3 sm:gap-4 sm:pl-4">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary sm:h-12 sm:w-12"
              aria-hidden="true"
            >
              <Compass className="h-6 w-6" />
            </div>
            <div className="min-w-0 space-y-1">
              <p className="font-mono text-xs font-semibold uppercase tracking-wider text-primary">
                Find your next role
              </p>
              <h2 className="text-2xl font-bold tracking-tight text-rf-cloud md:text-3xl">
                Discovered Jobs
              </h2>
              <p className="max-w-2xl text-sm text-text-secondary">
                Explore roles from public job boards and save the ones you want to pursue.
              </p>
            </div>
          </div>
          <span className="rounded-full border glass-bar px-3 py-1.5 text-xs font-semibold tabular-nums text-rf-cloud">
            {totalJobs} {totalJobs === 1 ? "role" : "roles"}
          </span>
        </header>

        {notification ? (
          <div
            role={notification.tone === "error" ? "alert" : "status"}
            aria-live={notification.tone === "error" ? "assertive" : "polite"}
            data-testid="discover-notification"
            className={`flex items-center justify-between rounded-lg border p-3 text-xs font-medium ${
              notification.tone === "error"
                ? "border-status-danger/30 bg-status-danger/10 text-status-danger"
                : notification.tone === "info"
                  ? "border-status-warning/40 bg-status-warning/15 text-status-warning"
                  : "border-signal/35 bg-signal/10 text-signal"
            }`}
          >
            <div className="flex items-center gap-2">
              {notification.tone === "error" || notification.tone === "info" ? (
                <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
              ) : (
                <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
              )}
              <span>{notification.message}</span>
            </div>
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => setNotification(null)}
              className="inline-flex min-h-11 min-w-11 items-center justify-center text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        ) : null}

        {/* Curated Company Quick-Filter Chips */}
        <div
          className="flex flex-wrap items-center gap-2 rounded-xl border glass-bar px-4 py-2.5"
          data-testid="curated-company-chips"
        >
          <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground mr-1">
            Featured Boards:
          </span>
          {CURATED_COMPANIES.map((company) => {
            const isActive = searchQuery.toLowerCase() === company.query.toLowerCase();
            return (
              <button
                key={company.label}
                type="button"
                onClick={() => setSearchQuery(isActive && company.query !== "" ? "" : company.query)}
                aria-pressed={isActive}
                data-testid={`curated-chip-${(company.query || "all").toLowerCase()}`}
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                  isActive
                    ? "border border-primary/50 bg-primary/15 text-primary"
                    : "border border-hairline bg-inset text-text-secondary hover:border-control hover:text-foreground"
                }`}
              >
                <span>{company.label}</span>
              </button>
            );
          })}
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-col gap-3 rounded-xl surface-raised p-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <div className="relative w-full lg:min-w-[220px] lg:flex-1">
              <label htmlFor="discover-search-input" className="sr-only">
                Search company, role, or keywords
              </label>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                id="discover-search-input"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search company, title, keywords…"
                className="h-11 w-full rounded-md border border-hairline bg-inset pl-9 pr-3 text-sm text-rf-cloud placeholder:text-muted-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring"
                data-testid="discover-search-input"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
              <label htmlFor="discover-city-select" className="sr-only">
                Filter by City
              </label>
              <select
                id="discover-city-select"
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                className={`${FILTER_CONTROL} min-w-0 w-full sm:w-auto cursor-pointer text-rf-meta`}
                data-testid="discover-city-select"
              >
                {CANADIAN_CITIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>

              {/* Radius Select (Active when City is selected) */}
              {cityFilter !== "ALL" && (
                <>
                  <label htmlFor="discover-radius-select" className="sr-only">
                    Distance Radius
                  </label>
                  <select
                    id="discover-radius-select"
                    value={radiusFilter}
                    onChange={(e) => setRadiusFilter(e.target.value)}
                    className={`${FILTER_CONTROL} min-w-0 w-full sm:w-auto cursor-pointer text-rf-meta`}
                    data-testid="discover-radius-select"
                  >
                    {RADIUS_OPTIONS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </>
              )}

              {/* Match Score Filter */}
              <label htmlFor="discover-match-select" className="sr-only">
                Filter by Match Tier
              </label>
              <select
                id="discover-match-select"
                value={minScoreFilter}
                onChange={(e) => setMinScoreFilter(e.target.value)}
                className={`${FILTER_CONTROL} min-w-0 w-full sm:w-auto cursor-pointer text-rf-meta`}
                data-testid="discover-match-select"
              >
                {MIN_SCORE_OPTIONS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>

              {/* Sort Order Select */}
              <label htmlFor="discover-sort-select" className="sr-only">
                Sort Listings
              </label>
              <select
                id="discover-sort-select"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className={`${FILTER_CONTROL} min-w-0 w-full sm:w-auto cursor-pointer text-rf-meta`}
                data-testid="discover-sort-select"
              >
                {SORT_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>

              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    data-testid="discover-more-filters-btn"
                    className={`col-span-2 sm:col-span-1 inline-flex min-h-11 items-center justify-center gap-2 rounded-md border px-3 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      activeSecondaryFilterCount > 0
                        ? "border-primary/50 bg-primary/15 text-primary"
                        : "border-hairline bg-rf-elevated text-rf-cloud hover:border-control hover:text-foreground"
                    }`}
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>More filters</span>
                    {activeSecondaryFilterCount > 0 && (
                      <span
                        data-testid="discover-more-filters-count"
                        className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold tabular-nums text-primary-foreground"
                      >
                        {activeSecondaryFilterCount}
                      </span>
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="end"
                  sideOffset={8}
                  className="w-[min(calc(100vw-2rem),22rem)] border-hairline bg-rf-panel p-4 text-rf-cloud shadow-xl"
                >
                  <div className="flex flex-col gap-3.5">
                    <div className="flex items-center justify-between border-b border-hairline pb-2.5">
                      <span className="text-xs font-semibold uppercase tracking-wider text-rf-cloud">
                        More filters
                      </span>
                      {activeSecondaryFilterCount > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setMinSalaryFilter("0");
                            setSourceFilter("ALL");
                            setWorkplaceFilter("ALL");
                            setCanadianOnly(false);
                            setPostedWithin("all");
                          }}
                          className="text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded px-1"
                        >
                          Reset
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      <div className="flex flex-col gap-1">
                        <label
                          htmlFor="discover-salary-select"
                          className="text-xs font-mono uppercase tracking-wider text-rf-meta"
                        >
                          Minimum Salary
                        </label>
                        <select
                          id="discover-salary-select"
                          value={minSalaryFilter}
                          onChange={(e) => setMinSalaryFilter(e.target.value)}
                          className={`${FILTER_CONTROL} w-full cursor-pointer text-rf-meta`}
                          data-testid="discover-salary-select"
                        >
                          {MIN_SALARY_OPTIONS.map((s) => (
                            <option key={s.value} value={s.value}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex flex-col gap-1">
                        <label
                          htmlFor="discover-source-select"
                          className="text-xs font-mono uppercase tracking-wider text-rf-meta"
                        >
                          Source
                        </label>
                        <select
                          id="discover-source-select"
                          value={sourceFilter}
                          onChange={(e) => setSourceFilter(e.target.value)}
                          className={`${FILTER_CONTROL} w-full cursor-pointer text-rf-meta`}
                          data-testid="discover-source-select"
                        >
                          {SOURCES.map((s) => (
                            <option key={s.value} value={s.value}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex flex-col gap-1">
                        <label
                          htmlFor="discover-workplace-select"
                          className="text-xs font-mono uppercase tracking-wider text-rf-meta"
                        >
                          Workplace
                        </label>
                        <select
                          id="discover-workplace-select"
                          value={workplaceFilter}
                          onChange={(e) => setWorkplaceFilter(e.target.value)}
                          className={`${FILTER_CONTROL} w-full cursor-pointer text-rf-meta`}
                          data-testid="discover-workplace-select"
                        >
                          {WORKPLACE_OPTIONS.map((w) => (
                            <option key={w.value} value={w.value}>
                              {w.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <span className="text-xs font-mono uppercase tracking-wider text-rf-meta">
                          Posted
                        </span>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {POSTED_OPTIONS.map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setPostedWithin(opt.value)}
                              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                                postedWithin === opt.value
                                  ? "border border-primary/50 bg-primary/15 text-primary"
                                  : "border border-hairline bg-rf-elevated text-muted-foreground hover:text-foreground"
                              }`}
                              aria-pressed={postedWithin === opt.value}
                              data-testid={`posted-within-${opt.value}`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setCanadianOnly((prev) => !prev)}
                        className={`flex min-h-11 w-full items-center justify-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors ${
                          canadianOnly
                            ? "border-primary/50 bg-primary/15 text-primary"
                            : "border-hairline bg-rf-elevated text-text-secondary hover:text-foreground"
                        }`}
                        aria-pressed={canadianOnly}
                        data-testid="discover-canadian-toggle"
                      >
                        <Globe2 className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Canada Only</span>
                      </button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>

        {/* Listings Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="flex flex-col justify-between gap-4 rounded-xl surface-raised edge-glow p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
                    <div className="space-y-2 flex-1 min-w-0">
                      <Skeleton className="h-4 w-44 max-w-full" />
                      <Skeleton className="h-3 w-28" />
                    </div>
                  </div>
                  <Skeleton className="h-11 w-11 rounded-full shrink-0" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-4/5" />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Skeleton className="h-5 w-24 rounded-md" />
                  <Skeleton className="h-5 w-28 rounded-md" />
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-hairline pt-3">
                  <div className="flex gap-1.5">
                    <Skeleton className="h-5 w-14 rounded-md" />
                    <Skeleton className="h-5 w-16 rounded-md" />
                  </div>
                  <Skeleton className="h-9 w-28 rounded-md shrink-0" />
                </div>
              </div>
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border-dashed surface-raised p-12 text-center">
            <Building2 className="h-10 w-10 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">No jobs match your filters</h3>
            <p className="max-w-sm text-sm text-muted-foreground">
              Try adjusting your city, radius, salary, or workplace filters, or click &quot;Sync Feeds Now&quot; to fetch new roles.
            </p>
            <button
              type="button"
              onClick={handleSyncPublicFeeds}
              disabled={isSyncing}
              className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
            >
              {isSyncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Sync Feeds Now
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {jobs.map((j) => {
              const salaryStr = formatSalary(j);
              const trackedJobId = j.trackedJob?.id;
              const isAlreadyTracked = Boolean(trackedJobId);
              const matchScore = displayScore(j.blendedScore);
              const requiredCount = j.compatibility?.totalRequiredCount ?? 0;

              return (
                <div
                  key={j.id}
                  className="flex flex-col justify-between gap-4 rounded-xl surface-raised card-lift p-4"
                  data-testid={`job-card-${j.id}`}
                >
                  <div className="min-w-0 flex flex-col gap-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2.5 text-sm font-semibold text-text-secondary">
                        <CompanyAvatar company={j.companyName} />
                        <span className="break-words">{j.companyName}</span>
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="rounded border border-hairline bg-inset px-1.5 py-0.5 font-mono text-xs text-text-secondary uppercase">
                          {j.source}
                        </span>
                      </div>
                    </div>

                    <h3 className="break-words text-base font-bold leading-snug tracking-tight text-foreground">
                      {j.title}
                    </h3>

                    {/* Signal Badge Pill with Popover, Funding & H1B Sub-Badges */}
                    {(() => {
                      const meta = jobCardMeta.get(j.id);
                      const fundingBadge = meta?.fundingBadge ?? null;
                      const h1bBadge = meta?.h1bBadge ?? null;
                      const matchedClientSkills = meta?.matchedClientSkills ?? [];
                      const clientSkillPct = meta?.clientSkillPct ?? null;
                      return (
                        <div className="flex flex-wrap items-center gap-2 my-0.5">
                          {hasEvidence ? (
                            <div className="flex items-center gap-2 [&_svg]:[filter:drop-shadow(0_0_10px_rgb(var(--accent-contrast)/0.45))]">
                              <FitPercentageDial
                                compositeScore={matchScore}
                                breakdown={j.scoreBreakdown}
                                size={28}
                                showLabel={false}
                              />
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              {clientSkillPct !== null && matchedClientSkills.length > 0 && (
                                <span
                                  data-testid="discover-skill-match-badge"
                                  className="rounded border border-signal/35 bg-signal/10 px-1.5 py-0.5 font-mono text-xs font-semibold text-signal"
                                  title={`Matched skills: ${matchedClientSkills.slice(0, 5).join(", ")}`}
                                >
                                  {clientSkillPct}% Skill Match
                                </span>
                              )}
                              <Link
                                href="/library"
                                className="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                              >
                                Add evidence to score
                              </Link>
                            </div>
                          )}
                          {hasEvidence ? (
                          <JobCardSignalBadge
                            compositeScore={matchScore ?? undefined}
                            compatibility={j.compatibility}
                            fundingBadge={fundingBadge}
                            h1bBadge={h1bBadge}
                            companyName={j.companyName}
                            jobId={j.id}
                          />
                          ) : null}
                        </div>
                      );
                    })()}

                    <div className="mt-1 flex flex-col gap-1 font-mono text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        {j.location || "Remote / Canada"}
                        {j.workplaceType && j.workplaceType !== "UNSPECIFIED" ? (
                          <span className="rounded bg-inset border border-hairline px-1.5 py-0.2 text-xs text-text-secondary lowercase">
                            ({j.workplaceType})
                          </span>
                        ) : null}
                      </span>

                      {salaryStr ? (
                        <span className="flex items-center gap-1.5 text-text-primary font-semibold">
                          <DollarSign className="h-3 w-3 text-primary" />
                          {salaryStr}
                        </span>
                      ) : null}

                      {j.postedAt ? (
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          {new Date(j.postedAt).toLocaleDateString()}
                        </span>
                      ) : null}
                    </div>

                    {j.compatibility && requiredCount > 0 && (
                      <div className="mt-2 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
                          <span className="rounded bg-primary/10 border border-primary/35 px-2 py-0.5 text-primary">
                            {j.compatibility.matchedSkills.length}/{requiredCount} Skills Matched
                          </span>
                          {j.compatibility.matchedEvidenceCount > 0 && (
                            <span className="rounded border border-signal/35 bg-signal/10 px-2 py-0.5 text-signal">
                              {j.compatibility.matchedEvidenceCount} Evidence Items
                            </span>
                          )}
                        </div>
                        {/* High-density Tech Diff Pill List */}
                        <TechDiffPillList
                          verifiedSkillNames={j.compatibility.matchedSkills}
                          missingSkillNames={j.compatibility.missingSkills}
                          maxDisplay={5}
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-hairline pt-3 text-xs">
                    {isSafeHref(j.applyUrl) ? (
                      <a
                        href={j.applyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-11 sm:min-h-0 items-center gap-1 text-text-secondary transition-colors hover:text-foreground"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Apply Link
                      </a>
                    ) : (
                      <span className="font-mono text-muted-foreground">No Link</span>
                    )}

                    {isAlreadyTracked && trackedJobId ? (
                      <Link
                        href={`/tailor?jobId=${encodeURIComponent(trackedJobId)}`}
                        className="flex min-h-11 sm:min-h-0 items-center gap-1.5 rounded-md border border-signal/40 bg-signal/10 px-2.5 py-1 text-xs font-medium text-signal transition hover:bg-signal/20"
                        data-testid={`in-tracker-btn-${j.id}`}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        In Tracker
                      </Link>
                    ) : (
                      <button
                        type="button"
                        disabled={promotingId === j.id}
                        onClick={() => handlePromoteJob(j)}
                        className="flex min-h-11 items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-bold text-primary-foreground btn-glow active:scale-[0.98] hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
                        data-testid={`promote-btn-${j.id}`}
                      >
                        {promotingId === j.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="h-3.5 w-3.5" />
                        )}
                        Save to Tracker
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {!isLoading && totalJobs > 0 && (
          <div className="flex items-center justify-between gap-2 border-t border-hairline py-4">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex min-h-11 sm:min-h-0 items-center gap-1 rounded-md border border-hairline bg-inset px-3 py-2 sm:py-1.5 text-xs text-rf-cloud transition hover:bg-elevated hover:text-foreground disabled:opacity-40"
              data-testid="discover-page-prev"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Prev
            </button>
            <span className="text-center text-xs tabular-nums text-on-surface-variant" data-testid="discover-page-indicator">
              Page {page} of {totalPages} ({totalJobs} total roles)
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex min-h-11 sm:min-h-0 items-center gap-1 rounded-md border border-hairline bg-inset px-3 py-2 sm:py-1.5 text-xs text-rf-cloud transition hover:bg-elevated hover:text-foreground disabled:opacity-40"
              data-testid="discover-page-next"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
