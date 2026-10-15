"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ALL_QUESTIONS } from "@/lib/interview/questionDatabase";
import { AppShell } from "@/components/design-system/app-shell";
import { PageHeader } from "@/components/design-system/page-header";
import { StatusPill } from "@/components/design-system/status-pill";
import { InterviewHub } from "@/components/interview/interview-hub";
import { DsaWorkspace } from "@/components/interview/dsa-workspace";
import { cn } from "@/lib/utils";

export function PracticeWorkspace() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialTab = searchParams.get("tab") === "runner" || searchParams.get("problem") || searchParams.get("slug")
    ? "runner"
    : "questions";
  const [mainTab, setMainTab] = useState<"questions" | "runner">(initialTab);

  useEffect(() => {
    const tab = searchParams.get("tab");
    const slug = searchParams.get("problem") || searchParams.get("slug");
    if (tab === "runner" || slug) setMainTab("runner");
    else if (tab === "questions") setMainTab("questions");
  }, [searchParams]);

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
          <div className="mx-auto w-full max-w-6xl px-4 pt-6 md:px-8">
            <PageHeader
              eyebrow="Technical interview"
              title="Interview Prep"
              description="NeetCode-style questions, system design, and online assessments. Open a problem in the code runner when you want to write it."
              statusBadge={<StatusPill status="slate" label={`${ALL_QUESTIONS.length} questions`} />}
            />
          </div>
        ) : null}

        <div className="border-b border-slate-800">
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
