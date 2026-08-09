"use client";

import React, { useState } from "react";
import { Upload, Database, Sparkles, CheckCircle2, FileCheck, ArrowRight, ShieldCheck } from "lucide-react";

interface WorkflowStep {
  id: string;
  number: string;
  title: string;
  subtitle: string;
  description: string;
  icon: React.ElementType;
  color: string;
  artifactLabel: string;
  artifactCode: string;
}

const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    id: "import",
    number: "01",
    title: "Import",
    subtitle: "Ingest PDF or Starter Template",
    description:
      "Upload your existing resume PDF or start from a clean Typst template. The system converts structure to WASM Typst markup while safeguarding your master resume.",
    icon: Upload,
    color: "text-amber-400 border-amber-500/30 bg-amber-950/20",
    artifactLabel: "PDF_WASM_CONVERSION",
    artifactCode: `#let master = import("resume.pdf")\n// Converted 12 entries to Typst WASM AST\n// Status: Master Resume Locked`,
  },
  {
    id: "ground",
    number: "02",
    title: "Ground",
    subtitle: "Map Verified Evidence Bank",
    description:
      "Maintain a single source of truth for your achievements, bullets, and verified skills. AI patch generation only pulls from verified evidence to eliminate hallucination.",
    icon: Database,
    color: "text-emerald-400 border-emerald-500/30 bg-emerald-950/20",
    artifactLabel: "EVIDENCE_BANK_REGISTRY",
    artifactCode: `EvidenceItem { id: "exp-01", category: "FullStack" }\nBullets: [ "Reduced API latency by 42% via WASM" ]\nVerifiedStatus: TRUE`,
  },
  {
    id: "tailor",
    number: "03",
    title: "Tailor",
    subtitle: "Generate AI Patch Suggestions",
    description:
      "Parse target job descriptions, extract key requirements, and generate evidence-grounded resume patches with full patch preview before applying to buffer.",
    icon: Sparkles,
    color: "text-purple-400 border-purple-500/30 bg-purple-950/20",
    artifactLabel: "AI_PATCH_SUGGESTION",
    artifactCode: `PatchSuggestion {\n  operation: "REPLACE_BULLET",\n  target: "L42",\n  evidenceId: "exp-01"\n}`,
  },
  {
    id: "verify",
    number: "04",
    title: "Verify",
    subtitle: "Audit 100-Point ATS Rubric",
    description:
      "Inspect deterministic ATS scores across Base Resume Health, Required Match, Preferred Match, and Role Evidence overlay with qualitative feedback.",
    icon: CheckCircle2,
    color: "text-cyan-400 border-cyan-500/30 bg-cyan-950/20",
    artifactLabel: "ATS_EVALUATION_RUBRIC",
    artifactCode: `OverallMatch: 100 / 100\n- BaseHealth: 30 / 30 pts\n- RequiredMatch: 40 / 40 pts\n- RoleEvidence: 15 / 15 pts`,
  },
  {
    id: "apply",
    number: "05",
    title: "Apply",
    subtitle: "Export WASM PDF & Track Job",
    description:
      "Compile pixel-perfect PDFs locally using native Typst WASM and track application status through the Kanban pipeline from Saved to Applied.",
    icon: FileCheck,
    color: "text-blue-400 border-blue-500/30 bg-blue-950/20",
    artifactLabel: "TYPST_WASM_COMPILATION",
    artifactCode: `TypstCompiler.compile(source)\n-> Rendered 1-Page Vector SVG / PDF\n-> Saved to Application Tracker`,
  },
];

export function WorkflowTimeline() {
  const [activeStepIndex, setActiveStepIndex] = useState(0);

  const activeStep = WORKFLOW_STEPS[activeStepIndex];
  const StepIcon = activeStep.icon;

  return (
    <section className="flex flex-col gap-6 w-full max-w-5xl mx-auto py-8" data-testid="workflow-section">
      {/* Editorial Header */}
      <div className="flex flex-col items-center text-center gap-2">
        <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-amber-400 bg-amber-950/40 border border-amber-800/50 px-3 py-1 rounded-full">
          EDITORIAL WORKFLOW PIPELINE
        </span>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          How ResumeForge Operates
        </h2>
        <p className="text-xs sm:text-sm text-slate-400 max-w-lg">
          A disciplined 5-step sequence ensuring every resume edit is truthful, evidence-backed, and tailored to target job descriptions.
        </p>
      </div>

      {/* Step Selector Horizontal Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2" data-testid="workflow-steps-grid">
        {WORKFLOW_STEPS.map((step, idx) => {
          const isActive = idx === activeStepIndex;
          const Icon = step.icon;
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => setActiveStepIndex(idx)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setActiveStepIndex(idx);
                }
              }}
              data-testid={`workflow-step-btn-${step.id}`}
              className={`p-3 rounded-xl border text-left flex flex-col gap-1.5 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-amber-500/50 ${
                isActive
                  ? "bg-slate-900 border-amber-500/60 shadow-lg shadow-amber-500/10 scale-[1.02]"
                  : "bg-slate-950/80 border-slate-800/80 hover:bg-slate-900/60 text-slate-400"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold text-amber-400">{step.number}</span>
                <Icon className={`h-3.5 w-3.5 ${isActive ? "text-amber-400" : "text-slate-500"}`} />
              </div>
              <span className={`text-xs font-bold ${isActive ? "text-white" : "text-slate-300"}`}>
                {step.title}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active Step Detailed Content & Artifact Preview Card */}
      <div
        className="bg-slate-950/90 border border-slate-800 rounded-2xl p-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-center shadow-xl"
        data-testid="workflow-active-panel"
      >
        {/* Left Column: Description */}
        <div className="md:col-span-7 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-amber-400 bg-amber-950/50 border border-amber-800/50 px-2.5 py-1 rounded">
              STEP {activeStep.number} — {activeStep.title.toUpperCase()}
            </span>
          </div>

          <div className="space-y-1">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <StepIcon className="h-5 w-5 text-amber-400" />
              {activeStep.subtitle}
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-sans">
              {activeStep.description}
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400 font-mono pt-1">
            <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>Guaranteed Local-Only Execution</span>
          </div>
        </div>

        {/* Right Column: Code & Artifact Preview */}
        <div className="md:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2.5 font-mono text-xs">
          <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-800 pb-2">
            <span className="text-amber-400 font-semibold">{activeStep.artifactLabel}</span>
            <span>Local Engine</span>
          </div>

          <pre className="text-[11px] text-slate-200 bg-slate-950 p-3 rounded-lg border border-slate-800/80 overflow-x-auto whitespace-pre-wrap leading-relaxed">
            {activeStep.artifactCode}
          </pre>
        </div>
      </div>
    </section>
  );
}
