"use client";

import React, { useState, useEffect, useCallback } from "react";
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
  SlidersHorizontal,
  Compass,
} from "lucide-react";
import { AppShell } from "@/components/design-system/app-shell";
import { PageHeader } from "@/components/design-system/page-header";
import { StatusPill } from "@/components/design-system/status-pill";
import { CommandButton } from "@/components/design-system/command-button";
import { Skeleton } from "@/components/ui/skeleton";
import { TrackerSubNav } from "@/components/tracker/tracker-sub-nav";
import { isSafeHref } from "@/lib/security/safe-fetch";
import { type PostedWithin } from "@/lib/jobs/posted-within";
import type { ScoreBreakdown } from "@/lib/scoring/blended-sort";
import type { CompatibilityResult } from "@/lib/scoring/compatibility-engine";

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

const FILTER_CONTROL =
  "min-h-11 rounded-md border border-slate-700 bg-rf-elevated px-2.5 text-[12.5px] text-rf-cloud placeholder-slate-500 transition-colors duration-150 focus:border-amber-500/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60";

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
  const [locationSearchInput, setLocationSearchInput] = useState("");
  const [isLocationDropdownOpen, setIsLocationDropdownOpen] = useState(false);
  const [radiusFilter, setRadiusFilter] = useState("100");
  const [minSalaryFilter, setMinSalaryFilter] = useState("0");
  const [minScoreFilter, setMinScoreFilter] = useState("0");
  const [sortOrder, setSortOrder] = useState("blended");
  const [canadianOnly, setCanadianOnly] = useState(false);
  const [postedWithin, setPostedWithin] = useState<PostedWithin>("all");

  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchQuery.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  const fetchIngestedJobs = useCallback(async () => {
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

      const res = await fetch(`/api/connectors/jobs?${params.toString()}`);
      const json = await res.json();
      if (res.ok && json.success) {
        setJobs(json.data || []);
        setTotalJobs(json.meta?.total ?? 0);
        setTotalPages(json.meta?.totalPages ?? 1);
      }
    } catch (err) {
      console.error("Failed to fetch connector jobs:", err);
    } finally {
      setIsLoading(false);
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
    fetchIngestedJobs();
  }, [fetchIngestedJobs]);

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
      const res = await fetch("/api/connectors/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json();
      if (res.ok && json.success) {
        const summary = json.data?.summary;
        const msg = summary
          ? `Synced ${summary.totalFound} jobs (${summary.totalInserted} new) from ${summary.providerCount} public connectors!`
          : "Sync completed successfully!";
        setNotification(msg);
        fetchIngestedJobs();
      } else {
        setNotification(json.error || "Sync failed.");
      }
    } catch (err) {
      setNotification("Failed to connect to ingestion service.");
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
      const json = await res.json();
      if (res.ok && json.success) {
        setJobs((prev) =>
          prev.map((item) =>
            item.id === job.id
              ? {
                  ...item,
                  trackedJob: {
                    id: json.data?.job?.id || "tracked",
                    status: "SAVED",
                  },
                }
              : item
          )
        );
        setNotification(`Promoted "${job.title}" at ${job.companyName} to your Job Tracker!`);
      } else {
        setNotification(json.error || "Failed to save job to tracker.");
      }
    } catch (err) {
      setNotification("Error promoting job to tracker.");
    } finally {
      setPromotingId(null);
    }
  };

  const formatSalary = (j: IngestedJobItem) => {
    if (!j.salaryMin && !j.salaryMax) return null;
    const currency = j.salaryCurrency || "CAD";
    if (j.salaryMin && j.salaryMax) {
      return `$${j.salaryMin.toLocaleString()} – $${j.salaryMax.toLocaleString()} ${currency}`;
    }
    if (j.salaryMin) {
      return `From $${j.salaryMin.toLocaleString()} ${currency}`;
    }
    return `Up to $${j.salaryMax?.toLocaleString()} ${currency}`;
  };

  return (
    <AppShell variant="tracker">
      <TrackerSubNav
        actions={
          <CommandButton
            variant="secondary"
            size="sm"
            disabled={isSyncing}
            onClick={handleSyncPublicFeeds}
            data-testid="sync-connectors-btn"
          >
            {isSyncing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5 text-amber-400" />
            )}
            {isSyncing ? "Syncing Feeds..." : "Sync Public Feeds"}
          </CommandButton>
        }
      />

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 md:p-8">
        <PageHeader
          eyebrow="Browse live listings"
          title="Discovered Jobs"
          description="Live tech listings ingested from Greenhouse, Lever, Ashby, Adzuna, Jobicy, Remotive, and RemoteOK. Save roles directly into your application tracker."
          statusBadge={<StatusPill status="amber" label={`${totalJobs} Ingested`} />}
        />

        {notification ? (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs font-medium text-emerald-400"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              <span>{notification}</span>
            </div>
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => setNotification(null)}
              className="inline-flex min-h-11 min-w-11 items-center justify-center text-slate-400 hover:text-white focus-visible:ring-2 focus-visible:ring-amber-500/60"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        ) : null}

        {/* Filter Toolbar */}
        <div className="flex flex-col gap-3 rounded-xl border border-slate-800/80 bg-rf-surface p-4">
          <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
            <div className="relative max-w-md flex-1">
              <label htmlFor="discover-search-input" className="sr-only">
                Search company, role, or keywords
              </label>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <input
                id="discover-search-input"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search company, title, keywords..."
                className="h-11 w-full rounded-md border border-slate-800 bg-rf-bg pl-9 pr-3 text-xs text-rf-cloud placeholder:text-slate-500 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
                data-testid="discover-search-input"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Location Search Input with Live Suggestions */}
              <div className="relative">
                <div className="flex items-center">
                  <MapPin className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={locationSearchInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      setLocationSearchInput(val);
                      setIsLocationDropdownOpen(true);
                      const match = CANADIAN_CITIES.find(
                        (c) =>
                          c.label.toLowerCase().includes(val.toLowerCase()) ||
                          c.value.toLowerCase().includes(val.toLowerCase())
                      );
                      if (val.trim() === "") {
                        setCityFilter("ALL");
                      } else if (match && match.value !== "ALL") {
                        setCityFilter(match.value);
                      }
                    }}
                    onFocus={() => setIsLocationDropdownOpen(true)}
                    onBlur={() => setTimeout(() => setIsLocationDropdownOpen(false), 250)}
                    placeholder="Location / City (e.g. Toronto)..."
                    className="h-11 w-48 rounded-md border border-slate-700 bg-rf-elevated pl-9 pr-3 text-xs text-rf-cloud placeholder:text-slate-500 outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
                    data-testid="discover-location-input"
                  />
                  {cityFilter !== "ALL" && (
                    <button
                      type="button"
                      onClick={() => {
                        setCityFilter("ALL");
                        setLocationSearchInput("");
                      }}
                      className="absolute right-2 text-slate-500 hover:text-slate-300"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>

                {isLocationDropdownOpen && (
                  <div className="absolute left-0 top-full z-50 mt-1 max-h-56 w-56 overflow-auto rounded-lg border border-slate-700 bg-slate-900 p-1 shadow-2xl">
                    {CANADIAN_CITIES.filter(
                      (c) =>
                        c.label.toLowerCase().includes(locationSearchInput.toLowerCase()) ||
                        c.value.toLowerCase().includes(locationSearchInput.toLowerCase())
                    ).map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        onMouseDown={() => {
                          setCityFilter(c.value);
                          setLocationSearchInput(c.value === "ALL" ? "" : c.label);
                          setIsLocationDropdownOpen(false);
                        }}
                        className={`flex w-full items-center gap-2 rounded px-3 py-1.5 text-left text-xs transition hover:bg-amber-500/15 hover:text-amber-300 ${
                          cityFilter === c.value
                            ? "bg-amber-500/20 text-amber-300 font-bold"
                            : "text-slate-300"
                        }`}
                      >
                        <MapPin className="h-3 w-3 shrink-0 text-slate-500" />
                        <span>{c.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* City Select */}
              <label htmlFor="discover-city-select" className="sr-only">
                Filter by City
              </label>
              <select
                id="discover-city-select"
                value={cityFilter}
                onChange={(e) => {
                  setCityFilter(e.target.value);
                  const found = CANADIAN_CITIES.find((c) => c.value === e.target.value);
                  if (found && found.value !== "ALL") {
                    setLocationSearchInput(found.label);
                  } else {
                    setLocationSearchInput("");
                  }
                }}
                className={`${FILTER_CONTROL} cursor-pointer text-rf-meta`}
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
                    className={`${FILTER_CONTROL} cursor-pointer text-rf-meta`}
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

              {/* Salary Select */}
              <label htmlFor="discover-salary-select" className="sr-only">
                Filter by Minimum Salary
              </label>
              <select
                id="discover-salary-select"
                value={minSalaryFilter}
                onChange={(e) => setMinSalaryFilter(e.target.value)}
                className={`${FILTER_CONTROL} cursor-pointer text-rf-meta`}
                data-testid="discover-salary-select"
              >
                {MIN_SALARY_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>

              {/* Match Score Filter */}
              <label htmlFor="discover-match-select" className="sr-only">
                Filter by Match Tier
              </label>
              <select
                id="discover-match-select"
                value={minScoreFilter}
                onChange={(e) => setMinScoreFilter(e.target.value)}
                className={`${FILTER_CONTROL} cursor-pointer text-rf-meta`}
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
                className={`${FILTER_CONTROL} cursor-pointer font-medium text-amber-300 border-amber-500/40`}
                data-testid="discover-sort-select"
              >
                {SORT_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>

              {/* Source Select */}
              <label htmlFor="discover-source-select" className="sr-only">
                Filter by Source
              </label>
              <select
                id="discover-source-select"
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className={`${FILTER_CONTROL} cursor-pointer text-rf-meta`}
                data-testid="discover-source-select"
              >
                {SOURCES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>

              {/* Workplace Select */}
              <label htmlFor="discover-workplace-select" className="sr-only">
                Filter by Workplace
              </label>
              <select
                id="discover-workplace-select"
                value={workplaceFilter}
                onChange={(e) => setWorkplaceFilter(e.target.value)}
                className={`${FILTER_CONTROL} cursor-pointer text-rf-meta`}
                data-testid="discover-workplace-select"
              >
                {WORKPLACE_OPTIONS.map((w) => (
                  <option key={w.value} value={w.value}>
                    {w.label}
                  </option>
                ))}
              </select>

              {/* Canadian Eligible Toggle */}
              <button
                type="button"
                onClick={() => setCanadianOnly((prev) => !prev)}
                className={`flex min-h-11 items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors ${
                  canadianOnly
                    ? "border-amber-500/40 bg-amber-500/15 text-amber-300"
                    : "border-slate-700 bg-rf-elevated text-slate-400 hover:text-white"
                }`}
                data-testid="discover-canadian-toggle"
              >
                <Globe2 className="h-3.5 w-3.5" />
                <span>🇨🇦 Canada Only</span>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-slate-800/80 pt-3">
            <span className="text-[11px] font-mono uppercase tracking-wider text-rf-meta">
              Posted:
            </span>
            {POSTED_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPostedWithin(opt.value)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  postedWithin === opt.value
                    ? "border border-amber-500/40 bg-amber-500/15 text-amber-300"
                    : "border border-transparent text-slate-400 hover:bg-slate-800 hover:text-white"
                }`}
                data-testid={`posted-within-${opt.value}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Listings Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="flex flex-col gap-3 rounded-xl border border-slate-800/80 bg-rf-surface p-4"
              >
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-800 bg-rf-surface/40 p-12 text-center">
            <Building2 className="h-10 w-10 text-slate-600" />
            <h3 className="text-sm font-semibold text-slate-300">No jobs match your filters</h3>
            <p className="max-w-sm text-xs text-slate-500">
              Try adjusting your city, radius, salary, or workplace filters, or click &quot;Sync Feeds Now&quot; to fetch new roles.
            </p>
            <button
              type="button"
              onClick={handleSyncPublicFeeds}
              disabled={isSyncing}
              className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-amber-400 disabled:opacity-50"
            >
              {isSyncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Sync Feeds Now
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {jobs.map((j) => {
              const salaryStr = formatSalary(j);
              const isAlreadyTracked = Boolean(j.trackedJob);
              const matchScore = j.blendedScore ?? 75;

              return (
                <div
                  key={j.id}
                  className="flex flex-col justify-between gap-4 rounded-xl border border-slate-800/80 bg-rf-surface p-4 transition-all duration-200 hover:border-amber-500/40"
                  data-testid={`job-card-${j.id}`}
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-400">
                        <Building2 className="h-3.5 w-3.5 text-slate-400" />
                        {j.companyName}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                            matchScore >= 80
                              ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                              : matchScore >= 60
                              ? "border-amber-500/40 bg-amber-500/15 text-amber-300"
                              : "border-slate-700 bg-slate-800/80 text-slate-400"
                          }`}
                          title={`Blended Score: ${matchScore}% (ATS: ${j.scoreBreakdown?.atsScore ?? matchScore}%, Recency: ${j.scoreBreakdown?.recencyScore ?? "N/A"}%)`}
                          data-testid={`match-badge-${j.id}`}
                        >
                          {matchScore}% Match
                        </span>
                        <span className="rounded border border-slate-700 bg-slate-800/80 px-1.5 py-0.5 font-mono text-[10px] text-slate-300 uppercase">
                          {j.source}
                        </span>
                      </div>
                    </div>

                    <h3 className="text-sm font-bold leading-snug tracking-tight text-white">
                      {j.title}
                    </h3>

                    <div className="mt-1 flex flex-col gap-1 font-mono text-xs text-slate-400">
                      <span className="flex items-center gap-1.5">
                        <MapPin className="h-3 w-3 text-slate-500" />
                        {j.location || "Remote / Canada"}
                        {j.workplaceType && j.workplaceType !== "UNSPECIFIED" ? (
                          <span className="rounded bg-slate-800 px-1 py-0.2 text-[10px] text-slate-400 lowercase">
                            ({j.workplaceType})
                          </span>
                        ) : null}
                      </span>

                      {salaryStr ? (
                        <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                          <DollarSign className="h-3 w-3 text-emerald-500" />
                          {salaryStr}
                        </span>
                      ) : null}

                      {j.postedAt ? (
                        <span className="flex items-center gap-1.5 text-slate-500">
                          <Calendar className="h-3 w-3 text-slate-600" />
                          {new Date(j.postedAt).toLocaleDateString()}
                        </span>
                      ) : null}
                    </div>

                    {j.compatibility && (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] font-mono">
                        <span className="rounded bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-emerald-300">
                          {j.compatibility.matchedSkills.length}/{j.compatibility.totalRequiredCount || j.compatibility.matchedSkills.length || 1} Skills Matched
                        </span>
                        {j.compatibility.matchedEvidenceCount > 0 && (
                          <span className="rounded bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 text-cyan-300">
                            {j.compatibility.matchedEvidenceCount} Evidence Items
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-800 pt-3 text-xs">
                    {isSafeHref(j.applyUrl) ? (
                      <a
                        href={j.applyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-slate-400 transition-colors hover:text-white"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Apply Link
                      </a>
                    ) : (
                      <span className="font-mono text-slate-600">No Link</span>
                    )}

                    {isAlreadyTracked ? (
                      <Link
                        href={`/tailor?jobId=${j.trackedJob?.id}`}
                        className="flex items-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/20"
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
                        className="flex items-center gap-1.5 rounded-md bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-950 shadow-sm transition-colors hover:bg-amber-400 disabled:opacity-50"
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
          <div className="flex items-center justify-between gap-2 border-t border-slate-800 bg-rf-bg py-4">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-3 py-1.5 text-xs text-rf-meta transition hover:text-rf-cloud disabled:opacity-40"
              data-testid="discover-page-prev"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Prev
            </button>
            <span className="text-xs text-slate-500" data-testid="discover-page-indicator">
              Page {page} of {totalPages} ({totalJobs} total roles)
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-3 py-1.5 text-xs text-rf-meta transition hover:text-rf-cloud disabled:opacity-40"
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
