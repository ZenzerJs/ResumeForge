"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  FileCode,
  Eye,
  Terminal,
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
import { BrandIcon, hasBrandIcon } from "@/components/design-system/brand-icon";

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
  totalYoe: 1,
  evidenceItems: [
    {
      id: "evid-01",
      title: "Backend Engineering Intern — CloudScale Labs",
      tags: ["Go", "Python", "Docker", "PostgreSQL"],
      bullets: [
        {
          id: "b-1",
          text: "Built Go RESTful APIs with PostgreSQL persistence and integration tests for internal job scheduling.",
          technologies: ["Go", "PostgreSQL", "RESTful APIs"],
        },
        {
          id: "b-2",
          text: "Containerized local development and CI worker services using Docker and Kubernetes manifests.",
          technologies: ["Docker", "Kubernetes", "Python"],
        },
      ],
    },
    {
      id: "evid-02",
      title: "Campus Course Planner (Capstone Project)",
      tags: ["React", "TypeScript", "Next.js", "Tailwind CSS"],
      bullets: [
        {
          id: "b-3",
          text: "Built accessible Next.js and TypeScript schedule-builder views styled with Tailwind CSS.",
          technologies: ["React", "Next.js", "TypeScript", "Tailwind CSS"],
        },
      ],
    },
  ],
};

