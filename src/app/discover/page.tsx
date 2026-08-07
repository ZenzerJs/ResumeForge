"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
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
  Zap,
} from "lucide-react";
import { TopNav } from "@/components/navigation/top-nav";
import { Skeleton } from "@/components/ui/skeleton";

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

export default function DiscoverPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<DiscoveredJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "closed">("open");

  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);



  const fetchDiscoveredJobs = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/jobs/discovered?search=${encodeURIComponent(searchQuery)}&filter=${statusFilter}`);
      const json = await res.json();
      if (json.success) {
        setJobs(json.data);
      }
    } catch (err) {
      console.error("Failed to fetch discovered jobs:", err);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, statusFilter]);

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
        router.push("/tracker");
      }
    } catch (err) {
      console.error("Failed to promote job:", err);
    } finally {
      setPromotingId(null);
    }
  };

  return (
    <div className="min-h-screen text-slate-100 flex flex-col font-sans" style={{ backgroundColor: "#0A0E17" }}>
      <TopNav />

      <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-8 flex flex-col gap-6">
        {/* Header Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5" style={{ borderColor: "#1E2536" }}>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-500/10 border border-amber-500/20 text-amber-400">
                Pitt CSC / Simplify 2026 Feed
              </span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight mt-1 flex items-center gap-2">
              <Zap className="h-6 w-6 text-amber-400" />
              Discover Tech Internships
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Automated Summer 2026 Markdown Ingestion Engine. Click &quot;Tailor Application&quot; to clone directly into your Phase 6 Tracker.
            </p>
          </div>

          <button
            type="button"
            disabled={isSyncing}
            onClick={handleSyncDemo}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors self-start sm:self-auto"
            data-testid="sync-pittcsc-btn"
          >
            {isSyncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 text-amber-400" />}
            Sync Pitt CSC Feed
          </button>
        </div>

        {notification && (
          <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-medium flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              <span>{notification}</span>
            </div>
            <button type="button" onClick={() => setNotification(null)} className="text-slate-400 hover:text-white">✕</button>
          </div>
        )}

        {/* Toolbar: Search + Filter Tabs */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-xl border" style={{ backgroundColor: "#111622", borderColor: "#1E2536" }}>
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by company, role title, or location..."
              className="w-full h-8 pl-9 pr-3 rounded-md bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
              data-testid="discover-search-input"
            />
          </div>

          {/* Status Tabs */}
          <div className="flex items-center gap-1">
            {(["all", "open", "closed"] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-md text-xs font-mono capitalize transition-colors ${
                  statusFilter === st
                    ? "bg-amber-500 text-slate-950 font-bold"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Job Listings Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="p-4 rounded-xl border flex flex-col gap-3" style={{ backgroundColor: "#111622", borderColor: "#1E2536" }}>
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <div className="p-12 text-center rounded-xl border border-dashed flex flex-col items-center gap-3" style={{ borderColor: "#1E2536", backgroundColor: "rgba(17, 22, 34, 0.4)" }}>
            <Building2 className="h-10 w-10 text-slate-600" />
            <h3 className="text-sm font-semibold text-slate-300">No discovered jobs found</h3>
            <p className="text-xs text-slate-500 max-w-sm">
              Click &quot;Sync Pitt CSC Feed&quot; above to ingest Summer 2026 tech internships into your local feed.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {jobs.map((j) => (
              <div
                key={j.id}
                className={`p-4 rounded-xl border flex flex-col justify-between gap-4 transition-all duration-200 ${
                  j.isClosed ? "opacity-60" : "hover:border-amber-500/40"
                }`}
                style={{ backgroundColor: "#111622", borderColor: "#1E2536" }}
              >
                <div className="flex flex-col gap-2">
                  {/* Top Badge Row */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 text-slate-400" />
                      {j.company}
                    </span>
                    {j.isClosed ? (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 flex items-center gap-1">
                        <Lock className="h-3 w-3" /> Closed
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Active
                      </span>
                    )}
                  </div>

                  {/* Role Title */}
                  <h3 className="font-bold text-sm text-white tracking-tight leading-snug">
                    {j.roleTitle}
                  </h3>

                  {/* Details */}
                  <div className="flex flex-col gap-1 text-xs text-slate-400 mt-1 font-mono">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <MapPin className="h-3 w-3 text-slate-500" />
                      {j.location || "Remote / Various"}
                    </span>
                    {j.datePosted && (
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <Calendar className="h-3 w-3 text-slate-600" />
                        {j.datePosted}
                      </span>
                    )}
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="flex items-center justify-between pt-3 border-t text-xs" style={{ borderColor: "#1E2536" }}>
                  {j.applyUrl && !j.isClosed ? (
                    <a
                      href={j.applyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Apply Link
                    </a>
                  ) : (
                    <span className="text-slate-600 font-mono">No Active Link</span>
                  )}

                  {!j.isClosed && (
                    <button
                      type="button"
                      disabled={promotingId === j.id}
                      onClick={() => handlePromoteJob(j)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors shadow-sm"
                      data-testid={`tailor-btn-${j.id}`}
                    >
                      {promotingId === j.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                      Tailor Application
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
