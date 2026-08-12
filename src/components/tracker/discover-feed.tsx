"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  ExternalLink,
  Sparkles,
  Lock,
  Building2,
  MapPin,
  Calendar,
  CheckCircle2,
  Loader2,
  RefreshCw,
  X,
} from "lucide-react";
import { AppShell } from "@/components/design-system/app-shell";
import { PageHeader } from "@/components/design-system/page-header";
import { StatusPill } from "@/components/design-system/status-pill";
import { CommandButton } from "@/components/design-system/command-button";
import { Skeleton } from "@/components/ui/skeleton";
import { TrackerSubNav } from "@/components/tracker/tracker-sub-nav";
import { isSafeHref } from "@/lib/security/safe-fetch";
import {
  isPostedWithinParam,
  type PostedWithin,
} from "@/lib/jobs/posted-within";

interface DiscoveredJob {
  id: string;
  externalId: string;
  company: string;
  roleTitle: string;
  location: string;
  applyUrl: string;
  datePosted: string | null;
  jobType: string;
  isClosed: boolean;
  createdAt: string;
}

const SAMPLE_DEMO_FEED = `
| Company | Role | Location | Application Link | Date Posted |
| :--- | :--- | :--- | :--- | :--- |
| **[Datadog](https://datadog.com)** | Software Engineer Intern | New York, NY | [Apply](https://simplify.jobs/p/datadog) | 1 day ago |
| **[Stripe](https://stripe.com)** | Backend Systems Intern | Seattle, WA \| SF, CA | [Apply](https://simplify.jobs/p/stripe) | 2 days ago |
| **[Palantir](https://palantir.com)** | Forward Deployed Engineer Intern | Palo Alto, CA | [Apply](https://simplify.jobs/p/palantir) | 3 days ago |
| **[Meta](https://meta.com)** | Production Engineering Intern | Menlo Park, CA | [Apply](https://simplify.jobs/p/meta) | 5 days ago |
| **~~Google~~** | ~~STEP Intern~~ | ~~Mountain View, CA~~ | 🔒 | 1 week ago |
`;

