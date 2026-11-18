"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/design-system/app-shell";
import { TrackerSubNav } from "@/components/tracker/tracker-sub-nav";
import { fetchDemoConfig } from "@/components/auth/session-user";

export interface OutcomePayload {
  funnel: Record<string, number>;
  interviewRate: number;
  medianResponseDays: number | null;
  variants: Array<{
    variantId: string | null;
    variantTitle: string;
    company: string | null;
    roleTitle: string | null;
    applications: number;
    interviews: number;
    offers: number;
    interviewRate: number;
  }>;
}

const FUNNEL = ["SAVED", "APPLIED", "INTERVIEWING", "OFFER", "REJECTED"] as const;

export function computeLocalOutcomePayload(
  jobs: Array<{ status?: string | null }>
): OutcomePayload {
  const funnel: Record<string, number> = {
    SAVED: 0,
    APPLIED: 0,
    INTERVIEWING: 0,
    OFFER: 0,
    REJECTED: 0,
  };
  for (const job of jobs) {
    const status = (job.status || "SAVED").toUpperCase();
    if (status in funnel) {
      funnel[status] += 1;
    }
  }
  const appliedTotal =
    funnel.APPLIED + funnel.INTERVIEWING + funnel.OFFER + funnel.REJECTED;
  const interviewsTotal = funnel.INTERVIEWING + funnel.OFFER;
  return {
    funnel,
    interviewRate: appliedTotal > 0 ? interviewsTotal / appliedTotal : 0,
    medianResponseDays: null,
    variants: [],
  };
}

const STAGE_TOP_RULE: Record<(typeof FUNNEL)[number], string> = {
  SAVED: "border-t-2 border-t-text-muted/70",
  APPLIED: "border-t-2 border-t-ember",
  INTERVIEWING: "border-t-2 border-t-signal",
  OFFER: "border-t-2 border-t-primary",
  REJECTED: "border-t-2 border-t-status-danger",
};