const PRESETS: PresetRole[] = [
  {
    id: "backend",
    name: "Backend SWE Intern",
    roleTitle: "Backend Software Engineer Intern",
    company: "CloudScale Systems",
    job: {
      requiredSkills: ["Go", "Python", "PostgreSQL", "Docker"],
      tools: ["Kubernetes", "Redis"],
      requiredYoe: 0,
    },
    description: `Backend Software Engineer Intern — CloudScale Systems

We are seeking a Backend SWE Intern to help build reliable microservices and data pipelines alongside our platform team.

Requirements:
- Pursuing a B.S./M.S. in Computer Science or equivalent project experience in Go or Python.
- Familiarity with PostgreSQL, relational schemas, and writing clean SQL queries.
- Hands-on project or internship experience containerizing services with Docker.
- Experience building and testing RESTful APIs.

Tools & Infra:
- Docker, Kubernetes, Redis, Git.`,
    typstSnippet: `// Tailored Variant: Backend SWE Intern
#let resume-section(title) = [ === #title ]
#resume-section("Core Skills")
Languages: Go, Python, TypeScript, SQL (PostgreSQL)
Infrastructure: Docker, Kubernetes, Redis, RESTful APIs

#resume-section("Experience & Projects")
*Backend Engineering Intern* | CloudScale Labs (Summer 2025)
- Built Go RESTful APIs with PostgreSQL persistence and integration tests for internal job scheduling.
- Containerized local development and CI worker services using Docker and Kubernetes manifests.
`,
  },
  {
    id: "frontend",
    name: "New-Grad Frontend Engineer",
    roleTitle: "New-Grad Frontend Engineer",
    company: "Veloce Web Technologies",
    job: {
      requiredSkills: ["TypeScript", "React", "Next.js", "Tailwind CSS"],
      tools: ["WebAssembly", "Docker"],
      requiredYoe: 1,
    },
    description: `New-Grad Frontend Engineer — Veloce Web Technologies

Join our product engineering team to build accessible design-system components and responsive client workflows.

Key Requirements:
- 0-1+ years of internship or project experience with modern web stacks.
- Solid foundation in React, Next.js App Router, and TypeScript.
- Experience building accessible UI components with Tailwind CSS and WAI-ARIA standards.
- Interest in WebAssembly (WASM) or browser-based tooling.`,
    typstSnippet: `// Tailored Variant: New-Grad Frontend Engineer
#let resume-section(title) = [ === #title ]
#resume-section("Skills")
Frontend: React, Next.js, TypeScript, Tailwind CSS, WebAssembly (WASM)
Tooling: Vitest, Playwright, Docker, Turbopack

#resume-section("Projects & Internships")
*Campus Course Planner (Capstone)* | Open-Source Project (2025)
- Built accessible Next.js and TypeScript schedule-builder views styled with Tailwind CSS.
- Added keyboard navigation and unit tests for schedule conflict detection.
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

const PRESET_DEFAULT_SNIPPETS: Record<string, string> = {
  backend: PRESETS[0].typstSnippet,
  frontend: PRESETS[1].typstSnippet,
  "ai-platform": PRESETS[2].typstSnippet,
};

const PRESET_STATIC_SVGS: Record<string, string> = {
  backend: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 595 400" width="100%" height="100%"><rect width="595" height="400" fill="#ffffff"/><text x="36" y="44" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="700" fill="#181412" letter-spacing="0.05em">CORE SKILLS</text><line x1="36" y1="52" x2="559" y2="52" stroke="#d8d0c5" stroke-width="1"/><text x="36" y="74" font-family="system-ui, -apple-system, sans-serif" font-size="10.5" fill="#272120"><tspan font-weight="600">Languages:</tspan> Go, Python, TypeScript, SQL (PostgreSQL)</text><text x="36" y="94" font-family="system-ui, -apple-system, sans-serif" font-size="10.5" fill="#272120"><tspan font-weight="600">Infrastructure:</tspan> Docker, Kubernetes, Redis, RESTful APIs</text><text x="36" y="132" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="700" fill="#181412" letter-spacing="0.05em">EXPERIENCE &amp; PROJECTS</text><line x1="36" y1="140" x2="559" y2="140" stroke="#d8d0c5" stroke-width="1"/><text x="36" y="162" font-family="system-ui, -apple-system, sans-serif" font-size="10.5" fill="#181412"><tspan font-weight="700">Backend Engineering Intern</tspan> | CloudScale Labs</text><text x="559" y="162" font-family="system-ui, -apple-system, sans-serif" font-size="10" fill="#7a6e65" text-anchor="end">Summer 2025</text><circle cx="42" cy="184" r="2" fill="#3a322f"/><text x="52" y="187" font-family="system-ui, -apple-system, sans-serif" font-size="10" fill="#3a322f">Built Go RESTful APIs with PostgreSQL persistence and integration tests for job scheduling.</text><circle cx="42" cy="206" r="2" fill="#3a322f"/><text x="52" y="209" font-family="system-ui, -apple-system, sans-serif" font-size="10" fill="#3a322f">Containerized local development and CI worker services using Docker and Kubernetes manifests.</text></svg>`,
  frontend: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 595 400" width="100%" height="100%"><rect width="595" height="400" fill="#ffffff"/><text x="36" y="44" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="700" fill="#181412" letter-spacing="0.05em">SKILLS</text><line x1="36" y1="52" x2="559" y2="52" stroke="#d8d0c5" stroke-width="1"/><text x="36" y="74" font-family="system-ui, -apple-system, sans-serif" font-size="10.5" fill="#272120"><tspan font-weight="600">Frontend:</tspan> React, Next.js, TypeScript, Tailwind CSS, WebAssembly (WASM)</text><text x="36" y="94" font-family="system-ui, -apple-system, sans-serif" font-size="10.5" fill="#272120"><tspan font-weight="600">Tooling:</tspan> Vitest, Playwright, Docker, Turbopack</text><text x="36" y="132" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="700" fill="#181412" letter-spacing="0.05em">PROJECTS &amp; INTERNSHIPS</text><line x1="36" y1="140" x2="559" y2="140" stroke="#d8d0c5" stroke-width="1"/><text x="36" y="162" font-family="system-ui, -apple-system, sans-serif" font-size="10.5" fill="#181412"><tspan font-weight="700">Campus Course Planner (Capstone)</tspan> | Open-Source Project</text><text x="559" y="162" font-family="system-ui, -apple-system, sans-serif" font-size="10" fill="#7a6e65" text-anchor="end">2025</text><circle cx="42" cy="184" r="2" fill="#3a322f"/><text x="52" y="187" font-family="system-ui, -apple-system, sans-serif" font-size="10" fill="#3a322f">Built accessible Next.js and TypeScript schedule-builder views styled with Tailwind CSS.</text><circle cx="42" cy="206" r="2" fill="#3a322f"/><text x="52" y="209" font-family="system-ui, -apple-system, sans-serif" font-size="10" fill="#3a322f">Added keyboard navigation and unit tests for schedule conflict detection.</text></svg>`,
  "ai-platform": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 595 400" width="100%" height="100%"><rect width="595" height="400" fill="#ffffff"/><text x="36" y="44" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="700" fill="#181412" letter-spacing="0.05em">TECHNICAL SKILLS</text><line x1="36" y1="52" x2="559" y2="52" stroke="#d8d0c5" stroke-width="1"/><text x="36" y="74" font-family="system-ui, -apple-system, sans-serif" font-size="10.5" fill="#272120"><tspan font-weight="600">Languages:</tspan> Python, Go, C++</text><text x="36" y="94" font-family="system-ui, -apple-system, sans-serif" font-size="10.5" fill="#272120"><tspan font-weight="600">AI/Infra:</tspan> PyTorch, Docker, Kubernetes, Distributed Inference Systems</text><text x="36" y="132" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="700" fill="#181412" letter-spacing="0.05em">EXPERIENCE</text><line x1="36" y1="140" x2="559" y2="140" stroke="#d8d0c5" stroke-width="1"/><text x="36" y="162" font-family="system-ui, -apple-system, sans-serif" font-size="10.5" fill="#181412"><tspan font-weight="700">Infrastructure &amp; Backend Engineer</tspan> | Nova Labs</text><text x="559" y="162" font-family="system-ui, -apple-system, sans-serif" font-size="10" fill="#7a6e65" text-anchor="end">2021 – Present</text><circle cx="42" cy="184" r="2" fill="#3a322f"/><text x="52" y="187" font-family="system-ui, -apple-system, sans-serif" font-size="10" fill="#3a322f">Designed automated distributed training pipeline jobs utilizing Python, Docker, and Kubernetes.</text><circle cx="42" cy="206" r="2" fill="#3a322f"/><text x="52" y="209" font-family="system-ui, -apple-system, sans-serif" font-size="10" fill="#3a322f">Maintained low-latency inference endpoints with 99.98% operational uptime.</text></svg>`,
};

export function AtsSandboxSection() {
  const [selectedPresetId, setSelectedPresetId] = useState<string>("backend");
  const [activePreset, setActivePreset] = useState<PresetRole>(PRESETS[0]);
  const [customDescription, setCustomDescription] = useState<string>(PRESETS[0].description);
  const [customSnippet, setCustomSnippet] = useState<string>(PRESETS[0].typstSnippet);
  const [isEditingSnippet, setIsEditingSnippet] = useState<boolean>(false);
  const [previewTab, setPreviewTab] = useState<"svg" | "source">("svg");
  const [svgOutput, setSvgOutput] = useState<string | null>(PRESET_STATIC_SVGS.backend);
  const [sanitizedSvg, setSanitizedSvg] = useState<{
    raw: string;
    clean: string | null;
    error: string | null;
  } | null>(null);
  const [isCompiling, setIsCompiling] = useState<boolean>(false);
  const [compileError, setCompileError] = useState<string | null>(null);
  const [showDerivationLog, setShowDerivationLog] = useState<boolean>(false);

  useEffect(() => {
    if (!svgOutput) {
      setSanitizedSvg(null);
      return;
    }
    let cancelled = false;
    import("@/lib/typst/svg-sanitize").then(({ sanitizeTypstSvg }) => {
      if (cancelled) return;
      const res = sanitizeTypstSvg(svgOutput);
      setSanitizedSvg(
        res.ok
          ? { raw: svgOutput, clean: res.svg, error: null }
          : { raw: svgOutput, clean: null, error: res.error }
      );
    });
    return () => {
      cancelled = true;
    };
  }, [svgOutput]);

  // Switch presets
  const handleSelectPreset = (preset: PresetRole) => {
    setSelectedPresetId(preset.id);
    setActivePreset(preset);
    setCustomDescription(preset.description);
    setCustomSnippet(preset.typstSnippet);
    setIsEditingSnippet(false);
    if (PRESET_STATIC_SVGS[preset.id]) {
      setSvgOutput(PRESET_STATIC_SVGS[preset.id]);
      setCompileError(null);
    }
  };

  // Compile Typst only when custom code differs from preset defaults
  useEffect(() => {
    const isDefault =
      PRESET_STATIC_SVGS[activePreset.id] &&
      customSnippet.trim() === PRESET_DEFAULT_SNIPPETS[activePreset.id]?.trim();

    if (isDefault) {
      setSvgOutput(PRESET_STATIC_SVGS[activePreset.id]);
      setIsCompiling(false);
      setCompileError(null);
      return;
    }

    if (typeof window === "undefined") return;
    let cancelled = false;
    setIsCompiling(true);
    setCompileError(null);

    const timer = setTimeout(() => {
      import("@/lib/typst/compiler")
        .then(({ compileTypstToSvg }) =>
          compileTypstToSvg(customSnippet, { callerId: "ats-sandbox", mode: "live" }),
        )
        .then((result) => {
          if (cancelled || ("superseded" in result && result.superseded)) return;
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
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [activePreset.id, customSnippet]);

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
      ? "text-status-success-soft border-signal/40 bg-signal/10"
      : scoreResult.compositeScore >= 60
      ? "text-status-warning border-status-warning/40 bg-status-warning/10"
      : "text-status-danger border-status-danger/40 bg-status-danger/10";

  return (
    <section
      data-testid="instant-ats-sandbox-section"
      className="w-full px-2 pb-8 pt-4 md:px-4"
    >
      <p className="mb-6 max-w-prose text-sm leading-relaxed text-on-surface-variant">
        Compare a synthetic sample resume with example roles to see how skills, experience, and evidence affect the score.
        The score and Typst preview run in your browser.
      </p>

      {/* Preset Role Selectors */}
      <div className="flex flex-wrap items-center justify-center gap-3 mb-10">
        <span className="text-xs md:text-sm font-mono text-muted-foreground uppercase tracking-wider mr-1 hidden sm:inline">
          Sample Roles:
        </span>
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            data-testid={`sandbox-preset-${preset.id}`}
            onClick={() => handleSelectPreset(preset)}
            className={`px-4 py-2.5 rounded-[8px] text-xs md:text-sm font-mono font-semibold transition flex items-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              selectedPresetId === preset.id
                ? "bg-primary text-primary-foreground shadow-sm"
                : "border border-outline/70 bg-panel text-on-surface-variant hover:text-foreground hover:border-outline"
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
          <div className="rounded-[10px] p-6 surface-raised edge-glow">
            <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-outline/70">
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4 text-primary" />
                <span className="font-mono text-xs md:text-sm text-primary font-semibold uppercase tracking-wider">
                  Target Job Description
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleSelectPreset(activePreset)}
                className="text-muted-foreground hover:text-foreground text-xs md:text-sm font-mono flex items-center gap-1.5 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-[4px]"
                title="Reset to preset original"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Reset
              </button>
            </div>

            <textarea
              value={customDescription}
              onChange={(e) => setCustomDescription(e.target.value)}
              rows={8}
              aria-label="Target Job Description"
              data-testid="sandbox-jd-input"
              className="w-full bg-inset border border-outline/70 rounded-[8px] p-3.5 font-mono text-xs md:text-sm text-foreground leading-relaxed resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:border-ring"
            />
            <div className="mt-2.5 flex items-center justify-between flex-wrap gap-2 text-xs font-mono text-muted-foreground tabular-nums">
              <span>{customDescription.length} characters</span>
              <span>Candidate: Alex Rivera (1 YOE · Intern &amp; Project Evidence)</span>
            </div>
          </div>

          {/* Mathematical ATS Score Panel */}
          <div
            data-testid="sandbox-score-panel"
            className="rounded-[10px] p-6 surface-raised edge-glow space-y-6"
          >
            {/* Header with Composite Score */}
            <div className="flex items-center justify-between pb-3.5 border-b border-outline/70">
              <div>
                <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider block mb-1">
                  Deterministic Composite Score
                </span>
                <span className="text-base md:text-lg font-bold text-foreground">
                  Mathematical Fit Breakdown
                </span>
              </div>
              <div
                className={`px-3.5 py-1.5 rounded-full border font-mono font-semibold tabular-nums text-sm md:text-base flex items-center gap-1.5 ${scoreBadgeColor}`}
              >
                <Sparkles className="h-4 w-4" />
                <span>{scoreResult.compositeScore}% ATS MATCH</span>
              </div>
            </div>

            {/* 4-Part Component Bars */}
            <div className="space-y-4 font-mono text-xs md:text-sm tabular-nums">
              {/* Core Stack */}
              <div>
                <div className="flex justify-between text-xs md:text-sm mb-1.5">
                  <span className="text-on-surface-variant font-normal">
                    Core Stack (50% weight):
                  </span>
                  <span className="font-semibold text-signal">
                    {scoreResult.breakdown.coreStackScore}%
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-inset border border-outline/70 overflow-hidden">
                  <div
                    className="h-full bg-signal transition-all duration-500"
                    style={{ width: `${scoreResult.breakdown.coreStackScore}%` }}
                  />
                </div>
              </div>

              {/* Seniority */}
              <div>
                <div className="flex justify-between text-xs md:text-sm mb-1.5">
                  <span className="text-on-surface-variant font-normal">
                    Seniority (20% weight):
                  </span>
                  <span className="font-semibold text-primary">
                    {scoreResult.breakdown.seniorityScore}%
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-inset border border-outline/70 overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-500"
                    style={{ width: `${scoreResult.breakdown.seniorityScore}%` }}
                  />
                </div>
              </div>

              {/* Tools & Infrastructure */}
              <div>
                <div className="flex justify-between text-xs md:text-sm mb-1.5">
                  <span className="text-on-surface-variant font-normal">
                    Tools &amp; Infra (15% weight):
                  </span>
                  <span className="font-semibold text-ember">
                    {scoreResult.breakdown.toolsScore}%
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-inset border border-outline/70 overflow-hidden">
                  <div
                    className="h-full bg-ember transition-all duration-500"
                    style={{ width: `${scoreResult.breakdown.toolsScore}%` }}
                  />
                </div>
              </div>

              {/* Evidence Coverage */}
              <div>
                <div className="flex justify-between text-xs md:text-sm mb-1.5">
                  <span className="text-on-surface-variant font-normal">
                    Evidence Bank Coverage (15% weight):
                  </span>
                  <span className="font-semibold text-foreground">
                    {scoreResult.breakdown.evidenceCoverageScore}%
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-inset border border-outline/70 overflow-hidden">
                  <div
                    className="h-full ombre-bar transition-all duration-500"
                    style={{ width: `${scoreResult.breakdown.evidenceCoverageScore}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Skill Evidence Links */}
            <div className="pt-3 border-t border-outline/70">
              <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider block mb-2.5">
                Ground-Truth Skill Evidence Verification:
              </span>
              <div className="flex flex-wrap gap-2">
                {scoreResult.matchedSkills.map((link) => (
                  <span
                    key={link.skill}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] text-xs font-mono border ${
                      link.verified
                        ? "bg-signal/10 border-signal/35 text-status-success-soft"
                        : "bg-status-warning/10 border-status-warning/35 text-status-warning"
                    }`}
                  >
                    {link.verified ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-status-success-soft" />
                    ) : (
                      <AlertTriangle className="h-3.5 w-3.5 text-status-warning" />
                    )}
                    {hasBrandIcon(link.skill) && (
                      <BrandIcon name={link.skill} className="h-3.5 w-3.5 shrink-0" />
                    )}
                    <span>{link.skill}</span>
                  </span>
                ))}
                {scoreResult.missingRequiredSkills.map((skill) => (
                  <span
                    key={skill}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] text-xs font-mono bg-status-danger/10 border border-status-danger/35 text-status-danger"
                  >
                    <span aria-hidden="true">✗{" "}</span>
                    {hasBrandIcon(skill) && (
                      <BrandIcon name={skill} className="h-3.5 w-3.5 shrink-0" />
                    )}
                    <span>{skill}</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Expandable Step-by-Step Derivation Log */}
            <div className="pt-3 border-t border-outline/70">
              <button
                type="button"
                onClick={() => setShowDerivationLog((prev) => !prev)}
                aria-expanded={showDerivationLog}
                aria-controls="sandbox-derivation-log"
                data-testid="toggle-derivation-log-btn"
                className="w-full flex items-center justify-between text-xs md:text-sm font-mono text-muted-foreground hover:text-primary py-1.5 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-[4px]"
              >
                <span>Formula Derivation Audit Log</span>
                {showDerivationLog ? (
                  <ChevronUp className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <ChevronDown className="h-4 w-4" aria-hidden="true" />
                )}
              </button>

              {showDerivationLog && (
                <div
                  id="sandbox-derivation-log"
                  data-testid="sandbox-derivation-log"
                  className="mt-3 p-4 md:p-5 rounded-[8px] bg-inset border border-outline/70 space-y-2 font-mono text-xs md:text-sm text-foreground leading-relaxed tabular-nums"
                >
                  {scoreResult.explanationDerivation.map((log, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-primary shrink-0 font-semibold">›</span>
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
          <div className="rounded-[10px] p-6 surface-raised edge-glow flex-1 flex flex-col min-h-[520px]">
            {/* Tab Controls & Compile Status */}
            <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-outline/70">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewTab("svg")}
                  data-testid="sandbox-tab-svg"
                  className={`px-3.5 py-1.5 text-xs md:text-sm font-mono font-semibold rounded-[6px] flex items-center gap-2 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    previewTab === "svg"
                      ? "bg-primary/15 text-primary border border-primary/40"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Eye className="h-4 w-4" />
                  <span>Resume preview</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPreviewTab("source")}
                  data-testid="sandbox-tab-source"
                  className={`px-3.5 py-1.5 text-xs md:text-sm font-mono font-semibold rounded-[6px] flex items-center gap-2 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    previewTab === "source"
                      ? "bg-primary/15 text-primary border border-primary/40"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <FileCode className="h-4 w-4" />
                  <span>Resume source</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                {isCompiling ? (
                  <span className="text-xs font-mono text-primary flex items-center gap-1.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Compiling...
                  </span>
                ) : (
                  <span className="text-xs font-mono text-signal flex items-center gap-1.5">
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
                  className="flex-1 flex items-start justify-center p-4 md:p-6 bg-inset rounded-[8px] border border-outline/70 overflow-auto max-h-[620px]"
                >
                  {isCompiling && !svgOutput ? (
                    <div className="flex flex-col items-center gap-3 text-muted-foreground text-xs md:text-sm font-mono">
                      <Loader2 className="h-7 w-7 animate-spin text-primary" />
                      <span>Initializing Typst WASM compiler...</span>
                    </div>
                  ) : compileError ? (
                    <div className="text-xs md:text-sm text-status-danger font-mono p-4 border border-status-danger/40 rounded-[8px] bg-status-danger/10">
                      Error compiling Typst: {compileError}
                    </div>
                  ) : svgOutput ? (
                    sanitizedSvg?.raw === svgOutput && sanitizedSvg.error ? (
                      <div
                        data-testid="sandbox-svg-error"
                        role="alert"
                        className="text-xs md:text-sm text-status-danger font-mono p-4 border border-status-danger/40 rounded-[8px] bg-status-danger/10"
                      >
                        {sanitizedSvg.error}
                      </div>
                    ) : sanitizedSvg?.raw === svgOutput && sanitizedSvg.clean ? (
                      <div
                        className="typst-preview-svg w-full bg-paper text-paper-ink rounded-[6px] border border-hairline shadow-xl overflow-hidden p-2 [&_svg]:w-full [&_svg]:h-auto [&_svg]:max-w-full"
                        style={{ maxWidth: "580px" }}
                        dangerouslySetInnerHTML={{ __html: sanitizedSvg.clean }}
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-3 text-muted-foreground text-xs md:text-sm font-mono">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        <span>Verifying SVG preview...</span>
                      </div>
                    )
                  ) : (
                    <div className="text-xs md:text-sm text-muted-foreground font-mono">
                      Ready to compile. Select a role above.
                    </div>
                  )}
                </div>
              ) : (
                <div data-testid="sandbox-typst-source-view" className="flex-1 flex flex-col min-h-0">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-outline/70 text-xs font-mono">
                    <span className="text-muted-foreground">
                      {isEditingSnippet ? "Live Typst editor (on-demand compile):" : "Resume source"}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        data-testid="sandbox-edit-snippet-btn"
                        onClick={() => setIsEditingSnippet((prev) => !prev)}
                        className="px-2.5 py-1 rounded-[4px] bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 text-xs font-semibold cursor-pointer transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {isEditingSnippet ? "Done Editing" : "Edit Snippet"}
                      </button>
                      {customSnippet.trim() !== PRESET_DEFAULT_SNIPPETS[activePreset.id]?.trim() && (
                        <button
                          type="button"
                          onClick={() => {
                            setCustomSnippet(activePreset.typstSnippet);
                            setIsEditingSnippet(false);
                          }}
                          className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-[4px]"
                        >
                          <RotateCcw className="h-3 w-3" /> Reset
                        </button>
                      )}
                    </div>
                  </div>
                  {isEditingSnippet ? (
                    <textarea
                      data-testid="sandbox-typst-textarea"
                      aria-label="Resume Typst source"
                      value={customSnippet}
                      onChange={(e) => setCustomSnippet(e.target.value)}
                      rows={14}
                      className="w-full flex-1 p-4 bg-inset border border-outline/70 rounded-[8px] font-mono text-xs md:text-sm text-foreground leading-relaxed resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:border-ring"
                      spellCheck={false}
                    />
                  ) : (
                    <pre
                      onClick={() => setIsEditingSnippet(true)}
                      title="Click to edit snippet"
                      className="flex-1 p-4 md:p-6 bg-inset border border-outline/70 rounded-[8px] font-mono text-xs md:text-sm text-on-surface-variant leading-relaxed overflow-auto max-h-[620px] whitespace-pre-wrap selection:bg-primary/30 cursor-pointer hover:border-outline transition-colors"
                    >
                      {customSnippet}
                    </pre>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
