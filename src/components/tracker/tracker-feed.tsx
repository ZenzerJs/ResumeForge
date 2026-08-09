"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  Plus,
  Briefcase,
  Building2,
  Calendar,
  ExternalLink,
  Clipboard,
  ClipboardCheck,
  ChevronDown,
  Loader2,
  Save,
  Trash2,
  MapPin,
  Sparkles,
  CheckCircle2,
  Clock,
  XCircle,
  Archive,
  Star,
  FileText,
  DownloadCloud,
} from "lucide-react";
import { JobStatus } from "@/lib/db/jobs";
import { AppShell } from "@/components/design-system/app-shell";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrackerSubNav,
  TrackerRefreshButton,
} from "@/components/tracker/tracker-sub-nav";
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

export interface JobVariant {
  id: string;
  variantTitle: string;
  status: string;
  createdAt: string;
}

export interface JobCoverLetter {
  id: string;
  title: string;
  status: string;
  createdAt: string;
}

export interface JobItem {
  id: string;
  company?: string | null;
  roleTitle?: string | null;
  rawDescription: string;
  source: string;
  extractedRequirements: {
    requiredSkills: string[];
    preferredSkills: string[];
    domainTerms: string[];
  };
  status: JobStatus;
  appliedAt?: string | null;
  notes?: string | null;
  createdAt: string;
  variants?: JobVariant[];
  coverLetters?: JobCoverLetter[];
}

export {
  extractLocationFromNotes,
  extractApplyUrlFromNotes,
  extractPostingDateFromNotes,
  extractSalaryFromNotes,
  isPlaceholderDescription,
};

const STATUS_CONFIG: Record<
  JobStatus,
  { label: string; icon: React.ElementType; color: string; bg: string; border: string }
> = {
  SAVED: {
    label: "Saved",
    icon: Star,
    color: "text-slate-300",
    bg: "bg-slate-800",
    border: "border-slate-700",
  },
  APPLIED: {
    label: "Applied",
    icon: CheckCircle2,
    color: "text-amber-400",
    bg: "bg-amber-950/60",
    border: "border-amber-800/60",
  },
  INTERVIEWING: {
    label: "Interviewing",
    icon: Clock,
    color: "text-emerald-400",
    bg: "bg-emerald-950/60",
    border: "border-emerald-800/60",
  },
  OFFER: {
    label: "Offer",
    icon: CheckCircle2,
    color: "text-emerald-300",
    bg: "bg-emerald-900/80",
    border: "border-emerald-600/60",
  },
  REJECTED: {
    label: "Rejected",
    icon: XCircle,
    color: "text-red-400",
    bg: "bg-red-950/50",
    border: "border-red-800/50",
  },
  ARCHIVED: {
    label: "Archived",
    icon: Archive,
    color: "text-slate-500",
    bg: "bg-slate-900",
    border: "border-slate-800",
  },
};

const ALL_STATUSES = Object.keys(STATUS_CONFIG) as JobStatus[];

interface TrackerFeedProps {
  filterStatuses?: JobStatus[];
}

