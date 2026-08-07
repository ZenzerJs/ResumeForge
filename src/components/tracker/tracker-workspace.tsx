"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Kanban,
  List,
  Plus,
  Search,
  BookOpen,
  Settings,
  Sparkles,
  ArrowRight,
  Calendar,
  FileText,
  Building2,
  CheckCircle2,
  Clock,
  Briefcase,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Save,
  Loader2,
  Trash2,
  MessageSquare,
} from "lucide-react";
import { JobStatus } from "@/lib/db/jobs";
import { TopNav } from "@/components/navigation/top-nav";
import { Skeleton } from "@/components/ui/skeleton";

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

const STATUS_COLUMNS: { key: JobStatus; label: string; color: string; badgeBg: string; border: string }[] = [
  { key: "SAVED", label: "Saved", color: "text-slate-400", badgeBg: "bg-slate-800 text-slate-300", border: "border-slate-800" },
  { key: "APPLIED", label: "Applied", color: "text-blue-400", badgeBg: "bg-blue-950 text-blue-300 border-blue-800", border: "border-blue-900/50" },
  { key: "INTERVIEWING", label: "Interviewing", color: "text-amber-400", badgeBg: "bg-amber-950 text-amber-300 border-amber-800", border: "border-amber-900/50" },
  { key: "OFFER", label: "Offer Received", color: "text-emerald-400", badgeBg: "bg-emerald-950 text-emerald-300 border-emerald-800", border: "border-emerald-900/50" },
  { key: "REJECTED", label: "Rejected", color: "text-rose-400", badgeBg: "bg-rose-950 text-rose-300 border-rose-800", border: "border-rose-900/50" },
  { key: "ARCHIVED", label: "Archived", color: "text-slate-500", badgeBg: "bg-slate-900 text-slate-500 border-slate-800", border: "border-slate-900" },
];

