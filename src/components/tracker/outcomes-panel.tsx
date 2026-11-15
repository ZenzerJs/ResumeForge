"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/design-system/app-shell";
import { TrackerSubNav } from "@/components/tracker/tracker-sub-nav";

interface OutcomePayload {
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

const STAGE_TOP_RULE: Record<(typeof FUNNEL)[number], string> = {
  SAVED: "border-t-2 border-t-text-muted/70",
  APPLIED: "border-t-2 border-t-ember",
  INTERVIEWING: "border-t-2 border-t-signal",
  OFFER: "border-t-2 border-t-primary",
  REJECTED: "border-t-2 border-t-status-danger",
};

export function OutcomesPanel() {
  const [guest, setGuest] = useState(false);
  const [data, setData] = useState<OutcomePayload | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/stats/outcomes", { signal: controller.signal })
      .then((res) => res.json())
      .then((json) => {
        if (!controller.signal.aborted && json.success) {
          setGuest(Boolean(json.guest));
          setData(json.data);
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
          <p className="text-xs text-muted-foreground">Counts are yours only. Shared job listings stay SAVED for everyone else.</p>
        </div>

        {guest && (
          <p className="rounded-lg surface-raised px-4 py-3 text-sm text-text-secondary">
            <Link href="/login" className="text-primary underline">Sign in</Link> to see which resume variants get interviews.
          </p>
        )}

        {!guest && data && totalTracked === 0 && (
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
                    <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
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
                  <div key={status} className="grid grid-cols-[8rem_1fr_2rem] items-center gap-2 text-xs">
                    <span className="text-text-secondary">{status}</span>
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

            <section className="overflow-x-auto rounded-xl surface-raised p-4" data-testid="outcome-variants">
              <table className="w-full text-left text-xs text-on-surface-variant">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3">Variant</th>
                    <th className="py-2 pr-3">Job</th>
                    <th className="py-2 pr-3">Sent</th>
                    <th className="py-2 pr-3">Interviews</th>
                    <th className="py-2">Rate</th>
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
          </>
        )}
      </div>
    </AppShell>
  );
}
