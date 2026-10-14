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

export function OutcomesPanel() {
  const [guest, setGuest] = useState(false);
  const [data, setData] = useState<OutcomePayload | null>(null);

  useEffect(() => {
    void fetch("/api/stats/outcomes")
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          setGuest(Boolean(json.guest));
          setData(json.data);
        }
      });
  }, []);

  const max = data ? Math.max(1, ...FUNNEL.map((key) => data.funnel[key] ?? 0)) : 1;
  const totalTracked = data ? FUNNEL.reduce((sum, key) => sum + (data.funnel[key] ?? 0), 0) : 0;

  return (
    <AppShell variant="tracker">
      <TrackerSubNav />
      <div className="mx-auto w-full max-w-4xl space-y-6 p-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Pipeline outcomes</h2>
          <p className="text-xs text-slate-400">Counts are yours only. Shared job listings stay SAVED for everyone else.</p>
        </div>

        {guest && (
          <p className="rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-300">
            <Link href="/login" className="text-amber-400 underline">Sign in</Link> to see which resume variants get interviews.
          </p>
        )}

        {!guest && data && totalTracked === 0 && (
          <p className="rounded-lg border border-slate-800 px-4 py-3 text-sm text-slate-400">No applications yet. Mark a job Applied in the tracker.</p>
        )}

        {data && totalTracked > 0 && (
          <>
            <section className="space-y-2" data-testid="outcome-funnel">
              {FUNNEL.map((status) => {
                const count = data.funnel[status] ?? 0;
                return (
                  <div key={status} className="grid grid-cols-[8rem_1fr_2rem] items-center gap-2 text-xs">
                    <span className="text-slate-300">{status}</span>
                    <div className="h-2 rounded bg-slate-800">
                      <div className="h-2 rounded bg-amber-500" style={{ width: `${(count / max) * 100}%` }} />
                    </div>
                    <span className="text-right font-mono text-slate-200">{count}</span>
                  </div>
                );
              })}
              <p className="pt-2 text-xs text-slate-400">
                Interview rate {(data.interviewRate * 100).toFixed(0)}%
                {data.medianResponseDays !== null
                  ? ` · median ${data.medianResponseDays.toFixed(1)} days to a response`
                  : ""}
              </p>
            </section>

            <section className="overflow-x-auto" data-testid="outcome-variants">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="text-slate-500">
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
                    <tr key={row.variantId ?? "none"} className="border-t border-slate-800">
                      <td className="py-2 pr-3">{row.variantTitle}</td>
                      <td className="py-2 pr-3">{[row.roleTitle, row.company].filter(Boolean).join(" · ") || "—"}</td>
                      <td className="py-2 pr-3">{row.applications}</td>
                      <td className="py-2 pr-3">{row.interviews}</td>
                      <td className="py-2">{(row.interviewRate * 100).toFixed(0)}%</td>
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
