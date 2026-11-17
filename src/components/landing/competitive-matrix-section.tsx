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
    area: "Data Privacy & Ownership",
    category: "Architecture Invariants",
    icon: Lock,
    title: "Browser Guest Mode + Hosted Postgres Sync",
    summary:
      "Guest drafts stay in browser localStorage until you sign in to persist in Postgres. BYOK API keys stay encrypted in IndexedDB and relay only to your chosen provider on AI actions.",
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

export function CompetitiveMatrixSection() {
  return (
    <section
      data-testid="competitive-matrix-section"
      className="py-20 px-4 md:px-8 max-w-7xl mx-auto w-full border-t border-outline/70"
    >
      <div className="mb-14 text-center max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-[6px] border border-outline/70 bg-panel text-primary text-xs font-mono mb-4">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
          <span>PRODUCT ARCHITECTURE</span>
        </div>
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground tracking-tight mb-4">
          How ResumeForge Is Built
        </h2>
        <p className="text-on-surface-variant text-sm md:text-base lg:text-lg leading-relaxed">
          Every tailored bullet is grounded in your Evidence Bank, scored with a
          transparent formula, and typeset client-side in Typst WASM.
        </p>
      </div>

      {/* Architecture Breakdown Table */}
      <div className="overflow-x-auto rounded-[10px] surface-raised edge-glow">
        <table className="w-full text-left border-collapse min-w-[560px]">
          <thead>
            <tr className="border-b border-outline/70 bg-inset">
              <th className="p-4 md:p-5 text-xs md:text-sm font-mono uppercase tracking-wider text-on-surface-variant w-[32%]">
                Capability
              </th>
              <th className="p-4 md:p-5 text-xs md:text-sm font-mono uppercase tracking-wider text-primary bg-primary/10 border-l border-primary/30 w-[68%]">
                ResumeForge (Guest / Postgres)
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline/60 font-sans">
            {MATRIX_DATA.map((row, idx) => {
              const IconComp = row.icon;
              return (
                <tr
                  key={row.area}
                  className={idx % 2 === 0 ? "bg-transparent" : "bg-inset/50"}
                >
                  {/* Capability Column */}
                  <td className="p-4 md:p-5 align-top">
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
                  </td>

                  {/* ResumeForge Column */}
                  <td className="p-4 md:p-5 align-top bg-primary/[0.04] border-l border-primary/25">
                    <div className="flex items-start gap-2.5">
                      <CheckCircle2 className="h-4 w-4 text-status-success shrink-0 mt-0.5" aria-hidden />
                      <div>
                        <div className="font-bold text-sm md:text-base text-status-success mb-1.5">
                          {row.title}
                        </div>
                        <p className="text-on-surface-variant leading-relaxed text-xs md:text-sm">
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

      {/* Trust Invariant Footer Banner */}
      <div className="mt-6 p-4 md:p-5 rounded-[10px] border border-outline/70 bg-panel flex items-center gap-2.5 text-on-surface-variant text-xs md:text-sm font-sans">
        <Lock className="h-4 w-4 text-status-success shrink-0" aria-hidden />
        <span>
          Data Architecture: Guest drafts stay in this browser; signed-in data persists in hosted Postgres; BYOK keys stay encrypted in IndexedDB and relay only to your chosen provider on AI actions.
        </span>
      </div>
    </section>
  );
}
