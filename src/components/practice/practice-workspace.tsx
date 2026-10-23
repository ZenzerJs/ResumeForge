"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Briefcase, Sparkles } from "lucide-react";
import { ALL_QUESTIONS } from "@/lib/interview/questionDatabase";
import { AppShell } from "@/components/design-system/app-shell";
import { PageHeader } from "@/components/design-system/page-header";
import { StatusPill } from "@/components/design-system/status-pill";
import { InterviewHub } from "@/components/interview/interview-hub";
import { DsaWorkspace } from "@/components/interview/dsa-workspace";
import { cn } from "@/lib/utils";

interface TrackedJobOption {
  id: string;
  company: string;
  roleTitle: string;
  status?: string;
  rawDescription?: string;
}

export function PracticeWorkspace() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialTab = searchParams.get("tab") === "runner" || searchParams.get("problem") || searchParams.get("slug")
    ? "runner"
    : "questions";
  const [mainTab, setMainTab] = useState<"questions" | "runner">(initialTab);
  const [trackedJobs, setTrackedJobs] = useState<TrackedJobOption[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>("");

  useEffect(() => {
    const tab = searchParams.get("tab");
    const slug = searchParams.get("problem") || searchParams.get("slug");
    if (tab === "runner" || slug) setMainTab("runner");
    else if (tab === "questions") setMainTab("questions");
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    async function loadJobs() {
      let loaded: TrackedJobOption[] = [];
      try {
        const res = await fetch("/api/jobs");
        if (res.ok) {
          const data = await res.json();
          const apiJobs = Array.isArray(data?.data)
            ? data.data
            : Array.isArray(data?.jobs)
              ? data.jobs
              : [];
          if (apiJobs.length > 0) {
            loaded = apiJobs;
          }
        }
      } catch {
        // Fallback to localStorage
      }
      try {
        const guestJobsRaw = localStorage.getItem("resumeforge_guest_jobs");
        if (guestJobsRaw) {
          const parsed = JSON.parse(guestJobsRaw);
          if (Array.isArray(parsed)) {
            const existingIds = new Set(loaded.map((j) => j.id));
            for (const g of parsed) {
              if (g && typeof g.id === "string" && !existingIds.has(g.id)) {
                loaded.push(g);
              }
            }
          }
        }
      } catch {
        // Ignore parse error
      }
      if (!cancelled && loaded.length > 0) {
        setTrackedJobs(loaded);
        const paramJobId = searchParams.get("jobId");
        const paramCompany = searchParams.get("company");
        const paramRole = searchParams.get("role");
        if (paramJobId && loaded.some((j) => j.id === paramJobId)) {
          setSelectedJobId(paramJobId);
        } else if (paramCompany) {
          const matched = loaded.find(
            (j) =>
              j.company.toLowerCase() === paramCompany.toLowerCase() &&
              (!paramRole || j.roleTitle.toLowerCase() === paramRole.toLowerCase())
          ) || loaded.find((j) => j.company.toLowerCase() === paramCompany.toLowerCase());
          if (matched) {
            setSelectedJobId(matched.id);
          }
        }
      }
    }
    loadJobs();
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  const selectedJob = trackedJobs.find((j) => j.id === selectedJobId) || null;

  const openTab = (tab: "questions" | "runner") => {
    setMainTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    if (tab === "questions") {
      params.delete("problem");
      params.delete("slug");
    }
    router.push(`/practice?${params.toString()}`);
  };

  return (
    <AppShell variant={mainTab === "runner" ? "editor" : "quiet"}>
      <div className="flex min-h-0 flex-1 flex-col bg-rf-bg text-rf-cloud">
        {mainTab === "questions" ? (
          <div className="mx-auto w-full max-w-6xl px-4 pt-6 md:px-8 space-y-4">
            <PageHeader
              eyebrow="Technical interview"
              title="Interview Prep"
              description="NeetCode-style questions, system design, and online assessments. Open a problem in the code runner when you want to write it."
              statusBadge={<StatusPill status="slate" label={`${ALL_QUESTIONS.length} questions`} />}
            />

            {/* Contextual Tracked Job Selector */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-800/80 bg-[#121929]/80 px-4 py-3">
              <div className="flex items-center gap-2.5">
                <Briefcase className="h-4 w-4 text-amber-400 shrink-0" />
                <div>
                  <label
                    htmlFor="practice-job-context-select"
                    className="block text-xs font-semibold text-slate-200"
                  >
                    Target Role Context
                  </label>
                  <p className="text-[11px] text-slate-400">
                    Select a tracked job to focus interview questions and behavioral rubrics on your target role.
                  </p>
                </div>
              </div>
              <select
                id="practice-job-context-select"
                data-testid="practice-job-context-select"
                value={selectedJobId}
                onChange={(e) => setSelectedJobId(e.target.value)}
                className="h-9 min-w-[220px] rounded-lg border border-slate-700 bg-slate-900 px-3 text-xs text-slate-200 focus:border-amber-500 focus:outline-none"
              >
                <option value="">General Prep (All Roles)</option>
                {trackedJobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.company} — {job.roleTitle}
                  </option>
                ))}
              </select>
            </div>

            {selectedJob && (
              <div
                data-testid="practice-target-job-banner"
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs"
              >
                <div className="flex items-center gap-2 text-amber-200">
                  <Sparkles className="h-4 w-4 text-amber-400 shrink-0" />
                  <span>
                    Prepping for <strong className="font-semibold text-white">{selectedJob.roleTitle}</strong> at{" "}
                    <strong className="font-semibold text-white">{selectedJob.company}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openTab("runner")}
                    className="rounded-md border border-amber-500/40 bg-amber-500/20 px-2.5 py-1 text-[11px] font-semibold text-amber-200 hover:bg-amber-500/30"
                  >
                    Open Code Runner &rarr;
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : null}

        <div className="border-b border-slate-800 mt-2">
        <div
          className={cn(
            "flex items-center gap-6 px-4 md:px-8",
            mainTab === "questions" && "mx-auto w-full max-w-6xl"
          )}
          data-testid="practice-main-tabs"
        >
          <button
            type="button"
            onClick={() => openTab("questions")}
            data-testid="tab-technical-questions"
            className={cn(
              "min-h-11 border-b-2 px-1 text-xs font-medium",
              mainTab === "questions"
                ? "border-amber-500 text-white"
                : "border-transparent text-slate-400 hover:text-slate-200"
            )}
          >
            Questions
          </button>
          <button
            type="button"
            onClick={() => openTab("runner")}
            data-testid="tab-code-runner"
            className={cn(
              "min-h-11 border-b-2 px-1 text-xs font-medium",
              mainTab === "runner"
                ? "border-amber-500 text-white"
                : "border-transparent text-slate-400 hover:text-slate-200"
            )}
          >
            Code Runner
          </button>
        </div>
        </div>

        {mainTab === "questions" ? (
          <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8">
            <InterviewHub
              targetCompany={selectedJob?.company}
              onSolveInRunner={(slug) => {
                const params = new URLSearchParams(searchParams.toString());
                params.set("tab", "runner");
                params.set("problem", slug);
                setMainTab("runner");
                router.push(`/practice?${params.toString()}`);
              }}
            />
          </div>
        ) : (
          <DsaWorkspace embedded />
        )}
      </div>
    </AppShell>
  );
}
