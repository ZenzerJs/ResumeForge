"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { Briefcase, Sparkles } from "lucide-react";
import { ALL_QUESTIONS, COMPANY_LOGOS } from "@/lib/interview/questionDatabase";
import { AppShell } from "@/components/design-system/app-shell";
import { PageHeader } from "@/components/design-system/page-header";
import { BrandIcon, hasBrandIcon } from "@/components/design-system/brand-icon";
import { InterviewHub } from "@/components/interview/interview-hub";
import { extractLocationFromNotes } from "@/lib/ingestion/helpers";
import {
  buildTrackerDisambiguators,
  collapseDuplicateTrackerJobs,
} from "@/lib/jobs/posting-identity";
import { cn } from "@/lib/utils";

const DsaWorkspace = dynamic(
  () => import("@/components/interview/dsa-workspace").then((m) => m.DsaWorkspace),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-1 items-center justify-center p-8 text-xs font-mono text-muted-foreground">
        Loading DSA runner…
      </div>
    ),
  }
);

export interface TrackedJobOption {
  id: string;
  company: string;
  roleTitle: string;
  status?: string;
  rawDescription?: string;
  notes?: string | null;
  source?: string | null;
  appliedAt?: string | null;
  appliedVariantId?: string | null;
  variants?: Array<{ id: string; variantTitle: string }>;
  createdAt?: string;
}

export function resolvePracticeJobSelection(
  jobs: TrackedJobOption[],
  params: { jobId?: string | null; company?: string | null; role?: string | null }
): { jobs: TrackedJobOption[]; selectedJobId: string } {
  const paramJobId = params.jobId?.trim() || "";
  const paramCompany = params.company?.trim() || "";
  const paramRole = params.role?.trim() || "";

  let deduped = collapseDuplicateTrackerJobs(jobs);
  if (paramJobId) {
    const exact = jobs.find((j) => j.id === paramJobId);
    if (exact && !deduped.some((j) => j.id === paramJobId)) {
      deduped = [exact, ...deduped];
    }
    if (deduped.some((j) => j.id === paramJobId)) {
      return { jobs: deduped, selectedJobId: paramJobId };
    }
    if (paramCompany || paramRole) {
      const synthetic: TrackedJobOption = {
        id: paramJobId,
        company: paramCompany || "Target Company",
        roleTitle: paramRole || "Target Role",
      };
      return { jobs: [synthetic, ...deduped], selectedJobId: paramJobId };
    }
    return { jobs: deduped, selectedJobId: "" };
  }

  if (paramCompany) {
    const normCompany = paramCompany.toLowerCase();
    if (paramRole) {
      const normRole = paramRole.toLowerCase();
      const matched = deduped.find(
        (j) =>
          j.company.toLowerCase() === normCompany &&
          j.roleTitle.toLowerCase() === normRole
      );
      return { jobs: deduped, selectedJobId: matched?.id ?? "" };
    }
    const matched = deduped.find((j) => j.company.toLowerCase() === normCompany);
    return { jobs: deduped, selectedJobId: matched?.id ?? "" };
  }

  return { jobs: deduped, selectedJobId: "" };
}

export function formatPracticeJobOptionLabel(
  job: TrackedJobOption,
  disambiguator?: string
): string {
  const loc = extractLocationFromNotes(job.notes || "");
  const suffixParts = [loc, disambiguator].filter(Boolean);
  const base = `${job.company} — ${job.roleTitle}`;
  return suffixParts.length > 0 ? `${base} (${suffixParts.join(" · ")})` : base;
}

export function describePracticeQuestionScope(
  job: { company: string; roleTitle: string } | null
): {
  kind: "company" | "general";
  count: number;
  companyName: string | null;
  message: string;
} {
  if (!job) {
    return {
      kind: "general",
      count: ALL_QUESTIONS.length,
      companyName: null,
      message: `Showing general question bank (${ALL_QUESTIONS.length} questions).`,
    };
  }
  const norm = job.company.trim().toLowerCase();
  const matchedCompany = norm
    ? COMPANY_LOGOS.find(
        (c) =>
          c.slug.toLowerCase() === norm ||
          c.name.toLowerCase() === norm ||
          norm.includes(c.slug.toLowerCase()) ||
          norm.includes(c.name.toLowerCase())
      )
    : undefined;
  const companyCount = matchedCompany
    ? ALL_QUESTIONS.filter((q) => q.companyTags.includes(matchedCompany.slug)).length
    : 0;

  if (matchedCompany && companyCount > 0) {
    return {
      kind: "company",
      count: companyCount,
      companyName: matchedCompany.name,
      message: `Showing ${companyCount} ${matchedCompany.name}-tagged questions (company-wide bank; general across ${matchedCompany.name} roles, not tailored to ${job.roleTitle}).`,
    };
  }

  return {
    kind: "general",
    count: ALL_QUESTIONS.length,
    companyName: null,
    message: `Showing general question bank (${ALL_QUESTIONS.length} questions) — no role- or company-specific question set is on file for ${job.roleTitle} at ${job.company}.`,
  };
}

