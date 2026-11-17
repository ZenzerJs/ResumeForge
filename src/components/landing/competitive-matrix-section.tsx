"use client";

import React from "react";
import {
  ShieldCheck,
  CheckCircle2,
  Zap,
  Lock,
  FileCode,
  Calculator,
} from "lucide-react";

interface MatrixRow {
  area: string;
  category: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  summary: string;
}

const MATRIX_DATA: MatrixRow[] = [
  {
    area: "Hallucination Prevention",
    category: "AI Safety & Grounding",
    icon: ShieldCheck,
    title: "Deterministic Evidence Bank",
    summary:
      "Every tailored bullet must cite verified atomic evidence IDs. Gaps are surfaced explicitly; the engine refuses to invent experience.",
  },
  {
    area: "Cost & Quotas",
    category: "Pricing Ergonomics",
    icon: Zap,
    title: "Unmetered Open Workspace",
    summary:
      "No subscription paywalls or artificial daily credit pools for Typst compilation, ATS checks, or PDF export. Connect your own BYOK model key when using AI actions.",
  },
  {
    area: "Document Quality & Layout",
    category: "Typesetting & Output",
    icon: FileCode,
    title: "Typst WASM Typesetting Engine",
    summary:
      "Client-side Typst WASM typesetting for crisp vector PDFs, consistent spacing, and single-page layout control.",
  },
  {
    area: "ATS Evaluation Engine",
    category: "Scoring Methodology",
    icon: Calculator,
    title: "Explainable Mathematical Formula",
    summary:
      "Deterministic composite formula: 50% Core Stack + 20% Seniority + 15% Tools + 15% Evidence Coverage. Step-by-step audit logs with framework aliasing.",
  },
];

export function CompetitiveMatrixSection({ demoMode }: { demoMode: boolean }) {
  const privacy: MatrixRow = {
    area: "Data Privacy & Ownership",
    category: "Storage",
    icon: Lock,
    title: demoMode ? "Browser storage in the public demo" : "Browser drafts and PostgreSQL accounts",
    summary: demoMode
      ? "Demo drafts stay in browser storage. Account signup is disabled."
      : "Guest drafts stay in browser storage. Signed-in users can save work in PostgreSQL.",
  };

  return (
    <section
      data-testid="competitive-matrix-section"
      className="w-full px-2 pb-8 pt-4 md:px-4"
    >
      <div
        tabIndex={0}
        role="region"
        aria-label="ResumeForge architecture table"
        className="overflow-x-auto rounded-[10px] border border-hairline bg-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <table className="w-full text-left border-collapse min-w-[560px]">
          <thead>
            <tr className="border-b border-outline/70 bg-inset">
              <th scope="col" className="p-4 md:p-5 text-xs md:text-sm font-mono uppercase tracking-wider text-on-surface-variant w-[32%]">
                Capability
              </th>
              <th scope="col" className="p-4 md:p-5 text-xs md:text-sm font-mono uppercase tracking-wider text-primary bg-primary/10 border-l border-primary/30 w-[68%]">
                ResumeForge
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline/60 font-sans">
            {[...MATRIX_DATA, privacy].map((row, idx) => {
              const IconComp = row.icon;
              return (
                <tr
                  key={row.area}
                  className={idx % 2 === 0 ? "bg-transparent" : "bg-inset/50"}
                >
                  {/* Capability Column */}
                  <th scope="row" className="p-4 font-normal md:p-5 align-top">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-[6px] bg-inset border border-outline/70 text-primary shrink-0 mt-0.5">
                        <IconComp className="h-4 w-4" aria-hidden />
                      </div>
                      <div>
                        <span className="font-bold text-sm md:text-base text-foreground block">
                          {row.area}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground block mt-1">
                          {row.category}
                        </span>
                      </div>
                    </div>
                  </th>

                  {/* ResumeForge Column */}
                  <td className="p-4 md:p-5 align-top bg-primary/[0.04] border-l border-primary/25">
                    <div className="flex items-start gap-2.5">
                      <CheckCircle2 className="h-4 w-4 text-status-success shrink-0 mt-0.5" aria-hidden />
                      <div>
                        <div className="font-bold text-sm md:text-base text-status-success mb-1.5">
                          {row.title}
                        </div>
                        <p className="text-on-surface-variant leading-relaxed text-sm">
                          {row.summary}
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-4 max-w-prose text-sm text-on-surface-variant">
        Provider keys are encrypted in IndexedDB when browser storage is available and kept in memory otherwise.
        They are used when you test the connection or request AI help.
      </p>
    </section>
  );
}
