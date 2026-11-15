"use client";

import React from "react";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Zap,
  Lock,
  FileCode,
  Calculator,
} from "lucide-react";

interface MatrixRow {
  moat: string;
  category: string;
  icon: React.ComponentType<{ className?: string }>;
  resumeForge: {
    title: string;
    summary: string;
    status: "winner";
  };
  competitors: {
    title: string;
    summary: string;
    status: "drawback";
  };
}

const MATRIX_DATA: MatrixRow[] = [
  {
    moat: "Hallucination Prevention",
    category: "AI Safety & Grounding",
    icon: ShieldCheck,
    resumeForge: {
      title: "Deterministic Evidence Bank",
      summary:
        "Every tailored bullet must cite verified atomic evidence IDs. Gaps are surfaced explicitly; the engine refuses to invent experience.",
      status: "winner",
    },
    competitors: {
      title: "Black-Box Rewrites & Rephrasing",
      summary:
        "Opaque generative prompts and synonym wrappers without a candidate evidence repository or citation verification pipeline—inviting fabricated metrics and unverified skills.",
      status: "drawback",
    },
  },
  {
    moat: "Cost & Quotas",
    category: "Pricing Ergonomics",
    icon: Zap,
    resumeForge: {
      title: "Unmetered Open Workspace",
      summary:
        "No subscription paywalls or artificial daily credit pools for Typst compilation, ATS checks, or PDF export. Connect your own BYOK model key when using AI actions.",
      status: "winner",
    },
    competitors: {
      title: "$20–$40/mo Paywalls & Daily Quotas",
      summary:
        "Core ATS analysis, unlimited keyword checks, and exports gated behind recurring subscriptions or split credit pools designed to force tier upgrades.",
      status: "drawback",
    },
  },
  {
    moat: "Data Privacy & Ownership",
    category: "Architecture Invariants",
    icon: Lock,
    resumeForge: {
      title: "Browser Guest Mode + Hosted Postgres Sync",
      summary:
        "Guest drafts stay in browser localStorage until you sign in to persist in Postgres. BYOK API keys stay encrypted in IndexedDB and relay only to your chosen provider on AI actions.",
      status: "winner",
    },
    competitors: {
      title: "Centralized Cloud & Telemetry Capture",
      summary:
        "Resumes, work history, and form inputs are synced to centralized servers or captured by browser extensions, with terms often permitting analytics or recruiter indexing.",
      status: "drawback",
    },
  },
  {
    moat: "Document Quality & Layout",
    category: "Typesetting & Output",
    icon: FileCode,
    resumeForge: {
      title: "Typst WASM Typesetting Engine",
      summary:
        "Sub-millimeter algorithmic typesetting running client-side. Strict single-page constraints, crisp vector rendering, and zero layout overflow.",
      status: "winner",
    },
    competitors: {
      title: "HTML-to-PDF & Basic Print Exports",
      summary:
        "Headless DOM/CSS print stylesheets and basic HTML builders prone to awkward line breaks, orphan headings, limited typographic control, and multi-page spillover.",
      status: "drawback",
    },
  },
  {
    moat: "ATS Evaluation Engine",
    category: "Scoring Methodology",
    icon: Calculator,
    resumeForge: {
      title: "Explainable Mathematical Formula",
      summary:
        "Deterministic composite formula: 50% Core Stack + 20% Seniority + 15% Tools + 15% Evidence Coverage. Step-by-step audit logs with framework aliasing.",
      status: "winner",
    },
    competitors: {
      title: "Opaque Heuristics & Raw String Matching",
      summary:
        "Unpredictable LLM scores or naive keyword density counters that miss tech aliases (e.g., React implies JavaScript) and ignore seniority gap deductions.",
      status: "drawback",
    },
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
          <span>ARCHITECTURAL BENCHMARK</span>
        </div>
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground tracking-tight mb-4">
          The Engineering Wedge: Why ResumeForge
        </h2>
        <p className="text-on-surface-variant text-sm md:text-base lg:text-lg leading-relaxed">
          Engineers don&apos;t trust black-box LLM hallucinations or predatory credit meters.
          Compare our deterministic, evidence-grounded architecture against competitors.
        </p>
      </div>

      {/* Comparison Table */}
      <div className="overflow-x-auto rounded-[10px] surface-raised edge-glow">
        <table className="w-full text-left border-collapse min-w-[680px]">
          <thead>
            <tr className="border-b border-outline/70 bg-inset">
              <th className="p-4 md:p-5 text-xs md:text-sm font-mono uppercase tracking-wider text-on-surface-variant w-[26%]">
                Architectural Moat
              </th>
              <th className="p-4 md:p-5 text-xs md:text-sm font-mono uppercase tracking-wider text-primary bg-primary/10 border-x border-primary/30 w-[38%]">
                ResumeForge (Guest / Postgres)
              </th>
              <th className="p-4 md:p-5 text-xs md:text-sm font-mono uppercase tracking-wider text-on-surface-variant w-[36%]">
                Competitors
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline/60 font-sans">
            {MATRIX_DATA.map((row, idx) => {
              const IconComp = row.icon;
              return (
                <tr
                  key={row.moat}
                  className={idx % 2 === 0 ? "bg-transparent" : "bg-inset/50"}
                >
                  {/* Category / Moat Column */}
                  <td className="p-4 md:p-5 align-top">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-[6px] bg-inset border border-outline/70 text-primary shrink-0 mt-0.5">
                        <IconComp className="h-4 w-4" aria-hidden />
                      </div>
                      <div>
                        <span className="font-bold text-sm md:text-base text-foreground block">
                          {row.moat}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground block mt-1">
                          {row.category}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* ResumeForge (Winner) Column */}
                  <td className="p-4 md:p-5 align-top bg-primary/[0.04] border-x border-primary/25">
                    <div className="flex items-start gap-2.5">
                      <CheckCircle2 className="h-4 w-4 text-status-success shrink-0 mt-0.5" aria-hidden />
                      <div>
                        <div className="font-bold text-sm md:text-base text-status-success mb-1.5">
                          {row.resumeForge.title}
                        </div>
                        <p className="text-on-surface-variant leading-relaxed text-xs md:text-sm">
                          {row.resumeForge.summary}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Competitors Column */}
                  <td className="p-4 md:p-5 align-top text-on-surface-variant">
                    <div className="flex items-start gap-2">
                      <XCircle className="h-4 w-4 text-status-danger shrink-0 mt-0.5" aria-hidden />
                      <div>
                        <div className="font-semibold text-xs md:text-sm text-status-danger mb-1.5">
                          {row.competitors.title}
                        </div>
                        <p className="text-on-surface-variant leading-relaxed text-xs md:text-sm">
                          {row.competitors.summary}
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
      <div className="mt-6 p-4 md:p-5 rounded-[10px] border border-outline/70 bg-panel flex flex-col md:flex-row items-center justify-between gap-4 text-xs md:text-sm font-sans">
        <div className="flex items-center gap-2.5 text-on-surface-variant">
          <Lock className="h-4 w-4 text-status-success shrink-0" aria-hidden />
          <span>
            Data Architecture: Guest drafts stay in this browser; signed-in data persists in hosted Postgres; BYOK keys stay encrypted in IndexedDB and relay only to your chosen provider on AI actions.
          </span>
        </div>
        <div className="text-muted-foreground font-mono text-xs shrink-0">
          Source code open &amp; auditable
        </div>
      </div>
    </section>
  );
}
