"use client";

import React from "react";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
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
    status: "drawback" | "warning";
  };
  teal: {
    title: string;
    summary: string;
    status: "drawback" | "warning";
  };
  simplify: {
    title: string;
    summary: string;
    status: "drawback" | "warning";
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
      title: "Black-Box LLM Rewrites",
      summary:
        "Opaque generative prompts that freely invent metrics, unverified tool experience, and phantom job responsibilities to inflate scores.",
      status: "drawback",
    },
    teal: {
      title: "Ungrounded Prompting",
      summary:
        "Basic OpenAI completion wrappers without a candidate evidence repository or citation verification pipeline.",
      status: "drawback",
    },
    simplify: {
      title: "Generic Bullet Rephraser",
      summary:
        "Standard synonym substitutions without semantic verification or evidence anchoring.",
      status: "warning",
    },
  },
  {
    moat: "Cost & Quotas",
    category: "Pricing Ergonomics",
    icon: Zap,
    resumeForge: {
      title: "100% Free & Local-First",
      summary:
        "Zero subscription fees. Unmetered tailors, searches, and PDF exports forever. Optional BYOK (Bring Your Own Key) for custom models.",
      status: "winner",
    },
    competitors: {
      title: "$39.99/mo + 4 Quota Pools",
      summary:
        "Aggressive daily quotas split into 4 metered credit pools (Search, Tailor, Apply, Auto-apply) designed to force expensive tier upgrades.",
      status: "drawback",
    },
    teal: {
      title: "$29/mo Teal+ Feature Gating",
      summary:
        "Core ATS analysis, unlimited keyword checks, and template exports locked behind a recurring weekly or monthly paywall.",
      status: "drawback",
    },
    simplify: {
      title: "$20/mo Premium / Daily Limits",
      summary:
        "Free tier throttled with artificial daily submission caps to convert job seekers into recurring subscribers.",
      status: "warning",
    },
  },
  {
    moat: "Data Privacy & Ownership",
    category: "Architecture Invariants",
    icon: Lock,
    resumeForge: {
      title: "100% Local Invariant (Zero Egress)",
      summary:
        "Your resume data, application history, and career evidence stay on your local disk. Zero telemetry, zero server-side storage, zero data monetization.",
      status: "winner",
    },
    competitors: {
      title: "Monetized Recruiter Talent Pool",
      summary:
        "Terms permit candidate profiles and resume data to be indexed and resold to enterprise recruiters via search portals.",
      status: "drawback",
    },
    teal: {
      title: "Centralized Cloud Storage",
      summary:
        "All candidate resumes, work history, and job search targets reside in a centralized cloud database used for platform analytics.",
      status: "warning",
    },
    simplify: {
      title: "Extension Scraping & Central Sync",
      summary:
        "Browser extension captures and exfiltrates candidate form inputs and job application URLs to centralized servers.",
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
      title: "Generic HTML-to-PDF Printing",
      summary:
        "Headless Chromium PDF printing prone to awkward line breaks, orphan headings, and multi-page spillover.",
      status: "drawback",
    },
    teal: {
      title: "Web DOM to PDF Converter",
      summary:
        "Standard CSS print stylesheets with rudimentary font embedding and limited typographic control.",
      status: "warning",
    },
    simplify: {
      title: "Plaintext & Basic HTML Export",
      summary:
        "Basic HTML-formatted text with minimal design options, geared toward autofill copy-paste rather than publication-grade PDFs.",
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
      title: "Opaque LLM Heuristics",
      summary:
        "Unpredictable 0-100 match score derived from non-deterministic LLM temperature with zero visible calculation steps.",
      status: "drawback",
    },
    teal: {
      title: "Naive Keyword Density Counter",
      summary:
        "Simple keyword frequency counter vulnerable to keyword stuffing. Ignores seniority gap deductions and framework relationships.",
      status: "warning",
    },
    simplify: {
      title: "Raw String Matching",
      summary:
        "Literal string matching without tech alias graph (fails to recognize that React implies JavaScript or FastAPI implies Python).",
      status: "drawback",
    },
  },
];

