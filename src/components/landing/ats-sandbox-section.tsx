"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  FileCode,
  Eye,
  Terminal,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Loader2,
  Cpu,
} from "lucide-react";
import {
  calculateMatchScore,
  CandidateEvidenceInput,
  JobRequirementInput,
} from "@/lib/matchScore";
import { parseJobDescription } from "@/lib/jd-parser/parser";
import { compileTypstToSvg } from "@/lib/typst/compiler";

interface PresetRole {
  id: string;
  name: string;
  roleTitle: string;
  company: string;
  job: JobRequirementInput;
  description: string;
  typstSnippet: string;
}

const SAMPLE_CANDIDATE: CandidateEvidenceInput = {
  skills: [
    "Go",
    "Python",
    "TypeScript",
    "React",
    "Next.js",
    "Docker",
    "PostgreSQL",
    "Kubernetes",
    "RESTful APIs",
    "Tailwind CSS",
  ],
  totalYoe: 6,
  evidenceItems: [
    {
      id: "evid-01",
      title: "Nova Distributed Microservices",
      tags: ["Go", "Python", "Docker", "PostgreSQL"],
      bullets: [
        {
          id: "b-1",
          text: "Engineered scalable Go microservices processing 12,000 req/sec with PostgreSQL persistence.",
          technologies: ["Go", "PostgreSQL", "RESTful APIs"],
        },
        {
          id: "b-2",
          text: "Automated containerized deployment pipelines using Docker and Kubernetes cluster nodes.",
          technologies: ["Docker", "Kubernetes", "Python"],
        },
      ],
    },
    {
      id: "evid-02",
      title: "WebCraft Enterprise Web Platform",
      tags: ["React", "TypeScript", "Next.js", "Tailwind CSS"],
      bullets: [
        {
          id: "b-3",
          text: "Architected high-performance Next.js and TypeScript frontend interfaces serving 1.5M monthly users.",
          technologies: ["React", "Next.js", "TypeScript", "Tailwind CSS"],
        },
      ],
    },
  ],
};

