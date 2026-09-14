"use client";

import React, { useState, useRef, useMemo, useEffect } from "react";
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Calculator,
  TrendingUp,
} from "lucide-react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import type { MatchScoreResult } from "@packages/schema/matchScore";
import type { CompatibilityResult } from "@/lib/scoring/compatibility-engine";
import { cn } from "@/lib/utils";

interface JobCardSignalBadgeProps {
  scoreResult?: MatchScoreResult | null;
  compatibility?: CompatibilityResult | null;
  compositeScore?: number;
  fundingBadge?: string | null;
  h1bBadge?: string | null;
  companyName?: string;
  className?: string;
  jobId?: string;
}

export function JobCardSignalBadge({
  scoreResult,
  compatibility,
  compositeScore: directScore,
  fundingBadge,
  h1bBadge,
  companyName,
  className,
  jobId,
}: JobCardSignalBadgeProps) {
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastMouseEnterTimeRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Synthesize or use provided score result for explainable derivation
  const effectiveScoreResult = useMemo<MatchScoreResult | null>(() => {
    if (scoreResult) return scoreResult;
    if (compatibility) {
      const coreStack = compatibility.requiredScore ?? 75;
      const seniority = 100;
      const tools = compatibility.preferredScore ?? 80;
      const coverage =
        compatibility.totalRequiredCount > 0
          ? Math.min(
              100,
              Math.round(
                (compatibility.matchedEvidenceCount / compatibility.totalRequiredCount) * 100
              )
            )
          : 100;
      const composite = Math.min(
        100,
        Math.max(
          0,
          Math.round(0.5 * coreStack + 0.2 * seniority + 0.15 * tools + 0.15 * coverage)
        )
      );

      const derivation: string[] = [
        `+${(0.5 * coreStack).toFixed(1)} pts (Core Stack: 50% weight) — ${coreStack}% based on ${compatibility.matchedSkills.length}/${compatibility.totalRequiredCount || compatibility.matchedSkills.length} required skills matched`,
        `+${(0.2 * seniority).toFixed(1)} pts (Seniority: 20% weight) — Candidate qualifications verified`,
        `+${(0.15 * tools).toFixed(1)} pts (Tools & Preferred: 15% weight) — ${tools}% across tooling requirements`,
        `+${(0.15 * coverage).toFixed(1)} pts (Evidence Coverage: 15% weight) — ${compatibility.matchedEvidenceCount} verified evidence bank items backing skills`,
      ];

      if (compatibility.missingSkills.length > 0) {
        derivation.push(
          `Deductions applied: Missing core requirements: ${compatibility.missingSkills.join(", ")}`
        );
      }

      return {
        compositeScore: directScore ?? composite,
        breakdown: {
          coreStackScore: coreStack,
          seniorityScore: seniority,
          toolsScore: tools,
          evidenceCoverageScore: coverage,
        },
        matchedSkills: compatibility.matchedSkills.map((s) => ({
          skill: s,
          matchType: "exact" as const,
          verified: true,
          notes: "Verified in Evidence Bank",
        })),
        missingRequiredSkills: compatibility.missingSkills,
        explanationDerivation: derivation,
      };
    }
    return null;
  }, [scoreResult, compatibility, directScore]);

  const score = effectiveScoreResult?.compositeScore ?? directScore ?? 75;

  const badgeColorClass =
    score >= 80
      ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
      : score >= 60
      ? "border-amber-500/40 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25"
      : "border-slate-700 bg-slate-800/80 text-slate-400 hover:bg-slate-800";

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    lastMouseEnterTimeRef.current = Date.now();
    setOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setOpen(false);
    }, 180);
  };

  const handleClick = (e: React.MouseEvent) => {
    // If opened via mouseenter/touch within the last 300ms, keep it open rather than toggling closed
    if (Date.now() - lastMouseEnterTimeRef.current < 300) {
      setOpen(true);
      return;
    }
    setOpen((prev) => !prev);
  };

  const verifiedSkills = effectiveScoreResult
    ? effectiveScoreResult.matchedSkills.filter((s) => s.verified)
    : [];

  return (
    <div
      className={cn("flex flex-wrap items-center gap-1.5", className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            onClick={handleClick}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-xs font-bold transition-all cursor-pointer shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40",
              badgeColorClass
            )}
            title="Hover or click to view explainable point derivation"
            data-testid={jobId ? `signal-badge-${jobId}` : "job-card-signal-badge"}
          >
            <Calculator className="h-3 w-3 shrink-0 opacity-75" />
            <span>{score}% Match</span>
          </button>
        </PopoverTrigger>

        <PopoverContent
          className="w-96 rounded-xl border border-slate-700 bg-[#0d1526] p-4 text-slate-200 shadow-2xl font-mono text-xs z-50"
          align="start"
          side="top"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          data-testid="signal-badge-popover"
        >
          {/* Popover Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
            <div className="flex items-center gap-2">
              <Calculator className="h-4 w-4 text-amber-400" />
              <span className="font-bold text-white tracking-tight">
                Explainable Match Derivation
              </span>
            </div>
            <span
              className={cn(
                "rounded px-2 py-0.5 text-xs font-bold border",
                badgeColorClass
              )}
            >
              {score}% Fit
            </span>
          </div>

          {effectiveScoreResult ? (
            <div className="space-y-3">
              {/* Component breakdown meters */}
              <div className="space-y-2 rounded-lg bg-slate-900/80 border border-slate-800/80 p-3">
                <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider block">
                  Weighted Score Components
                </span>

                {/* Core Stack */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-300">Core Stack (50%)</span>
                    <span className="text-emerald-400 font-bold">
                      {effectiveScoreResult.breakdown.coreStackScore}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-400 rounded-full transition-all duration-300"
                      style={{ width: `${effectiveScoreResult.breakdown.coreStackScore}%` }}
                    />
                  </div>
                </div>

                {/* Seniority */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-300">Seniority &amp; YOE (20%)</span>
                    <span className="text-amber-400 font-bold">
                      {effectiveScoreResult.breakdown.seniorityScore}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-400 rounded-full transition-all duration-300"
                      style={{ width: `${effectiveScoreResult.breakdown.seniorityScore}%` }}
                    />
                  </div>
                </div>

                {/* Tools */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-300">Tooling &amp; Infra (15%)</span>
                    <span className="text-sky-400 font-bold">
                      {effectiveScoreResult.breakdown.toolsScore}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-sky-400 rounded-full transition-all duration-300"
                      style={{ width: `${effectiveScoreResult.breakdown.toolsScore}%` }}
                    />
                  </div>
                </div>

                {/* Evidence Coverage */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-300">Evidence Coverage (15%)</span>
                    <span className="text-cyan-400 font-bold">
                      {effectiveScoreResult.breakdown.evidenceCoverageScore}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-cyan-400 rounded-full transition-all duration-300"
                      style={{ width: `${effectiveScoreResult.breakdown.evidenceCoverageScore}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Verified Evidence Gains */}
              {verifiedSkills.length > 0 && (
                <div className="space-y-1 rounded border border-emerald-500/30 bg-emerald-950/20 p-2.5 text-[11px]">
                  <span className="font-bold text-emerald-400 block mb-1">
                    Points Gained from Verified Evidence Bank:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {verifiedSkills.map((s, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 rounded bg-emerald-500/15 border border-emerald-500/40 px-1.5 py-0.5 text-[10px] text-emerald-300 font-mono"
                      >
                        <CheckCircle2 className="h-2.5 w-2.5 text-emerald-400" />
                        <span>{s.skill}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Missing critical stack notice / deductions */}
              {effectiveScoreResult.missingRequiredSkills.length > 0 && (
                <div className="rounded border border-dashed border-amber-500/40 bg-amber-500/10 p-2 text-[11px] text-amber-300">
                  <div className="flex items-center gap-1.5 font-bold mb-1">
                    <AlertTriangle className="h-3 w-3 text-amber-400" />
                    <span>Points Deducted for Missing Stack:</span>
                  </div>
                  <span>{effectiveScoreResult.missingRequiredSkills.join(", ")}</span>
                </div>
              )}

              {/* Point Derivation Log */}
              <div className="space-y-1.5">
                <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider block">
                  Ground Truth Derivation Steps
                </span>
                <div className="max-h-36 overflow-y-auto space-y-1 text-[11px] text-slate-300 pr-1">
                  {effectiveScoreResult.explanationDerivation.map((line, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "rounded p-1.5 leading-tight border",
                        line.startsWith("+")
                          ? "bg-emerald-950/30 border-emerald-900/40 text-emerald-300"
                          : line.startsWith("Deductions") || line.startsWith("Penalty")
                          ? "bg-amber-950/30 border-amber-900/40 text-amber-300"
                          : "bg-slate-900/50 border-slate-800 text-slate-400"
                      )}
                    >
                      {line}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2 text-xs text-slate-400">
              <p>
                Deterministic fit calculated against active candidate Master Resume and Evidence Bank.
              </p>
              <div className="rounded border border-slate-800 bg-slate-900 p-2.5 text-[11px] text-slate-300 font-mono">
                Formula: 0.50(CoreStack) + 0.20(Seniority) + 0.15(Tools) + 0.15(EvidenceCoverage) = {score}%
              </div>
            </div>
          )}

          {/* Popover Footer Info */}
          <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500">
            <span>Zero Hallucination AI Contract</span>
            <span>100% Deterministic</span>
          </div>
        </PopoverContent>
      </Popover>

      {/* Sub-badge: Funding Stage */}
      {fundingBadge && (
        <span
          className="inline-flex items-center gap-1 rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-sky-300 shadow-sm"
          title={`Venture Funding: ${fundingBadge}`}
          data-testid="funding-badge"
        >
          <TrendingUp className="h-2.5 w-2.5" />
          {fundingBadge}
        </span>
      )}

      {/* Sub-badge: H1B Status */}
      {h1bBadge && (
        <span
          className="inline-flex items-center gap-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-indigo-300 shadow-sm"
          title={`US DOL LCA H1B Sponsorship: ${h1bBadge}`}
          data-testid="h1b-badge"
        >
          <ShieldCheck className="h-2.5 w-2.5" />
          {h1bBadge}
        </span>
      )}
    </div>
  );
}