const POSTED_OPTIONS: { value: PostedWithin; label: string }[] = [
  { value: "all", label: "Any time" },
  { value: "1d", label: "24h" },
  { value: "3d", label: "3 days" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
];

export function DiscoverFeed() {
  const router = useRouter();
  const [jobs, setJobs] = useState<DiscoveredJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "closed">("open");
  const [postedWithin, setPostedWithin] = useState<PostedWithin>("all");
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchQuery.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  const fetchDiscoveredJobs = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        search: debouncedSearch,
        filter: statusFilter,
        postedWithin,
      });
      const res = await fetch(`/api/jobs/discovered?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setJobs(json.data);
      }
    } catch (err) {
      console.error("Failed to fetch discovered jobs:", err);
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, statusFilter, postedWithin]);

  useEffect(() => {
    fetchDiscoveredJobs();
  }, [fetchDiscoveredJobs]);

  const handleSyncDemo = async () => {
    try {
      setIsSyncing(true);
      const res = await fetch("/api/jobs/sync-pittcsc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawMarkdown: SAMPLE_DEMO_FEED, jobType: "Internship" }),
      });
      const json = await res.json();
      if (json.success) {
        setNotification(`Synced ${json.processed} Pitt CSC Summer 2026 listings!`);
        fetchDiscoveredJobs();
      }
    } catch (err) {
      console.error("Sync error:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePromoteJob = async (job: DiscoveredJob) => {
    try {
      setPromotingId(job.id);
      const res = await fetch("/api/jobs/promote-discovered", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discoveredJobId: job.id }),
      });
      const json = await res.json();
      if (json.success) {
        router.push("/tracker/saved");
      }
    } catch (err) {
      console.error("Failed to promote job:", err);
    } finally {
      setPromotingId(null);
    }
  };

  return (
    <AppShell variant="tracker">
      <TrackerSubNav
        actions={
          <CommandButton
            variant="secondary"
            size="sm"
            disabled={isSyncing}
            onClick={handleSyncDemo}
            data-testid="sync-pittcsc-btn"
          >
            {isSyncing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5 text-amber-400" />
            )}
            Sync Pitt CSC Feed
          </CommandButton>
        }
      />

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 md:p-8">
        <PageHeader
          eyebrow="Browse listings"
          title="Internship Feed"
          description="Pitt CSC / Simplify listings. Save a role into your tracker pipeline with Tailor Application. Daily GitHub Action can refresh this feed when secrets are configured."
          statusBadge={<StatusPill status="amber" label="DiscoveredJob" />}
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

        <div className="flex flex-col gap-3 rounded-xl border border-slate-800/80 bg-rf-surface p-4">
          <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
            <div className="relative max-w-md flex-1">
              <label htmlFor="discover-search-input" className="sr-only">
                Filter by company, role, or location
              </label>
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <input
                id="discover-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by company, role title, or location..."
                className="h-11 w-full rounded-md border border-slate-800 bg-rf-bg pl-9 pr-3 text-xs text-rf-cloud placeholder:text-slate-500 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
                data-testid="discover-search-input"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1">
              {(["all", "open", "closed"] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`rounded-md px-3 py-1 text-xs font-mono capitalize transition-colors ${
                    statusFilter === st
                      ? "bg-amber-500 font-bold text-slate-950"
                      : "text-slate-400 hover:bg-slate-800 hover:text-white"
                  }`}
                  data-testid={`discover-filter-${st}`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-slate-800/80 pt-3">
            <span className="text-[11px] font-mono uppercase tracking-wider text-rf-meta">
              Posted
            </span>
            {POSTED_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  if (isPostedWithinParam(opt.value)) setPostedWithin(opt.value);
                }}
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
            <h3 className="text-sm font-semibold text-slate-300">No jobs in this feed</h3>
            <p className="max-w-sm text-xs text-slate-500">
              Sync the Pitt CSC feed or widen the posted-time filter.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {jobs.map((j) => (
              <div
                key={j.id}
                className={`flex flex-col justify-between gap-4 rounded-xl border border-slate-800/80 bg-rf-surface p-4 transition-all duration-200 ${
                  j.isClosed ? "opacity-60" : "hover:border-amber-500/40"
                }`}
              >
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-400">
                      <Building2 className="h-3.5 w-3.5 text-slate-400" />
                      {j.company}
                    </span>
                    {j.isClosed ? (
                      <span className="flex items-center gap-1 rounded border border-red-500/20 bg-red-500/10 px-2 py-0.5 font-mono text-[10px] text-red-400">
                        <Lock className="h-3 w-3" /> Closed
                      </span>
                    ) : (
                      <span className="rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] text-emerald-400">
                        Active
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm font-bold leading-snug tracking-tight text-white">
                    {j.roleTitle}
                  </h3>

                  <div className="mt-1 flex flex-col gap-1 font-mono text-xs text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-3 w-3 text-slate-500" />
                      {j.location || "Remote / Various"}
                    </span>
                    {j.datePosted ? (
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <Calendar className="h-3 w-3 text-slate-600" />
                        {j.datePosted}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-slate-800 pt-3 text-xs">
                  {isSafeHref(j.applyUrl) && !j.isClosed ? (
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
                    <span className="font-mono text-slate-600">No Active Link</span>
                  )}

                  {!j.isClosed ? (
                    <button
                      type="button"
                      disabled={promotingId === j.id}
                      onClick={() => handlePromoteJob(j)}
                      className="flex items-center gap-1.5 rounded-md bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-950 shadow-sm transition-colors hover:bg-amber-400"
                      data-testid={`tailor-btn-${j.id}`}
                    >
                      {promotingId === j.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                      Save to Tracker
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