export function TrackerWorkspace() {
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [expandedNotesId, setExpandedNotesId] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<{ [key: string]: string }>({});
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<{ [key: string]: boolean }>({});
  const [isSavingNotes, setIsSavingNotes] = useState<{ [key: string]: boolean }>({});

  const fetchJobs = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/jobs");
      const json = await res.json();
      if (res.ok && json.success) {
        setJobs(json.data);
        const notesMap: { [key: string]: string } = {};
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

  const handleStatusChange = async (jobId: string, newStatus: JobStatus) => {
    try {
      setIsUpdatingStatus((prev) => ({ ...prev, [jobId]: true }));
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setJobs((prev) =>
          prev.map((j) => (j.id === jobId ? { ...j, ...json.data } : j))
        );
      }
    } catch (err) {
      console.error("Failed to update job status:", err);
    } finally {
      setIsUpdatingStatus((prev) => ({ ...prev, [jobId]: false }));
    }
  };

  const handleNotesSave = async (jobId: string, customNoteText?: string) => {
    try {
      setIsSavingNotes((prev) => ({ ...prev, [jobId]: true }));
      const noteText =
        customNoteText !== undefined
          ? customNoteText
          : (editingNotes[jobId] !== undefined
            ? editingNotes[jobId]
            : (jobs.find((j) => j.id === jobId)?.notes || ""));

      const res = await fetch(`/api/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: noteText }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setJobs((prev) =>
          prev.map((j) => (j.id === jobId ? { ...j, ...json.data } : j))
        );
      }
    } catch (err) {
      console.error("Failed to save notes:", err);
    } finally {
      setIsSavingNotes((prev) => ({ ...prev, [jobId]: false }));
    }
  };

  const filteredJobs = jobs.filter((job) => {
    const matchesStatus = statusFilter === "ALL" || job.status === statusFilter;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      (job.company && job.company.toLowerCase().includes(q)) ||
      (job.roleTitle && job.roleTitle.toLowerCase().includes(q)) ||
      job.rawDescription.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const getMetrics = () => {
    const total = jobs.length;
    const saved = jobs.filter((j) => j.status === "SAVED").length;
    const applied = jobs.filter((j) => j.status === "APPLIED").length;
    const interviewing = jobs.filter((j) => j.status === "INTERVIEWING").length;
    const offer = jobs.filter((j) => j.status === "OFFER").length;
    const rejected = jobs.filter((j) => j.status === "REJECTED").length;
    return { total, saved, applied, interviewing, offer, rejected };
  };

  const metrics = getMetrics();

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden text-slate-100 font-sans" style={{ backgroundColor: "#0A0E17" }}>
      {/* Shared Top Navigation */}
      <TopNav
        actions={
          <Link
            href="/tailor"
            className="inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors"
            style={{ background: "linear-gradient(135deg, #F59E0B, #D97706)", color: "#0A0E17" }}
          >
            <Plus className="h-3.5 w-3.5" />
            Tailor New Job
          </Link>
        }
      />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Metric Bar & Toolbar */}
        <div className="border-b p-4 md:px-6" style={{ borderColor: "#1E2536", backgroundColor: "rgba(17,22,34,0.8)" }}>
          {/* Page Label */}
          <h1 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
            <Briefcase className="h-4 w-4 text-indigo-400" />
            Application Tracker
          </h1>
          {/* Top Metrics Cards */}
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <div className="rounded-lg border p-3" style={{ borderColor: "#1E2536", backgroundColor: "#111622" }}>
              <span className="text-[11px] font-mono font-medium text-slate-500">Total</span>
              <p className="mt-1 text-2xl font-bold text-white">{metrics.total}</p>
            </div>
            <div className="rounded-lg border p-3" style={{ borderColor: "#1E2536", backgroundColor: "#111622" }}>
              <span className="text-[11px] font-mono font-medium text-slate-500">Saved</span>
              <p className="mt-1 text-2xl font-bold text-slate-300">{metrics.saved}</p>
            </div>
            <div className="rounded-lg border border-blue-900/40 bg-blue-950/20 p-3">
              <span className="text-[11px] font-mono font-medium text-blue-400">Applied</span>
              <p className="mt-1 text-2xl font-bold text-blue-300">{metrics.applied}</p>
            </div>
            <div className="rounded-lg border border-amber-900/40 bg-amber-950/20 p-3">
              <span className="text-[11px] font-mono font-medium text-amber-400">Interviewing</span>
              <p className="mt-1 text-2xl font-bold text-amber-300">{metrics.interviewing}</p>
            </div>
            <div className="rounded-lg border border-emerald-900/40 bg-emerald-950/20 p-3">
              <span className="text-[11px] font-mono font-medium text-emerald-400">Offers</span>
              <p className="mt-1 text-2xl font-bold text-emerald-300">{metrics.offer}</p>
            </div>
            <div className="rounded-lg border border-rose-900/40 bg-rose-950/20 p-3">
              <span className="text-[11px] font-mono font-medium text-rose-400">Rejected</span>
              <p className="mt-1 text-2xl font-bold text-rose-300">{metrics.rejected}</p>
            </div>
          </div>

          {/* Filter & View Mode Switcher */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-1 items-center gap-3 min-w-[280px]">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search by company, role title, or tech stack..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-md border border-slate-700 bg-slate-950 pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-md border px-3 py-1.5 text-xs font-medium text-slate-300 focus:outline-none focus:border-amber-500/50"
                style={{ backgroundColor: "#0A0E17", borderColor: "#1E2536" }}
              >
                <option value="ALL">All Statuses</option>
                <option value="SAVED">Saved</option>
                <option value="APPLIED">Applied</option>
                <option value="INTERVIEWING">Interviewing</option>
                <option value="OFFER">Offer</option>
                <option value="REJECTED">Rejected</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 rounded-md border border-slate-800 bg-slate-950 p-1">
              <button
                type="button"
                onClick={() => setViewMode("kanban")}
                className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                  viewMode === "kanban"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Kanban className="h-3.5 w-3.5" />
                Kanban
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                  viewMode === "list"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <List className="h-3.5 w-3.5" />
                List
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic Display Area */}
        <div className="flex-1 overflow-x-auto overflow-y-auto p-4 md:p-6">
          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-6 min-w-[1200px]">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex flex-col rounded-xl border p-3 min-h-[300px]" style={{ borderColor: "#1E2536", backgroundColor: "rgba(17,22,34,0.6)" }}>
                  <Skeleton className="h-3 w-20 mb-4" />
                  <div className="flex flex-col gap-2">
                    <Skeleton className="h-20 w-full rounded-lg" />
                    <Skeleton className="h-16 w-full rounded-lg" />
                    <Skeleton className="h-14 w-full rounded-lg" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-800 bg-slate-900/30 p-8 text-center">
              <Briefcase className="h-10 w-10 text-slate-600" />
              <div>
                <h3 className="text-sm font-semibold text-slate-300">No applications found</h3>
                <p className="mt-1 text-xs text-slate-500 max-w-sm">
                  {jobs.length === 0
                    ? "You haven't tracked any job postings yet. Use the Tailor Engine to analyze a job description."
                    : "No job applications match your current search or status filter."}
                </p>
              </div>
              <Link
                href="/tailor"
                className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-indigo-500 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Start Tailoring a Job
              </Link>
            </div>
          ) : viewMode === "kanban" ? (
            /* Kanban Board View */
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-6 min-w-[1200px]">
              {STATUS_COLUMNS.map((col) => {
                const columnJobs = filteredJobs.filter((j) => j.status === col.key);
                return (
                  <div
                    key={col.key}
                    className={`flex flex-col rounded-xl border ${col.border} bg-slate-900/40 p-3 min-h-[500px]`}
                  >
                    {/* Column Header */}
                    <div className="mb-3 flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${col.badgeBg}`} />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                          {col.label}
                        </h4>
                      </div>
                      <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] font-mono text-slate-400">
                        {columnJobs.length}
                      </span>
                    </div>

                    {/* Column Job Cards */}
                    <div className="flex flex-1 flex-col gap-3">
                      {columnJobs.map((job) => (
                        <div
                          key={job.id}
                          data-testid={`job-card-${job.id}`}
                          className="group relative flex flex-col rounded-lg border border-slate-800 bg-slate-900/90 p-3.5 shadow-sm hover:border-slate-700 transition-all"
                        >
                          {/* Role & Company Header */}
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h5 className="text-sm font-semibold text-white tracking-tight leading-snug">
                                {job.roleTitle || "Untitled Role"}
                              </h5>
                              <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400">
                                <Building2 className="h-3 w-3 text-slate-500" />
                                <span>{job.company || "Unknown Company"}</span>
                              </div>
                            </div>

                            {/* Status Change Selector */}
                            <select
                              value={job.status}
                              disabled={isUpdatingStatus[job.id]}
                              data-testid={`job-status-select-${job.id}`}
                              onChange={(e) => handleStatusChange(job.id, e.target.value as JobStatus)}
                              className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] font-medium text-slate-300 focus:border-indigo-500 focus:outline-none"
                            >
                              <option value="SAVED">Saved</option>
                              <option value="APPLIED">Applied</option>
                              <option value="INTERVIEWING">Interviewing</option>
                              <option value="OFFER">Offer</option>
                              <option value="REJECTED">Rejected</option>
                              <option value="ARCHIVED">Archived</option>
                            </select>
                          </div>

                          {/* Date Badges */}
                          <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3 text-slate-500" />
                              Added {new Date(job.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                            </span>
                            {job.appliedAt && (
                              <span className="flex items-center gap-1 rounded bg-blue-950/80 px-1.5 py-0.5 font-medium text-blue-300 border border-blue-900/50">
                                <Clock className="h-3 w-3 text-blue-400" />
                                Applied {new Date(job.appliedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                              </span>
                            )}
                          </div>

                          {/* Extracted Requirements Preview */}
                          {job.extractedRequirements?.requiredSkills?.length > 0 && (
                            <div className="mt-2.5 flex flex-wrap gap-1">
                              {job.extractedRequirements.requiredSkills.slice(0, 3).map((skill, idx) => (
                                <span
                                  key={idx}
                                  className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300 font-mono"
                                >
                                  {skill}
                                </span>
                              ))}
                              {job.extractedRequirements.requiredSkills.length > 3 && (
                                <span className="text-[10px] text-slate-500 self-center">
                                  +{job.extractedRequirements.requiredSkills.length - 3} more
                                </span>
                              )}
                            </div>
                          )}

                          {/* Linked Artifacts Badges */}
                          <div className="mt-3 flex flex-col gap-1.5 border-t border-slate-800/60 pt-2.5">
                            {/* Resume Variants */}
                            {job.variants && job.variants.length > 0 ? (
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-[11px] text-slate-400">Tailored Variant:</span>
                                <Link
                                  href={`/editor?variantId=${job.variants[0].id}`}
                                  className="inline-flex items-center gap-1 text-[11px] font-medium text-cyan-400 hover:underline"
                                >
                                  <Sparkles className="h-3 w-3 text-cyan-400" />
                                  {job.variants[0].variantTitle}
                                </Link>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-[11px] text-slate-500">No Variant Drafted</span>
                                <Link
                                  href={`/tailor?jobId=${job.id}`}
                                  className="text-[11px] text-indigo-400 hover:underline"
                                >
                                  + Tailor Resume
                                </Link>
                              </div>
                            )}

                            {/* Cover Letters */}
                            {job.coverLetters && job.coverLetters.length > 0 && (
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-[11px] text-slate-400">Cover Letter:</span>
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400">
                                  <FileText className="h-3 w-3" />
                                  {job.coverLetters[0].title}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Notes Section Toggle & Editor */}
                          <div className="mt-3 border-t border-slate-800/60 pt-2">
                            <button
                              type="button"
                              data-testid={`notes-toggle-btn-${job.id}`}
                              onClick={() =>
                                setExpandedNotesId(expandedNotesId === job.id ? null : job.id)
                              }
                              className="flex items-center justify-between w-full text-[11px] font-medium text-slate-400 hover:text-slate-200 transition-colors"
                            >
                              <span className="flex items-center gap-1">
                                <MessageSquare className="h-3 w-3 text-slate-500" />
                                {job.notes ? "View/Edit Notes" : "+ Add Application Notes"}
                              </span>
                              {expandedNotesId === job.id ? (
                                <ChevronUp className="h-3 w-3" />
                              ) : (
                                <ChevronDown className="h-3 w-3" />
                              )}
                            </button>

                            {expandedNotesId === job.id && (
                              <div className="mt-2 space-y-2">
                                <textarea
                                  rows={3}
                                  data-testid={`notes-textarea-${job.id}`}
                                  value={editingNotes[job.id] !== undefined ? editingNotes[job.id] : (job.notes || "")}
                                  onChange={(e) =>
                                    setEditingNotes((prev) => ({ ...prev, [job.id]: e.target.value }))
                                  }
                                  placeholder="Write notes (e.g., referral contact, interview dates, questions asked)..."
                                  className="w-full rounded border border-slate-700 bg-slate-950 p-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                                />
                                <div className="flex justify-end">
                                  <button
                                    type="button"
                                    data-testid={`notes-save-btn-${job.id}`}
                                    onClick={(e) => {
                                      const parent = e.currentTarget.parentElement?.parentElement;
                                      const textarea = parent?.querySelector("textarea") as HTMLTextAreaElement;
                                      handleNotesSave(job.id, textarea ? textarea.value : editingNotes[job.id]);
                                    }}
                                    disabled={isSavingNotes[job.id]}
                                    className="inline-flex items-center gap-1 rounded bg-indigo-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-indigo-500 transition-colors"
                                  >
                                    {isSavingNotes[job.id] ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <Save className="h-3 w-3" />
                                    )}
                                    Save Notes
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Quick Action Button */}
                          <div className="mt-3">
                            <Link
                              href={`/tailor?jobId=${job.id}`}
                              className="flex items-center justify-center gap-1.5 w-full rounded-md border border-slate-700 bg-slate-800 py-1.5 text-xs font-medium text-slate-200 hover:border-slate-600 hover:bg-slate-700 transition-colors"
                            >
                              Open Tailor Engine
                              <ArrowRight className="h-3 w-3 text-slate-400" />
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* List View */
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="border-b border-slate-800 bg-slate-900 px-4 py-3 font-semibold uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Role & Company</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Date Added</th>
                    <th className="px-4 py-3">Applied Date</th>
                    <th className="px-4 py-3">Linked Tailored Variant</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredJobs.map((job) => (
                    <tr key={job.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-white">{job.roleTitle || "Untitled Role"}</div>
                        <div className="text-slate-400 flex items-center gap-1">
                          <Building2 className="h-3 w-3 text-slate-500" />
                          {job.company || "Unknown Company"}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={job.status}
                          disabled={isUpdatingStatus[job.id]}
                          onChange={(e) => handleStatusChange(job.id, e.target.value as JobStatus)}
                          className="rounded border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs font-medium text-slate-200 focus:border-indigo-500 focus:outline-none"
                        >
                          <option value="SAVED">Saved</option>
                          <option value="APPLIED">Applied</option>
                          <option value="INTERVIEWING">Interviewing</option>
                          <option value="OFFER">Offer</option>
                          <option value="REJECTED">Rejected</option>
                          <option value="ARCHIVED">Archived</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {new Date(job.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {job.appliedAt ? (
                          <span className="rounded bg-blue-950/80 px-2 py-0.5 font-medium text-blue-300 border border-blue-900/50">
                            {new Date(job.appliedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {job.variants && job.variants.length > 0 ? (
                          <Link
                            href={`/editor?variantId=${job.variants[0].id}`}
                            className="inline-flex items-center gap-1 font-medium text-cyan-400 hover:underline"
                          >
                            <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
                            {job.variants[0].variantTitle}
                          </Link>
                        ) : (
                          <span className="text-slate-500">None</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/tailor?jobId=${job.id}`}
                          className="inline-flex items-center gap-1 rounded bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-200 hover:bg-slate-700 transition-colors"
                        >
                          Tailor Engine
                          <ExternalLink className="h-3 w-3 text-slate-400" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