const PRESETS: PresetRole[] = [
  {
    id: "backend",
    name: "Senior Backend Engineer",
    roleTitle: "Senior Backend Engineer",
    company: "CloudScale Systems",
    job: {
      requiredSkills: ["Go", "Python", "PostgreSQL", "Docker"],
      tools: ["Kubernetes", "Redis"],
      requiredYoe: 5,
    },
    description: `Senior Backend Engineer — CloudScale Systems

We are seeking a Senior Backend Engineer to architect our core microservices and data pipelines.

Requirements:
- 5+ years building distributed backend services in Go or Python.
- Strong proficiency with PostgreSQL, transactional boundaries, and database query optimization.
- Hands-on experience containerizing services with Docker and deploying to Kubernetes.
- Experience building resilient, monitored RESTful APIs.

Tools & Infra:
- Docker, Kubernetes, Redis, Prometheus, Git.`,
    typstSnippet: `// Tailored Variant: Senior Backend Engineer
#let resume-section(title) = [ === #title ]
#resume-section("Core Skills")
Languages: Go, Python, TypeScript, SQL (PostgreSQL)
Infrastructure: Docker, Kubernetes, Redis, RESTful APIs

#resume-section("Experience")
*Senior Software Engineer* | Nova Labs (2022 - Present)
- Engineered scalable Go microservices processing 12,000 req/sec with PostgreSQL persistence.
- Automated containerized deployment pipelines using Docker and Kubernetes cluster nodes.
`,
  },
  {
    id: "frontend",
    name: "Staff Frontend Architect",
    roleTitle: "Staff Frontend Architect",
    company: "Veloce Web Technologies",
    job: {
      requiredSkills: ["TypeScript", "React", "Next.js", "Tailwind CSS"],
      tools: ["WebAssembly", "Docker"],
      requiredYoe: 6,
    },
    description: `Staff Frontend Architect — Veloce Web Technologies

Join our platform team to set frontend standards, component design systems, and client performance architecture.

Key Requirements:
- 6+ years of front-end engineering experience with modern web stacks.
- Deep expertise in React, Next.js App Router, TypeScript, and modern state machines.
- Advanced Tailwind CSS component development with accessible WAI-ARIA standards.
- Familiarity with WebAssembly (WASM) and browser-based edge compute.`,
    typstSnippet: `// Tailored Variant: Staff Frontend Architect
#let resume-section(title) = [ === #title ]
#resume-section("Skills")
Frontend: React, Next.js, TypeScript, Tailwind CSS, WebAssembly (WASM)
Tooling: Vitest, Playwright, Docker, Webpack, Turbopack

#resume-section("Experience")
*Frontend Systems Lead* | WebCraft Systems (2021 - Present)
- Architected high-performance Next.js and TypeScript frontend interfaces serving 1.5M monthly users.
- Reduced initial bundle payloads by 42% utilizing responsive component code splitting.
`,
  },
  {
    id: "ai-platform",
    name: "AI Platform Engineer",
    roleTitle: "AI Platform Engineer",
    company: "Aether AI Labs",
    job: {
      requiredSkills: ["Python", "Docker", "PyTorch", "Kubernetes"],
      tools: ["Go", "Triton"],
      requiredYoe: 4,
    },
    description: `AI Platform Engineer — Aether AI Labs

We are looking for an AI Platform Engineer to build scalable infrastructure for training and serving large language models.

Requirements:
- 4+ years software engineering experience with strong Python systems programming.
- Hands-on experience with PyTorch and distributed training frameworks.
- Deep container orchestration experience with Docker and Kubernetes GPU clusters.
- Familiarity with high-throughput model inference servers.`,
    typstSnippet: `// Tailored Variant: AI Platform Engineer
#let resume-section(title) = [ === #title ]
#resume-section("Technical Skills")
Languages: Python, Go, C++
AI/Infra: PyTorch, Docker, Kubernetes, Distributed Inference Systems

#resume-section("Experience")
*Infrastructure & Backend Engineer* | Nova Labs (2021 - Present)
- Designed automated distributed training pipeline jobs utilizing Python, Docker, and Kubernetes.
- Maintained low-latency inference endpoints with 99.98% operational uptime.
`,
  },
];