export function formatPracticeQuestionCountLabel(
  filteredCount: number,
  totalCount: number
): string {
  return filteredCount === totalCount
    ? `${totalCount} questions`
    : `${filteredCount} of ${totalCount} questions`;
}

export function PracticeWorkspace() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const paramJobId = searchParams.get("jobId");
  const paramCompany = searchParams.get("company");
  const paramRole = searchParams.get("role");
  const initialTab = searchParams.get("tab") === "runner" || searchParams.get("problem") || searchParams.get("slug")
    ? "runner"
    : "questions";
  const [mainTab, setMainTab] = useState<"questions" | "runner">(initialTab);
  const [trackedJobs, setTrackedJobs] = useState<TrackedJobOption[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>("");

  const handleFilteredCountChange = useCallback((_filteredCount: number) => {}, []);

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
        const res = await fetch("/api/jobs?scope=tracked");
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
      if (paramJobId && !loaded.some((j) => j.id === paramJobId)) {
        try {
          const jobRes = await fetch(`/api/jobs/${encodeURIComponent(paramJobId)}`);
          if (jobRes.ok) {
            const jobJson = await jobRes.json();
            if (jobJson?.success && jobJson.data && typeof jobJson.data.id === "string") {
              loaded.push(jobJson.data);
            }
          }
        } catch {
          // Fallback handled by resolvePracticeJobSelection
        }
      }
      if (!cancelled) {
        const resolved = resolvePracticeJobSelection(loaded, {
          jobId: paramJobId,
          company: paramCompany,
          role: paramRole,
        });
        setTrackedJobs(resolved.jobs);
        setSelectedJobId(resolved.selectedJobId);
      }
    }
    void loadJobs();
    return () => {
      cancelled = true;
    };
  }, [paramJobId, paramCompany, paramRole]);

  const disambiguators = useMemo(() => buildTrackerDisambiguators(trackedJobs), [trackedJobs]);
  const selectedJob = trackedJobs.find((j) => j.id === selectedJobId) || null;
  const questionScope = useMemo(() => describePracticeQuestionScope(selectedJob), [selectedJob]);

  const handleSelectJobChange = (nextJobId: string) => {
    setSelectedJobId(nextJobId);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("company");
    params.delete("role");
    if (nextJobId) {
      params.set("jobId", nextJobId);
    } else {
      params.delete("jobId");
    }
    const qs = params.toString();
    router.replace(qs ? `/practice?${qs}` : "/practice", { scroll: false });
  };

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
    <AppShell variant="quiet" layout={mainTab === "runner" ? "workspace" : "page"}>
      <div className="flex min-h-0 flex-1 flex-col text-rf-cloud">
        {mainTab === "questions" ? (
          <div className="mx-auto w-full max-w-6xl px-4 pt-6 md:px-8 space-y-4">
            <PageHeader
              title="Interview Prep"
              description="Core algorithmic patterns, system design, and online assessments. Open a problem in the code runner when you want to write it."
            />

            {/* Contextual Tracked Job Selector */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl surface-raised px-4 py-3">
              <div className="flex items-center gap-2.5">
                <Briefcase className="h-4 w-4 text-primary shrink-0" />
                <div>
                  <label
                    htmlFor="practice-job-context-select"
                    className="block text-xs font-semibold text-foreground"
                  >
                    Target Role Context
                  </label>
                  <p className="text-sm text-text-secondary">
                    Select a tracked job to focus interview questions and behavioral rubrics on your target role.
                  </p>
                </div>
              </div>
              <select
                id="practice-job-context-select"
                data-testid="practice-job-context-select"
                value={selectedJobId}
                onChange={(e) => handleSelectJobChange(e.target.value)}
                className="min-h-11 sm:h-9 w-full sm:w-auto sm:min-w-[220px] max-w-full rounded-[6px] border border-control/70 bg-inset px-3 text-base sm:text-xs text-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <option value="">General Prep (All Roles)</option>
                {trackedJobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {formatPracticeJobOptionLabel(job, disambiguators.get(job.id))}
                  </option>
                ))}
              </select>
            </div>

            {selectedJob && (
              <div
                data-testid="practice-target-job-banner"
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/35 bg-primary/10 px-4 py-3 text-xs"
              >
                <div className="flex items-start gap-2 text-foreground min-w-0">
                  <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <div className="space-y-0.5 min-w-0">
                    <span className="inline-flex flex-wrap items-center gap-1.5">
                      <span>
                        Prepping for <strong className="font-semibold text-foreground">{selectedJob.roleTitle}</strong> at
                      </span>
                      <strong className="inline-flex items-center gap-1 font-semibold text-foreground">
                        {hasBrandIcon(selectedJob.company) && (
                          <BrandIcon name={selectedJob.company} className="h-3.5 w-3.5 shrink-0 text-primary" />
                        )}
                        {selectedJob.company}
                      </strong>
                    </span>
                    <p
                      data-testid="practice-question-scope-notice"
                      className="text-xs text-text-secondary"
                    >
                      {questionScope.message}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => openTab("runner")}
                    className="inline-flex min-h-11 sm:min-h-0 items-center rounded-md border border-primary/35 bg-primary/15 px-3 py-1.5 sm:px-2.5 sm:py-1 text-xs sm:text-xs font-semibold text-primary hover:bg-primary/25"
                  >
                    Open Code Runner &rarr;
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : null}

        <div className="border-b border-hairline mt-2">
        <div
          role="tablist"
          aria-label="Practice workspace views"
          onKeyDown={(event) => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
            const tabs = Array.from(
              event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')
            );
            const current = tabs.indexOf(document.activeElement as HTMLButtonElement);
            if (current < 0 || tabs.length === 0) return;
            const next =
              event.key === "Home"
                ? 0
                : event.key === "End"
                ? tabs.length - 1
                : (current + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
            event.preventDefault();
            tabs[next]?.focus();
            tabs[next]?.click();
          }}
          className={cn(
            "flex items-center gap-4 sm:gap-6 px-4 md:px-8 overflow-x-auto scrollbar-none",
            mainTab === "questions" && "mx-auto w-full max-w-6xl"
          )}
          data-testid="practice-main-tabs"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mainTab === "questions"}
            tabIndex={mainTab === "questions" ? 0 : -1}
            onClick={() => openTab("questions")}
            data-testid="tab-technical-questions"
            className={cn(
              "min-h-11 shrink-0 whitespace-nowrap border-b-2 px-1 text-xs font-medium",
              mainTab === "questions"
                ? "border-primary text-foreground"
                : "border-transparent text-text-secondary hover:text-foreground"
            )}
          >
            Questions
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mainTab === "runner"}
            tabIndex={mainTab === "runner" ? 0 : -1}
            onClick={() => openTab("runner")}
            data-testid="tab-code-runner"
            className={cn(
              "min-h-11 shrink-0 whitespace-nowrap border-b-2 px-1 text-xs font-medium",
              mainTab === "runner"
                ? "border-primary text-foreground"
                : "border-transparent text-text-secondary hover:text-foreground"
            )}
          >
            Code Runner
          </button>
          {mainTab === "runner" && selectedJob && (
            <span
              data-testid="practice-runner-job-pill"
              className="ml-auto shrink-0 inline-flex items-center gap-1.5 rounded-full border border-primary/35 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-foreground max-w-[260px]"
              title={`Prepping: ${selectedJob.roleTitle} · ${selectedJob.company}`}
            >
              <Briefcase className="h-3 w-3 text-primary shrink-0" aria-hidden />
              <span className="truncate">
                Prepping: {selectedJob.roleTitle} · {selectedJob.company}
              </span>
            </span>
          )}
        </div>
        </div>

        {mainTab === "questions" ? (
          <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8">
            <InterviewHub
              targetCompany={selectedJob?.company}
              onFilteredCountChange={handleFilteredCountChange}
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