export function TrackerFeed({ filterStatuses }: TrackerFeedProps) {
  const router = useRouter();
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newCompany, setNewCompany] = useState<string>("");
  const [newRoleTitle, setNewRoleTitle] = useState<string>("");
  const [newRawDescription, setNewRawDescription] = useState<string>("");

  // Task 8.2: Tier 1 Bulk Ingestion state
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<JobStatus | "ALL">("ALL");
  const [postedWithin, setPostedWithin] = useState<PostedWithin>("all");
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [copiedJobId, setCopiedJobId] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<{ [id: string]: string }>({});
  const [isSavingNotes, setIsSavingNotes] = useState<{ [id: string]: boolean }>({});
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<{ [id: string]: boolean }>({});
  const activeCardRef = useRef<HTMLDivElement | null>(null);

  // Restore last active job from sessionStorage
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

  // Scroll active card into view after load
  useEffect(() => {
    if (!isLoading && activeJobId && activeCardRef.current) {
      activeCardRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [isLoading, activeJobId]);

  const handleSelectJob = (jobId: string) => {
    const next = activeJobId === jobId ? null : jobId;
    setActiveJobId(next);
    if (next) {
      sessionStorage.setItem("resumeforge_active_job_id", next);
    } else {
      sessionStorage.removeItem("resumeforge_active_job_id");
    }
  };

  const handleCopyJD = async (job: JobItem) => {
    try {
      await navigator.clipboard.writeText(job.rawDescription);
      setCopiedJobId(job.id);
      // Persist this as the active job
      sessionStorage.setItem("resumeforge_active_job_id", job.id);
      setActiveJobId(job.id);
      setTimeout(() => {
        setCopiedJobId(null);
        // Navigate to tailor with jobId so it auto-populates
        router.push(`/tailor?jobId=${job.id}`);
      }, 700);
    } catch {
      console.error("Clipboard write failed");
    }
  };

  const handleCreateJob = async () => {
    if (!newRawDescription.trim()) return;
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: newCompany.trim() || undefined,
          roleTitle: newRoleTitle.trim() || undefined,
          rawDescription: newRawDescription.trim(),
        }),
      });
      if (res.ok) {
        setShowAddModal(false);
        setNewCompany("");
        setNewRoleTitle("");
        setNewRawDescription("");
        fetchJobs();
      }
    } catch (err) {
      console.error("Failed to create job:", err);
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
        setImportNotice(`Imported ${json.createdCount} new jobs (${json.skippedCount} existing skipped).`);
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
            j.id === jobId ? { ...j, status: newStatus, appliedAt: json.data.appliedAt } : j
          )
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
      }
    } catch {
      console.error("Failed to delete job");
    }
  };

  const [isFetchingTier2, setIsFetchingTier2] = useState<Record<string, boolean>>({});
  const [tier2Notice, setTier2Notice] = useState<Record<string, string>>({});

  const handleFetchFullText = async (jobId: string) => {
    setIsFetchingTier2((p) => ({ ...p, [jobId]: true }));
    setTier2Notice((p) => ({ ...p, [jobId]: "" }));

    try {
      const res = await fetch(`/api/jobs/${jobId}/fetch-fulltext`, { method: "POST" });
      const json = await res.json();
      if (res.ok && json.success && json.data) {
        setJobs((prev) =>
          prev.map((j) => (j.id === jobId ? { ...j, rawDescription: json.data.rawDescription } : j))
        );
        setTier2Notice((p) => ({
          ...p,
          [jobId]: json.cached ? "Loaded full description from cache." : "Successfully extracted full job description!",
        }));
      } else {
        setTier2Notice((p) => ({
          ...p,
          [jobId]: json.error || "Couldn't extract automatically. Click Tailor Resume to paste manually.",
        }));
      }
    } catch {
      setTier2Notice((p) => ({ ...p, [jobId]: "Network error fetching full description." }));
    } finally {
      setIsFetchingTier2((p) => ({ ...p, [jobId]: false }));
    }
  };

  // Apply page-level status filter (for sub-routes /applied and /saved)
  const effectiveStatuses = filterStatuses ?? ALL_STATUSES;

  const filteredJobs = filterByPostedWithin(
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
  );

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <AppShell variant="tracker">
      <TrackerSubNav
        actions={
          <TrackerRefreshButton
            onClick={handleRefreshFromSource}
            isImporting={isImporting}
          />
        }
      />

      {importNotice && (
        <div
          data-testid="import-status-notice"
          className="bg-amber-950/80 border-b border-amber-800/80 px-4 py-2 text-xs text-amber-200 text-center font-medium"
        >
          {importNotice}
        </div>
      )}

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6 flex gap-6">
        {/* Left sidebar: search + filters */}
        <aside className="w-64 shrink-0 hidden lg:flex flex-col gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search company, role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500/60 transition"
            />
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
            <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-3">
              Posted
            </h3>
            {(
              [
                ["all", "Any time"],
                ["1d", "Last 24h"],
                ["3d", "Last 3 days"],
                ["7d", "Last 7 days"],
                ["30d", "Last 30 days"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setPostedWithin(value)}
                data-testid={`tracker-posted-${value}`}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  postedWithin === value
                    ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Status filter */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
            <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-3">
              Filter by Status
            </h3>
            <button
              type="button"
              onClick={() => setStatusFilter("ALL")}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === "ALL"
                  ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              }`}
            >
              All Statuses
            </button>
            {effectiveStatuses.map((s) => {
              const cfg = STATUS_CONFIG[s];
              const Icon = cfg.icon;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition-colors ${
                    statusFilter === s
                      ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                      : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {cfg.label}
                  <span className="ml-auto text-[10px] text-slate-500">
                    {jobs.filter((j) => j.status === s).length}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Quick stats */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
            <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-3">
              Pipeline
            </h3>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Total tracked</span>
              <span className="text-slate-200 font-medium">{jobs.length}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Applied</span>
              <span className="text-amber-400 font-medium">
                {jobs.filter((j) => j.status === "APPLIED" || j.status === "INTERVIEWING" || j.status === "OFFER").length}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Interviewing</span>
              <span className="text-emerald-400 font-medium">
                {jobs.filter((j) => j.status === "INTERVIEWING").length}
              </span>
            </div>
          </div>
        </aside>

        {/* Main job feed */}
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          {/* Mobile search */}
          <div className="relative lg:hidden">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500/60 transition"
            />
          </div>

          {/* Results count */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">
              {isLoading ? "Loading..." : `${filteredJobs.length} job${filteredJobs.length !== 1 ? "s" : ""}`}
            </p>
            <Link
              href="/tailor"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold rounded-lg transition shadow shadow-amber-500/20"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Job
            </Link>
          </div>

          {isLoading && (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-28 w-full rounded-xl bg-slate-900" />
              ))}
            </div>
          )}

          {!isLoading && filteredJobs.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
              <Briefcase className="h-12 w-12 text-slate-700" />
              <div>
                <p className="text-slate-400 font-medium">No jobs found</p>
                <p className="text-slate-600 text-sm mt-1">
                  {searchQuery
                    ? "Try adjusting your search query."
                    : "Go to the Tailor workspace to paste a job posting."}
                </p>
              </div>
              <Link
                href="/tailor"
                className="mt-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold rounded-lg transition"
              >
                Add Your First Job
              </Link>
            </div>
          )}

          {!isLoading &&
            filteredJobs.map((job) => {
              const isActive = job.id === activeJobId;
              const isExpanded = job.id === expandedJobId;
              const isCopied = job.id === copiedJobId;
              const cfg = STATUS_CONFIG[job.status];
              const StatusIcon = cfg.icon;
              const isPlaceholder = isPlaceholderDescription(job.rawDescription);
              const excerpt = job.rawDescription.slice(0, 180).trim();
              const skills = job.extractedRequirements.requiredSkills.slice(0, 5);

              const location = extractLocationFromNotes(job.notes);
              const applyUrl = extractApplyUrlFromNotes(job.notes);
              const datePosted = extractPostingDateFromNotes(job.notes);
              const salary = extractSalaryFromNotes(job.notes);
              const companyInitial = job.company ? job.company[0].toUpperCase() : "J";

              const handleCardClick = () => {
                if (applyUrl) {
                  window.open(applyUrl, "_blank", "noopener,noreferrer");
                } else {
                  handleSelectJob(job.id);
                }
              };

              return (
                <div
                  key={job.id}
                  ref={isActive ? activeCardRef : undefined}
                  data-testid={`tracker-job-card-${job.id}`}
                  className={`group bg-slate-900 border rounded-xl transition-all duration-150 cursor-pointer ${
                    isActive
                      ? "border-amber-500/50 shadow-lg shadow-amber-500/5"
                      : "border-slate-800 hover:border-slate-700"
                  }`}
                  onClick={handleCardClick}
                >
                  {/* Card header */}
                  <div className="p-4 flex items-start gap-4">
                    {/* Company logo placeholder */}
                    <div className="shrink-0 h-11 w-11 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-amber-400 text-base shadow-sm">
                      {companyInitial}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 group-hover:text-amber-400 transition">
                            <h3 className="font-semibold text-white group-hover:text-amber-300 text-sm leading-snug">
                              {job.roleTitle || "Untitled Role"}
                            </h3>
                            {applyUrl && (
                              <span title="Open original job posting in new tab" className="shrink-0 flex items-center">
                                <ExternalLink className="h-3.5 w-3.5 text-amber-400/80 group-hover:text-amber-300 transition" />
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5 font-medium">
                            {job.company || "Unknown Company"}
                          </p>
                        </div>
                        {/* Status badge */}
                        <span
                          className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${cfg.color} ${cfg.bg} ${cfg.border}`}
                        >
                          <StatusIcon className="h-3 w-3" />
                          {cfg.label}
                        </span>
                      </div>

                      {/* Location, Date, Salary Badges */}
                      <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-slate-400">
                        {location && (
                          <span className="flex items-center gap-1 text-slate-300 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/80">
                            <MapPin className="h-3 w-3 text-amber-400" />
                            {location}
                          </span>
                        )}
                        <span className="flex items-center gap-1 text-slate-400">
                          <Calendar className="h-3 w-3 text-slate-500" />
                          {datePosted ? `${datePosted} ago` : formatDate(job.createdAt)}
                        </span>
                        {salary ? (
                          <span className="text-emerald-400 border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 rounded font-semibold">
                            {salary}
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[10px] italic">No salary listed</span>
                        )}
                        {job.appliedAt && (
                          <span className="flex items-center gap-1 text-amber-400/80 font-medium">
                            <CheckCircle2 className="h-3 w-3" />
                            Applied {formatDate(job.appliedAt)}
                          </span>
                        )}
                      </div>

                      {/* Excerpt or Placeholder Badge & Pull Full Text Action */}
                      <div className="mt-2.5">
                        {isPlaceholder ? (
                          <div className="space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-slate-950 text-amber-300/90 border border-slate-800">
                                <Clock className="h-3 w-3 text-amber-400 shrink-0" />
                                Full description not yet imported (Tier 1)
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleFetchFullText(job.id);
                                }}
                                disabled={isFetchingTier2[job.id]}
                                data-testid={`fetch-fulltext-btn-${job.id}`}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30 transition disabled:opacity-50"
                              >
                                {isFetchingTier2[job.id] ? (
                                  <>
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    Pulling Full Description...
                                  </>
                                ) : (
                                  <>
                                    <DownloadCloud className="h-3 w-3" />
                                    Pull Full Description
                                  </>
                                )}
                              </button>
                            </div>
                            {tier2Notice[job.id] && (
                              <p className="text-[11px] text-amber-300/90 italic font-mono">
                                {tier2Notice[job.id]}
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                            {excerpt}
                            {job.rawDescription.length > 180 && "…"}
                          </p>
                        )}
                      </div>

                      {/* Linked Artifact Badges (Variants & Cover Letters) */}
                      {((job.variants && job.variants.length > 0) || (job.coverLetters && job.coverLetters.length > 0)) && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {job.variants && job.variants.length > 0 && (
                            <span
                              data-testid={`variant-badge-${job.id}`}
                              className="text-[10px] font-medium bg-amber-950/60 text-amber-300 border border-amber-800/60 px-2 py-0.5 rounded flex items-center gap-1"
                            >
                              <Sparkles className="h-3 w-3 text-amber-400" />
                              {job.variants.length} Variant Draft
                            </span>
                          )}
                          {job.coverLetters && job.coverLetters.length > 0 && (
                            <span
                              data-testid={`cover-letter-badge-${job.id}`}
                              className="text-[10px] font-medium bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 px-2 py-0.5 rounded flex items-center gap-1"
                            >
                              <FileText className="h-3 w-3 text-emerald-400" />
                              Cover Letter Draft
                            </span>
                          )}
                        </div>
                      )}

                      {/* Skill tags */}
                      {skills.length > 0 && (
                        <div className="mt-2.5 flex flex-wrap gap-1">
                          {skills.map((s) => (
                            <span
                              key={s}
                              className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400 border border-slate-700"
                            >
                              {s}
                            </span>
                          ))}
                          {job.extractedRequirements.requiredSkills.length > 5 && (
                            <span className="px-2 py-0.5 rounded text-[10px] text-slate-500">
                              +{job.extractedRequirements.requiredSkills.length - 5} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action bar — always visible with event propagation stopped */}
                  <div
                    className="border-t border-slate-800 px-4 py-2.5 flex flex-wrap items-center gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Open Original Posting */}
                    {applyUrl && applyUrl.startsWith("http") ? (
                      <a
                        href={applyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        data-testid={`open-original-btn-${job.id}`}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
                      >
                        <ExternalLink className="h-3.5 w-3.5 text-amber-400" />
                        Open Posting
                      </a>
                    ) : (
                      <button
                        type="button"
                        disabled
                        data-testid={`open-original-btn-disabled-${job.id}`}
                        title="No external apply link available for this job posting"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900 text-slate-600 border border-slate-800 opacity-60 cursor-not-allowed"
                      >
                        <ExternalLink className="h-3.5 w-3.5 text-slate-600" />
                        No Apply Link
                      </button>
                    )}

                    {/* Open in Tailor */}
                    <Link
                      href={`/tailor?jobId=${job.id}`}
                      data-testid={`tailor-resume-btn-${job.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        sessionStorage.setItem("resumeforge_active_job_id", job.id);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 transition"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Tailor Resume
                    </Link>

                    {/* Generate / Open Cover Letter */}
                    {job.coverLetters && job.coverLetters.length > 0 ? (
                      <Link
                        href={`/tailor?jobId=${job.id}&tab=cover-letter`}
                        data-testid={`open-cover-letter-btn-${job.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          sessionStorage.setItem("resumeforge_active_job_id", job.id);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition"
                      >
                        <FileText className="h-3.5 w-3.5 text-emerald-400" />
                        Open Cover Letter
                      </Link>
                    ) : (
                      <Link
                        href={`/tailor?jobId=${job.id}&tab=cover-letter`}
                        data-testid={`generate-cover-letter-btn-${job.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          sessionStorage.setItem("resumeforge_active_job_id", job.id);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
                      >
                        <FileText className="h-3.5 w-3.5 text-amber-400" />
                        Generate Cover Letter
                      </Link>
                    )}

                    {/* Status dropdown */}
                    <div className="relative ml-auto flex items-center gap-1">
                      {isUpdatingStatus[job.id] ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-500" />
                      ) : (
                        <select
                          value={job.status}
                          data-testid={`job-status-select-${job.id}`}
                          onChange={(e) => handleStatusChange(job.id, e.target.value as JobStatus)}
                          className="appearance-none bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-lg px-2.5 py-1.5 pr-6 focus:outline-none focus:border-amber-500/60 transition cursor-pointer"
                        >
                          {ALL_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {STATUS_CONFIG[s].label}
                            </option>
                          ))}
                        </select>
                      )}

                      {/* Expand notes */}
                      <button
                        type="button"
                        data-testid={`notes-toggle-btn-${job.id}`}
                        onClick={() => setExpandedJobId(isExpanded ? null : job.id)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 transition"
                        title="Notes"
                      >
                        <FileText className="h-3.5 w-3.5" />
                      </button>

                      {/* Delete */}
                      <button
                        type="button"
                        data-testid={`delete-job-btn-${job.id}`}
                        onClick={() => handleDeleteJob(job.id)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-900/40 border border-slate-700 hover:border-red-800/60 text-slate-500 hover:text-red-400 transition"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Inline notes editor */}
                  {isExpanded && (
                    <div
                      className="border-t border-slate-800 p-4 space-y-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        Notes
                      </label>
                      <textarea
                        rows={4}
                        data-testid={`notes-textarea-${job.id}`}
                        value={editingNotes[job.id] ?? ""}
                        onChange={(e) =>
                          setEditingNotes((prev) => ({ ...prev, [job.id]: e.target.value }))
                        }
                        placeholder="Interview notes, contacts, next steps..."
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500/60 resize-none font-mono"
                      />
                      <button
                        type="button"
                        data-testid={`notes-save-btn-${job.id}`}
                        onClick={() => handleSaveNotes(job.id)}
                        disabled={isSavingNotes[job.id]}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 text-xs font-medium rounded-lg border border-amber-500/20 transition disabled:opacity-50"
                      >
                        {isSavingNotes[job.id] ? (
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
            })}
        </div>
      </main>
    </AppShell>
  );
}