export function AtsSandboxSection() {
  const [selectedPresetId, setSelectedPresetId] = useState<string>("backend");
  const [activePreset, setActivePreset] = useState<PresetRole>(PRESETS[0]);
  const [customDescription, setCustomDescription] = useState<string>(PRESETS[0].description);
  const [previewTab, setPreviewTab] = useState<"svg" | "source">("svg");
  const [svgOutput, setSvgOutput] = useState<string | null>(null);
  const [isCompiling, setIsCompiling] = useState<boolean>(false);
  const [compileError, setCompileError] = useState<string | null>(null);
  const [showDerivationLog, setShowDerivationLog] = useState<boolean>(false);

  // Switch presets
  const handleSelectPreset = (preset: PresetRole) => {
    setSelectedPresetId(preset.id);
    setActivePreset(preset);
    setCustomDescription(preset.description);
  };

  // Compile Typst when preset changes with cancellation to prevent race conditions
  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    setIsCompiling(true);
    setCompileError(null);

    compileTypstToSvg(activePreset.typstSnippet)
      .then((result) => {
        if (cancelled) return;
        if (result.success) {
          setSvgOutput(result.svg);
        } else {
          setCompileError(result.error?.message || "Typst compilation failed");
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        setCompileError(msg);
      })
      .finally(() => {
        if (!cancelled) {
          setIsCompiling(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activePreset.typstSnippet]);

  // Compute dynamic deterministic match score against sample candidate evidence bank
  const effectiveJob = useMemo<JobRequirementInput>(() => {
    if (customDescription.trim() !== activePreset.description.trim()) {
      const parsed = parseJobDescription(customDescription);
      const yoeMatch = customDescription.match(/(\d+)\+?\s*(?:years|yrs|year)\s+(?:of\s+)?experience/i);
      const reqYoe = yoeMatch ? parseInt(yoeMatch[1], 10) : (activePreset.job.requiredYoe ?? 3);

      return {
        requiredSkills: parsed.requiredSkills.length > 0 ? parsed.requiredSkills : activePreset.job.requiredSkills,
        preferredSkills: parsed.preferredSkills,
        tools: parsed.preferredSkills,
        requiredYoe: reqYoe,
      };
    }
    return activePreset.job;
  }, [activePreset.job, activePreset.description, customDescription]);

  const scoreResult = useMemo(() => {
    return calculateMatchScore(effectiveJob, SAMPLE_CANDIDATE);
  }, [effectiveJob]);

  const scoreBadgeColor =
    scoreResult.compositeScore >= 80
      ? "text-emerald-400 border-emerald-500/40 bg-emerald-500/10"
      : scoreResult.compositeScore >= 60
      ? "text-amber-400 border-amber-500/40 bg-amber-500/10"
      : "text-rose-400 border-rose-500/40 bg-rose-500/10";

  return (
    <section
      data-testid="instant-ats-sandbox-section"
      className="py-20 px-4 md:px-8 max-w-7xl mx-auto w-full border-t border-slate-800/80"
    >
      {/* Header */}
      <div className="mb-12 text-center max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 text-xs font-mono mb-4">
          <ShieldCheck className="h-4 w-4" />
          <span>ZERO-AUTH DETERMINISTIC SANDBOX</span>
        </div>
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-white tracking-tight mb-4">
          Instant ATS &amp; Typst Sandbox
        </h2>
        <p className="text-slate-300 text-sm md:text-base lg:text-lg leading-relaxed">
          Test our explainable mathematical ATS evaluator and in-browser Typst WASM compiler right now.
          Zero network egress, zero tracking, and no signup required.
        </p>
      </div>

      {/* Preset Role Selectors */}
      <div className="flex flex-wrap items-center justify-center gap-3 mb-10">
        <span className="text-xs md:text-sm font-mono text-slate-400 uppercase tracking-wider mr-1 hidden sm:inline">
          Sample Roles:
        </span>
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            data-testid={`sandbox-preset-${preset.id}`}
            onClick={() => handleSelectPreset(preset)}
            className={`px-4 py-2.5 rounded-lg text-xs md:text-sm font-mono font-semibold transition flex items-center gap-2 cursor-pointer ${
              selectedPresetId === preset.id
                ? "bg-[#ff8c00] text-slate-950 shadow-[0_0_15px_rgba(255,140,0,0.35)]"
                : "border border-slate-800 bg-[#060e20] text-slate-300 hover:text-white hover:border-slate-700"
            }`}
          >
            <Cpu className="h-4 w-4" />
            {preset.name}
          </button>
        ))}
      </div>

      {/* Main 2-Column Sandbox Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: JD Input & Live ATS Mathematical Breakdown (lg:col-span-6) */}
        <div className="lg:col-span-6 flex flex-col gap-6">
          {/* JD Input Panel */}
          <div className="rounded-2xl p-6 border border-slate-800 bg-[#060e20]/90 shadow-xl">
            <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4 text-[#ff8c00]" />
                <span className="font-mono text-xs md:text-sm text-[#ff8c00] font-bold uppercase tracking-wider">
                  Target Job Description
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleSelectPreset(activePreset)}
                className="text-slate-400 hover:text-white text-xs md:text-sm font-mono flex items-center gap-1.5 transition cursor-pointer"
                title="Reset to preset original"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Reset
              </button>
            </div>

            <textarea
              value={customDescription}
              onChange={(e) => setCustomDescription(e.target.value)}
              rows={8}
              data-testid="sandbox-jd-input"
              className="w-full bg-[#030712] border border-slate-800 rounded-xl p-3.5 font-mono text-xs md:text-sm text-slate-200 leading-relaxed resize-none focus:outline-none focus:border-amber-500/60"
            />
            <div className="mt-2.5 flex items-center justify-between flex-wrap gap-2 text-xs font-mono text-slate-400">
              <span>{customDescription.length} characters</span>
              <span>Candidate: Alex Rivera (6 YOE · Verified Evidence)</span>
            </div>
          </div>

          {/* Mathematical ATS Score Panel */}
          <div
            data-testid="sandbox-score-panel"
            className="rounded-2xl p-6 border border-slate-800 bg-[#060e20]/90 space-y-6 shadow-xl"
          >
            {/* Header with Composite Score */}
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-800/80">
              <div>
                <span className="text-xs font-mono text-slate-400 uppercase tracking-wider block mb-1">
                  Deterministic Composite Score
                </span>
                <span className="text-base md:text-lg font-bold text-white">
                  Mathematical Fit Breakdown
                </span>
              </div>
              <div
                className={`px-3.5 py-1.5 rounded-full border font-mono font-extrabold text-sm md:text-base flex items-center gap-1.5 ${scoreBadgeColor}`}
              >
                <Sparkles className="h-4 w-4" />
                <span>{scoreResult.compositeScore}% ATS MATCH</span>
              </div>
            </div>

            {/* 4-Part Component Bars */}
            <div className="space-y-4 font-mono text-xs md:text-sm">
              {/* Core Stack */}
              <div>
                <div className="flex justify-between text-xs md:text-sm mb-1.5">
                  <span className="text-slate-300 font-medium">
                    Core Stack (50% weight):
                  </span>
                  <span className="font-bold text-emerald-400">
                    {scoreResult.breakdown.coreStackScore}%
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-900 border border-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${scoreResult.breakdown.coreStackScore}%` }}
                  />
                </div>
              </div>

              {/* Seniority */}
              <div>
                <div className="flex justify-between text-xs md:text-sm mb-1.5">
                  <span className="text-slate-300 font-medium">
                    Seniority (20% weight):
                  </span>
                  <span className="font-bold text-sky-400">
                    {scoreResult.breakdown.seniorityScore}%
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-900 border border-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-sky-500 transition-all duration-500"
                    style={{ width: `${scoreResult.breakdown.seniorityScore}%` }}
                  />
                </div>
              </div>

              {/* Tools & Infrastructure */}
              <div>
                <div className="flex justify-between text-xs md:text-sm mb-1.5">
                  <span className="text-slate-300 font-medium">
                    Tools &amp; Infra (15% weight):
                  </span>
                  <span className="font-bold text-amber-400">
                    {scoreResult.breakdown.toolsScore}%
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-900 border border-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-amber-500 transition-all duration-500"
                    style={{ width: `${scoreResult.breakdown.toolsScore}%` }}
                  />
                </div>
              </div>

              {/* Evidence Coverage */}
              <div>
                <div className="flex justify-between text-xs md:text-sm mb-1.5">
                  <span className="text-slate-300 font-medium">
                    Evidence Bank Coverage (15% weight):
                  </span>
                  <span className="font-bold text-purple-400">
                    {scoreResult.breakdown.evidenceCoverageScore}%
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-900 border border-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-purple-500 transition-all duration-500"
                    style={{ width: `${scoreResult.breakdown.evidenceCoverageScore}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Skill Evidence Links */}
            <div className="pt-3 border-t border-slate-800/80">
              <span className="text-xs font-mono text-slate-400 uppercase tracking-wider block mb-2.5">
                Ground-Truth Skill Evidence Verification:
              </span>
              <div className="flex flex-wrap gap-2">
                {scoreResult.matchedSkills.map((link) => (
                  <span
                    key={link.skill}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono border ${
                      link.verified
                        ? "bg-emerald-950/60 border-emerald-800 text-emerald-300"
                        : "bg-amber-950/60 border-amber-800 text-amber-300"
                    }`}
                  >
                    {link.verified ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                    )}
                    <span>{link.skill}</span>
                  </span>
                ))}
                {scoreResult.missingRequiredSkills.map((skill) => (
                  <span
                    key={skill}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-mono bg-rose-950/40 border border-rose-800/60 text-rose-300"
                  >
                    <span>✗ {skill}</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Expandable Step-by-Step Derivation Log */}
            <div className="pt-3 border-t border-slate-800/80">
              <button
                type="button"
                onClick={() => setShowDerivationLog((prev) => !prev)}
                data-testid="toggle-derivation-log-btn"
                className="w-full flex items-center justify-between text-xs md:text-sm font-mono text-slate-400 hover:text-amber-400 py-1.5 transition cursor-pointer"
              >
                <span>Formula Derivation Audit Log</span>
                {showDerivationLog ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>

              {showDerivationLog && (
                <div
                  data-testid="sandbox-derivation-log"
                  className="mt-3 p-4 md:p-5 rounded-xl bg-[#030712] border border-slate-800 space-y-2 font-mono text-xs md:text-sm text-slate-200 leading-relaxed"
                >
                  {scoreResult.explanationDerivation.map((log, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-amber-400 shrink-0 font-bold">›</span>
                      <span>{log}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Live In-Browser Typst Compilation Preview (lg:col-span-6) */}
        <div className="lg:col-span-6 flex flex-col gap-4">
          <div className="rounded-2xl p-6 border border-slate-800 bg-[#060e20]/90 flex-1 flex flex-col min-h-[520px] shadow-xl">
            {/* Tab Controls & Compile Status */}
            <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewTab("svg")}
                  data-testid="sandbox-tab-svg"
                  className={`px-3.5 py-1.5 text-xs md:text-sm font-mono font-semibold rounded-lg flex items-center gap-2 transition cursor-pointer ${
                    previewTab === "svg"
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Eye className="h-4 w-4" />
                  <span>Document Preview (WASM SVG)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPreviewTab("source")}
                  data-testid="sandbox-tab-source"
                  className={`px-3.5 py-1.5 text-xs md:text-sm font-mono font-semibold rounded-lg flex items-center gap-2 transition cursor-pointer ${
                    previewTab === "source"
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <FileCode className="h-4 w-4" />
                  <span>Typst AST Source</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                {isCompiling ? (
                  <span className="text-xs font-mono text-amber-300 flex items-center gap-1.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Compiling...
                  </span>
                ) : (
                  <span className="text-xs font-mono text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Compiled in-browser
                  </span>
                )}
              </div>
            </div>

            {/* View Area */}
            <div className="flex-1 min-h-[440px] flex flex-col">
              {previewTab === "svg" ? (
                <div
                  data-testid="sandbox-svg-container"
                  className="flex-1 flex items-start justify-center p-4 md:p-6 bg-[#0a0f1d] rounded-xl border border-slate-800/80 overflow-auto max-h-[620px]"
                >
                  {isCompiling && !svgOutput ? (
                    <div className="flex flex-col items-center gap-3 text-slate-400 text-xs md:text-sm font-mono">
                      <Loader2 className="h-7 w-7 animate-spin text-amber-400" />
                      <span>Initializing Typst WASM compiler...</span>
                    </div>
                  ) : compileError ? (
                    <div className="text-xs md:text-sm text-rose-300 font-mono p-4 border border-rose-800 rounded-xl bg-rose-950/40">
                      Error compiling Typst: {compileError}
                    </div>
                  ) : svgOutput ? (
                    <div
                      className="w-full bg-white rounded-lg shadow-xl overflow-hidden p-2"
                      style={{ maxWidth: "580px" }}
                      dangerouslySetInnerHTML={{ __html: svgOutput }}
                    />
                  ) : (
                    <div className="text-xs md:text-sm text-slate-500 font-mono">
                      Ready to compile. Select a role above.
                    </div>
                  )}
                </div>
              ) : (
                <pre
                  data-testid="sandbox-typst-source-view"
                  className="flex-1 p-4 md:p-6 bg-[#030712] border border-slate-800 rounded-xl font-mono text-xs md:text-sm text-slate-300 leading-relaxed overflow-auto max-h-[620px] whitespace-pre-wrap selection:bg-amber-500/30"
                >
                  {activePreset.typstSnippet}
                </pre>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