export function CompetitiveMatrixSection() {
  return (
    <section
      data-testid="competitive-matrix-section"
      className="py-20 px-4 md:px-8 max-w-7xl mx-auto w-full border-t border-slate-800/80"
    >
      <div className="mb-14 text-center max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[#ff8c00]/40 bg-[#ff8c00]/10 text-[#ff8c00] text-xs font-mono mb-4">
          <ShieldCheck className="h-4 w-4" />
          <span>ARCHITECTURAL BENCHMARK</span>
        </div>
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-white tracking-tight mb-4">
          The Engineering Wedge: Why ResumeForge
        </h2>
        <p className="text-slate-300 text-sm md:text-base lg:text-lg leading-relaxed">
          Engineers don’t trust black-box LLM hallucinations or predatory credit meters.
          Compare our deterministic, local-first architecture against competitors and similar products.
        </p>
      </div>

      {/* Comparison Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-[#060e20]/90 shadow-2xl backdrop-blur-md">
        <table className="w-full text-left border-collapse min-w-[920px]">
          <thead>
            <tr className="border-b border-slate-800 bg-[#0a1224]">
              <th className="p-4 md:p-5 text-xs md:text-sm font-mono uppercase tracking-wider text-slate-300 w-[22%]">
                Architectural Moat
              </th>
              <th className="p-4 md:p-5 text-xs md:text-sm font-mono uppercase tracking-wider text-amber-400 bg-amber-500/10 border-x border-amber-500/30 w-[30%]">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>ResumeForge (Local)</span>
                </div>
              </th>
              <th className="p-4 md:p-5 text-xs md:text-sm font-mono uppercase tracking-wider text-slate-300 w-[16%]">
                Competitors
              </th>
              <th className="p-4 md:p-5 text-xs md:text-sm font-mono uppercase tracking-wider text-slate-300 w-[16%]">
                Teal
              </th>
              <th className="p-4 md:p-5 text-xs md:text-sm font-mono uppercase tracking-wider text-slate-300 w-[16%]">
                Simplify
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-sans">
            {MATRIX_DATA.map((row, idx) => {
              const IconComp = row.icon;
              return (
                <tr
                  key={row.moat}
                  className={idx % 2 === 0 ? "bg-transparent" : "bg-slate-900/30"}
                >
                  {/* Category / Moat Column */}
                  <td className="p-4 md:p-5 align-top">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-slate-800 text-amber-400 shrink-0 mt-0.5">
                        <IconComp className="h-4 w-4" />
                      </div>
                      <div>
                        <span className="font-bold text-sm md:text-base text-white block">
                          {row.moat}
                        </span>
                        <span className="font-mono text-xs text-slate-400 block mt-1">
                          {row.category}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* ResumeForge (Winner) Column */}
                  <td className="p-4 md:p-5 align-top bg-amber-500/[0.04] border-x border-amber-500/30 shadow-[inset_0_0_15px_rgba(255,140,0,0.03)]">
                    <div className="flex items-start gap-2.5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold text-sm md:text-base text-emerald-300 mb-1.5">
                          {row.resumeForge.title}
                        </div>
                        <p className="text-slate-300 leading-relaxed text-xs md:text-sm">
                          {row.resumeForge.summary}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Competitors Column */}
                  <td className="p-4 md:p-5 align-top text-slate-300">
                    <div className="flex items-start gap-2">
                      <XCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold text-xs md:text-sm text-rose-300 mb-1.5">
                          {row.competitors.title}
                        </div>
                        <p className="text-slate-300 leading-relaxed text-xs md:text-sm">
                          {row.competitors.summary}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Teal Column */}
                  <td className="p-4 md:p-5 align-top text-slate-300">
                    <div className="flex items-start gap-2">
                      {row.teal.status === "drawback" ? (
                        <XCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <div className="font-semibold text-xs md:text-sm text-slate-100 mb-1.5">
                          {row.teal.title}
                        </div>
                        <p className="text-slate-300 leading-relaxed text-xs md:text-sm">
                          {row.teal.summary}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Simplify Column */}
                  <td className="p-4 md:p-5 align-top text-slate-300">
                    <div className="flex items-start gap-2">
                      {row.simplify.status === "drawback" ? (
                        <XCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <div className="font-semibold text-xs md:text-sm text-slate-100 mb-1.5">
                          {row.simplify.title}
                        </div>
                        <p className="text-slate-300 leading-relaxed text-xs md:text-sm">
                          {row.simplify.summary}
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
      <div className="mt-6 p-4 md:p-5 rounded-xl border border-slate-800 bg-[#060e20] flex flex-col md:flex-row items-center justify-between gap-4 text-xs md:text-sm font-sans">
        <div className="flex items-center gap-2.5 text-slate-300">
          <Lock className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>
            Candidate Data Invariant: No tracking cookies, no external resume transmission, 100% client-side verification.
          </span>
        </div>
        <div className="text-slate-400 font-mono text-xs shrink-0">
          Source code open &amp; auditable
        </div>
      </div>
    </section>
  );
}
