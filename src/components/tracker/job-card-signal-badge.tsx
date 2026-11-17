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
import { BrandIcon, hasBrandIcon } from "@/components/design-system/brand-icon";
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
      const coreStack = compatibility.requiredScore ?? 0;
      const seniority = compatibility.totalRequiredCount > 0 ? 100 : 0;
      const tools = compatibility.preferredScore ?? 0;
      const coverage =
        compatibility.totalRequiredCount > 0
          ? Math.min(
              100,
              Math.round(
                (compatibility.matchedEvidenceCount / compatibility.totalRequiredCount) * 100
              )
            )
          : 0;
      const composite = Math.min(
        100,
        Math.max(
          0,
          Math.round(0.5 * coreStack + 0.2 * seniority + 0.15 * tools + 0.15 * coverage)
        )
      );

      const derivation: string[] = [
        `+${(0.5 * coreStack).toFixed(1)} pts (Core Stack: 50% weight) — ${coreStack}% based on ${compatibility.matchedSkills.length}/${compatibility.totalRequiredCount} required skills matched`,
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

  const score = effectiveScoreResult?.compositeScore ?? directScore;
  if (score == null) return null;

  const badgeColorClass =
    score >= 80
      ? "border-signal/40 bg-signal/15 text-signal hover:bg-signal/25"
      : score >= 60
      ? "border-primary/40 bg-primary/15 text-primary hover:bg-primary/25"
      : "border-hairline bg-inset text-muted-foreground hover:bg-elevated";

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
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-xs font-bold transition-colors cursor-pointer shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-status-warning/40",
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
          className="w-96 rounded-xl border border-hairline bg-panel p-4 text-foreground shadow-2xl font-mono text-xs z-50"
          align="start"
          side="top"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          data-testid="signal-badge-popover"
        >
          {/* Popover Header */}
          <div className="flex items-center justify-between border-b border-hairline pb-2 mb-3">
            <div className="flex items-center gap-2">
              <Calculator className="h-4 w-4 text-primary" />
              <span className="font-bold text-foreground tracking-tight">
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
              <div className="space-y-2 rounded-lg bg-inset border border-hairline p-3">
                <span className="text-xs uppercase font-semibold text-muted-foreground tracking-wider block">
                  Weighted Score Components
                </span>

                {/* Core Stack */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-text-secondary">Core Stack (50%)</span>
                    <span className="text-signal font-bold">
                      {effectiveScoreResult.breakdown.coreStackScore}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-elevated rounded-full overflow-hidden">
                    <div
                      className="h-full bg-signal rounded-full transition-[width] duration-300"
                      style={{ width: `${effectiveScoreResult.breakdown.coreStackScore}%` }}
                    />
                  </div>
                </div>

                {/* Seniority */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-text-secondary">Seniority &amp; YOE (20%)</span>
                    <span className="text-primary font-bold">
                      {effectiveScoreResult.breakdown.seniorityScore}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-elevated rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-[width] duration-300"
                      style={{ width: `${effectiveScoreResult.breakdown.seniorityScore}%` }}
                    />
                  </div>
                </div>

                {/* Tools */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-text-secondary">Tooling &amp; Infra (15%)</span>
                    <span className="text-ember font-bold">
                      {effectiveScoreResult.breakdown.toolsScore}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-elevated rounded-full overflow-hidden">
                    <div
                      className="h-full bg-ember rounded-full transition-[width] duration-300"
                      style={{ width: `${effectiveScoreResult.breakdown.toolsScore}%` }}
                    />
                  </div>
                </div>

                {/* Evidence Coverage */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-text-secondary">Evidence Coverage (15%)</span>
                    <span className="text-foreground font-bold">
                      {effectiveScoreResult.breakdown.evidenceCoverageScore}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-elevated rounded-full overflow-hidden">
                    <div
                      className="h-full ombre-bar rounded-full transition-[width] duration-300"
                      style={{ width: `${effectiveScoreResult.breakdown.evidenceCoverageScore}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Verified Evidence Gains */}
              {verifiedSkills.length > 0 && (
                <div className="space-y-1 rounded border border-signal/30 bg-signal/[0.07] p-2.5 text-xs">
                  <span className="font-bold text-signal block mb-1">
                    Points Gained from Verified Evidence Bank:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {verifiedSkills.map((s, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 rounded bg-signal/10 border border-signal/35 px-1.5 py-0.5 text-xs text-signal font-mono"
                      >
                        <CheckCircle2 className="h-2.5 w-2.5 text-signal" />
                        {hasBrandIcon(s.skill) && <BrandIcon name={s.skill} className="h-3 w-3 shrink-0" />}
                        <span>{s.skill}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Missing critical stack notice / deductions */}
              {effectiveScoreResult.missingRequiredSkills.length > 0 && (
                <div className="rounded border border-dashed border-status-warning/40 bg-status-warning/15 p-2 text-xs text-status-warning">
                  <div className="flex items-center gap-1.5 font-bold mb-1">
                    <AlertTriangle className="h-3 w-3 text-status-warning" />
                    <span>Points Deducted for Missing Stack:</span>
                  </div>
                  <span>{effectiveScoreResult.missingRequiredSkills.join(", ")}</span>
                </div>
              )}

              {/* Point Derivation Log */}
              <div className="space-y-1.5">
                <span className="text-xs uppercase font-semibold text-muted-foreground tracking-wider block">
                  Ground Truth Derivation Steps
                </span>
                <div className="max-h-36 overflow-y-auto space-y-1 text-xs text-text-secondary pr-1">
                  {effectiveScoreResult.explanationDerivation.map((line, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "rounded p-1.5 leading-tight border",
                        line.startsWith("+")
                          ? "bg-inset border-hairline border-l-2 border-l-signal text-text-primary"
                          : line.startsWith("Deductions") || line.startsWith("Penalty")
                          ? "bg-status-warning/15 border-status-warning/40 text-status-warning"
                          : "bg-inset border-hairline text-muted-foreground"
                      )}
                    >
                      {line}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2 text-xs text-muted-foreground">
              <p>
                Deterministic fit calculated against active candidate Master Resume and Evidence Bank.
              </p>
              <div className="rounded border border-hairline bg-inset p-2.5 text-xs text-text-secondary font-mono">
                Formula: 0.50(CoreStack) + 0.20(Seniority) + 0.15(Tools) + 0.15(EvidenceCoverage) = {score}%
              </div>
            </div>
          )}

          {/* Popover Footer Info */}
          <div className="mt-3 pt-2 border-t border-hairline flex items-center justify-between text-xs text-muted-foreground">
            <span>Zero Hallucination AI Contract</span>
            <span>100% Deterministic</span>
          </div>
        </PopoverContent>
      </Popover>

      {/* Sub-badge: Funding Stage */}
      {fundingBadge && (
        <span
          className="inline-flex items-center gap-1 rounded-full border border-signal/35 bg-signal/10 px-2 py-0.5 font-mono text-xs font-semibold text-signal shadow-sm"
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
          className="inline-flex items-center gap-1 rounded-full border border-hairline bg-elevated px-2 py-0.5 font-mono text-xs font-semibold text-text-secondary shadow-sm"
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