export function OutcomesPanel() {
  const [guest, setGuest] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [data, setData] = useState<OutcomePayload | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([
      fetch("/api/stats/outcomes", { signal: controller.signal }).then((res) =>
        res.json()
      ),
      fetchDemoConfig().catch(() => ({ demoMode: false })),
    ])
      .then(([json, demoConfig]) => {
        if (controller.signal.aborted) return;
        const isDemo = Boolean(demoConfig?.demoMode);
        setDemoMode(isDemo);
        if (json?.success) {
          const isGuest = Boolean(json.guest);
          setGuest(isGuest);
          if (isGuest) {
            let localJobs: Array<{ status?: string | null }> = [];
            try {
              const raw = localStorage.getItem("resumeforge_guest_jobs");
              const parsed = raw ? JSON.parse(raw) : [];
              if (Array.isArray(parsed)) localJobs = parsed;
            } catch {
              localJobs = [];
            }
            setData(computeLocalOutcomePayload(localJobs));
          } else {
            setData(json.data);
          }
        }
      })
      .catch(() => {
        // Non-blocking: leave empty state on network or abort errors
      });
    return () => controller.abort();
  }, []);

  const max = data ? Math.max(1, ...FUNNEL.map((key) => data.funnel[key] ?? 0)) : 1;
  const totalTracked = data ? FUNNEL.reduce((sum, key) => sum + (data.funnel[key] ?? 0), 0) : 0;

  return (
    <AppShell variant="tracker" layout="page">
      <TrackerSubNav />
      <div className="mx-auto w-full max-w-4xl space-y-6 p-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Pipeline outcomes</h2>
          <p className="text-sm text-muted-foreground">Counts are yours only. Shared job listings stay SAVED for everyone else.</p>
        </div>

        {guest && demoMode && (
          <div
            data-testid="outcomes-demo-mode-notice"
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg surface-raised px-4 py-3 text-sm text-text-secondary"
          >
            <span>
              Public demo mode: pipeline stage counts reflect jobs saved in this browser. Account-backed variant interview rates and response-time analytics require a self-hosted account (public signup is disabled in the demo).
            </span>
            <Link
              href="/tracker"
              className="shrink-0 font-semibold text-primary underline underline-offset-2"
            >
              Open Job Tracker
            </Link>
          </div>
        )}

        {guest && !demoMode && (
          <div
            data-testid="outcomes-guest-mode-notice"
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg surface-raised px-4 py-3 text-sm text-text-secondary"
          >
            <span>
              Guest session: pipeline stage counts reflect jobs saved in this browser.{" "}
              <Link href="/login" className="font-semibold text-primary underline underline-offset-2">
                Sign in
              </Link>{" "}
              to see which resume variants get interviews.
            </span>
            <Link
              href="/tracker"
              className="shrink-0 font-semibold text-primary underline underline-offset-2"
            >
              Open Job Tracker
            </Link>
          </div>
        )}

        {data && totalTracked === 0 && (
          <p className="rounded-lg surface-raised px-4 py-3 text-sm text-muted-foreground">No applications yet. Mark a job Applied in the tracker.</p>
        )}

        {data && totalTracked > 0 && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5" data-testid="outcome-stage-tiles">
              {FUNNEL.map((status) => {
                const count = data.funnel[status] ?? 0;
                return (
                  <div
                    key={status}
                    className={`rounded-xl surface-raised ${STAGE_TOP_RULE[status]} p-3.5`}
                  >
                    <div className="font-mono text-xs font-semibold uppercase tracking-wider text-text-secondary">
                      {status}
                    </div>
                    <div className="mt-1 text-2xl font-bold tabular-nums text-foreground">
                      {count}
                    </div>
                  </div>
                );
              })}
            </div>

            <section className="space-y-2 rounded-xl surface-raised p-5" data-testid="outcome-funnel">
              {FUNNEL.map((status) => {
                const count = data.funnel[status] ?? 0;
                return (
                  <div key={status} className="grid grid-cols-[6.5rem_1fr_2rem] sm:grid-cols-[8rem_1fr_2rem] items-center gap-2 text-xs">
                    <span className="truncate text-text-secondary">{status}</span>
                    <div className="h-2 rounded bg-elevated">
                      <div className="h-2 rounded bg-primary" style={{ width: `${(count / max) * 100}%` }} />
                    </div>
                    <span className="text-right font-mono tabular-nums text-foreground">{count}</span>
                  </div>
                );
              })}
              <p className="pt-2 text-xs tabular-nums text-muted-foreground">
                Interview rate {(data.interviewRate * 100).toFixed(0)}%
                {data.medianResponseDays !== null
                  ? ` · median ${data.medianResponseDays.toFixed(1)} days to a response`
                  : ""}
              </p>
            </section>

            {(!guest || data.variants.length > 0) && (
              <section className="overflow-x-auto rounded-xl surface-raised p-4" data-testid="outcome-variants">
                <table className="w-full min-w-[460px] text-left text-xs text-on-surface-variant">
                  <thead className="text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-3 whitespace-nowrap">Variant</th>
                      <th className="py-2 pr-3 whitespace-nowrap">Job</th>
                      <th className="py-2 pr-3 whitespace-nowrap">Sent</th>
                      <th className="py-2 pr-3 whitespace-nowrap">Interviews</th>
                      <th className="py-2 whitespace-nowrap">Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.variants.map((row) => (
                      <tr key={row.variantId ?? "none"} className="border-t border-border">
                        <td className="py-2 pr-3">{row.variantTitle}</td>
                        <td className="py-2 pr-3">{[row.roleTitle, row.company].filter(Boolean).join(" · ") || "—"}</td>
                        <td className="py-2 pr-3 tabular-nums">{row.applications}</td>
                        <td className="py-2 pr-3 tabular-nums">{row.interviews}</td>
                        <td className="py-2 tabular-nums">{(row.interviewRate * 100).toFixed(0)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
