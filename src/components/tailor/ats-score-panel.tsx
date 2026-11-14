"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  BarChart3,
  ShieldCheck,
  Briefcase,
  Layers,
  Sparkles,
  Info,
  Loader2,
} from "lucide-react";
import {
  AtsEvaluationResult,
  RoleProfile,
  ROLE_PROFILES,
  SkillMatchStatus,
} from "@/lib/ats-evaluator/types";
import { QualitativeReviewPanel } from "./qualitative-review-panel";
import { AtsQualitativeReviewResult } from "@/lib/ai/qualitative-schema";
import { resolveClientProviderConfig } from "@/lib/byok-vault";
import styles from "./ats-score-panel.module.css";

interface AtsScorePanelProps {
  typstContent: string;
  extractedRequirements: {
    requiredSkills: string[];
    preferredSkills: string[];
    domainTerms: string[];
  };
  roleTitle?: string;
  rawDescription?: string;
  /** Score against DB master resume instead of the provided typstContent. */
  useMasterResume?: boolean;
  /** Merge latest Evidence Bank into the scored document. */
  includeEvidenceBank?: boolean;
  initialProfile?: RoleProfile;
  onProfileChange?: (profile: RoleProfile) => void;
  onEvaluationComplete?: (result: AtsEvaluationResult | null) => void;
  className?: string;
  appearance?: "default" | "tailor";
}

const STATUS_BADGES: Record<
  SkillMatchStatus,
  { label: string; bg: string; text: string; border: string; icon: string }
> = {
  DEMONSTRATED_IN_EXPERIENCE: {
    label: "Demonstrated in Experience",
    bg: "bg-signal/10",
    text: "text-signal",
    border: "border-signal/35",
    icon: "✓",
  },
  LISTED_IN_SKILLS_ONLY: {
    label: "Listed in Skills Only",
    bg: "bg-primary/10",
    text: "text-primary",
    border: "border-primary/35",
    icon: "~",
  },
  UNSUPPORTED_GAP: {
    label: "Unsupported Gap",
    bg: "bg-status-danger/10",
    text: "text-status-danger",
    border: "border-status-danger/35",
    icon: "✗",
  },
};

export function AtsScorePanel({
  typstContent,
  extractedRequirements,
  roleTitle,
  rawDescription,
  useMasterResume = false,
  includeEvidenceBank = true,
  initialProfile = "Backend",
  onProfileChange,
  onEvaluationComplete,
  className = "",
  appearance = "default",
}: AtsScorePanelProps) {
  const [selectedProfile, setSelectedProfile] = useState<RoleProfile>(initialProfile);
  const evaluationProfile = appearance === "tailor" ? initialProfile : selectedProfile;
  const [result, setResult] = useState<AtsEvaluationResult | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evalError, setEvalError] = useState<string | null>(null);

  const [qualitativeResult, setQualitativeResult] = useState<AtsQualitativeReviewResult | null>(null);
  const [isLoadingQualitative, setIsLoadingQualitative] = useState(false);
  const [qualitativeError, setQualitativeError] = useState<string | null>(null);

  const onEvaluationCompleteRef = useRef(onEvaluationComplete);
  onEvaluationCompleteRef.current = onEvaluationComplete;
  const qualitativeContextRef = useRef<{ typstContent: string; useMasterResume: boolean } | null>(null);

  const evaluationRequestBody =
    !useMasterResume && !typstContent.trim()
      ? null
      : JSON.stringify({
          typstContent: typstContent || undefined,
          extractedRequirements: {
            requiredSkills: extractedRequirements.requiredSkills,
            preferredSkills: extractedRequirements.preferredSkills,
            domainTerms: extractedRequirements.domainTerms,
          },
          roleTitle,
          roleProfile: evaluationProfile,
          useMasterResume,
          includeEvidenceBank,
        });

  useEffect(() => {
    if (!evaluationRequestBody) {
      setIsEvaluating(false);
      return;
    }

    const controller = new AbortController();
    let active = true;

    setIsEvaluating(true);
    setEvalError(null);
    const prevQual = qualitativeContextRef.current;
    if (
      prevQual &&
      (prevQual.typstContent !== typstContent || prevQual.useMasterResume !== useMasterResume)
    ) {
      setQualitativeResult(null);
      setQualitativeError(null);
      qualitativeContextRef.current = null;
    }

    (async () => {
      try {
        const res = await fetch("/api/ats/evaluate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: evaluationRequestBody,
          signal: controller.signal,
        });

        const json = await res.json();
        if (!active || controller.signal.aborted) return;

        if (res.ok && json.success) {
          setResult(json.data);
          onEvaluationCompleteRef.current?.(json.data);
        } else {
          setEvalError(json.error || "Failed to calculate ATS evaluation score.");
          onEvaluationCompleteRef.current?.(null);
        }
      } catch (err) {
        if (
          !active ||
          controller.signal.aborted ||
          (err instanceof DOMException && err.name === "AbortError") ||
          (err instanceof Error && err.name === "AbortError")
        ) {
          return;
        }
        setEvalError(`Evaluation error: ${err instanceof Error ? err.message : String(err)}`);
        onEvaluationCompleteRef.current?.(null);
      } finally {
        if (active && !controller.signal.aborted) {
          setIsEvaluating(false);
        }
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [evaluationRequestBody, typstContent, useMasterResume]);

  const handleFetchQualitativeReview = async () => {
    if (!result) return;

    const aiSettings = await resolveClientProviderConfig();

    if (!aiSettings) {
      setQualitativeError("No AI provider configured. Please configure your API key in Settings.");
      return;
    }

    setIsLoadingQualitative(true);
    setQualitativeError(null);

    try {
      const res = await fetch("/api/ai/qualitative-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerConfig: {
            provider: aiSettings.provider,
            apiKey: aiSettings.apiKey,
            baseUrl: aiSettings.baseUrl || undefined,
            model: aiSettings.model || undefined,
          },
          typstContent,
          jobRequirements: {
            requiredSkills: extractedRequirements.requiredSkills,
            preferredSkills: extractedRequirements.preferredSkills,
            domainTerms: extractedRequirements.domainTerms,
            roleTitle: roleTitle || undefined,
          },
          rawDescription: rawDescription || undefined,
          deterministicResult: result,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        setQualitativeError(json.error || "Failed to generate qualitative review.");
        setQualitativeResult(null);
      } else {
        qualitativeContextRef.current = { typstContent, useMasterResume };
        setQualitativeResult(json.data);
      }
    } catch (err) {
      setQualitativeError(`Error generating review: ${err instanceof Error ? err.message : String(err)}`);
      setQualitativeResult(null);
    } finally {
      setIsLoadingQualitative(false);
    }
  };

  const handleSelectProfile = (profile: RoleProfile) => {
    setSelectedProfile(profile);
    onProfileChange?.(profile);
  };

  if (!useMasterResume && !typstContent.trim()) {
    return null;
  }

  const overallPct = Math.max(0, Math.min(100, result?.overallScore || 0));
  const gradeLabel =
    overallPct >= 80 ? "Strong" : overallPct >= 60 ? "Solid" : "Needs work";

  return (
    <div
      className={`@container bg-panel border border-hairline rounded-[10px] p-6 shadow-lg space-y-6 min-w-0 ${appearance === "tailor" ? styles.tailor : ""} ${className}`}
      data-testid="ats-score-panel"
    >
      {/* Header & Overall Match Meter — Ember Ink ATS Grade ring + summary */}
      <div className="flex flex-col gap-4 border-b border-hairline pb-6">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground flex flex-wrap items-center gap-2">
            <BarChart3 className="h-5 w-5 shrink-0 text-signal" />
            <span>ATS Grade</span>
            <span className={`text-[10px] font-mono bg-signal/10 text-signal border border-signal/30 px-2 py-0.5 rounded-full whitespace-nowrap ${styles.engineBadge}`}>
              Deterministic Engine
            </span>
          </h2>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            {appearance === "tailor" ? "See how your resume aligns with this job and where evidence is missing." : "Rule-based evaluation of tailored ResumeVariant against job description & role overlay"}
          </p>
        </div>

        {result && (
          <div className={`flex flex-col @md:flex-row @md:items-center justify-between gap-4 min-w-0 ${styles.scoreSummary}`}>
            <div
              data-testid="overall-score-badge"
              className={`px-4 py-3 rounded-[10px] border border-hairline bg-inset flex items-center gap-4 min-w-0 ${styles.scoreBadge}`}
            >
              <div
                data-testid="ats-overall-score"
                className="relative grid h-[72px] w-[72px] shrink-0 place-items-center rounded-full"
                style={{
                  background: `conic-gradient(rgb(var(--accent-contrast)) ${overallPct}%, rgb(214 196 176 / 0.14) 0)`,
                  filter: "drop-shadow(0 0 14px rgb(var(--accent-contrast) / 0.35))",
                }}
              >
                <div className="grid h-[58px] w-[58px] place-items-center rounded-full bg-panel font-sans text-[22px] font-bold tracking-[-0.03em] tabular-nums text-foreground">
                  {result.overallScore}
                </div>
              </div>
              <div className="min-w-0">
                <span className="block text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                  Overall Match · {gradeLabel}
                </span>
                <div className={`text-2xl font-bold tracking-tight font-mono tabular-nums leading-tight text-foreground ${styles.scoreValue}`}>
                  {result.overallScore} <span className="text-sm font-normal text-muted-foreground">/ 100</span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground truncate">
                  vs. {roleTitle || `${result.selectedProfile} profile`}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleFetchQualitativeReview}
              disabled={isLoadingQualitative || !result}
              data-testid="get-ai-feedback-btn"
              className={`px-4 py-3 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground btn-glow font-semibold text-xs rounded-[8px] flex items-center justify-center gap-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background @md:shrink-0 ${styles.feedback}`}
            >
              {isLoadingQualitative ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating Feedback...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Get AI Feedback
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Interactive Role Profile Selector */}
      {appearance !== "tailor" && <div className="space-y-2">
        <label className="block text-xs font-semibold text-on-surface-variant flex items-center gap-2">
          <Layers className="h-3.5 w-3.5 text-primary" />
          Target Role Profile Weighting
        </label>
        <div className="flex flex-wrap gap-2" data-testid="role-profile-selector">
          {ROLE_PROFILES.map((profile) => {
            const isSelected = selectedProfile === profile;
            return (
              <button
                key={profile}
                type="button"
                onClick={() => handleSelectProfile(profile)}
                aria-pressed={isSelected}
                data-testid={`profile-btn-${profile}`}
                className={`px-3 py-1.5 rounded-[6px] text-xs transition flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                  isSelected
                    ? "bg-primary text-primary-foreground font-semibold border border-primary"
                    : "bg-inset hover:bg-elevated text-on-surface-variant border border-border font-normal"
                }`}
              >
                {isSelected && <Sparkles className="h-3 w-3" />}
                {profile}
              </button>
            );
          })}
        </div>
      </div>}

      {evalError && (
        <div className="p-3 bg-status-danger/10 border border-status-danger/40 rounded-[6px] flex items-center gap-2 text-xs text-status-danger">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{evalError}</span>
        </div>
      )}

      {/* 4 Rubric Category Breakdown Cards */}
      {result && (
        <div className={`grid grid-cols-1 gap-3 ${styles.categories}`} data-testid="category-breakdown-grid">
          {/* Category 1: Base Resume Health (30 pts) */}
          <div className="bg-inset border border-hairline rounded-[10px] p-4 space-y-3 min-w-0">
            <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5 min-w-0">
                <ShieldCheck className="h-4 w-4 shrink-0 text-signal" />
                <span className="break-words">Base Resume Health</span>
              </span>
              <span className="text-xs font-mono font-semibold tabular-nums text-foreground shrink-0">
                {result.baseHealth.score} / {result.baseHealth.maxScore} pts
              </span>
            </div>
            <div className="w-full bg-panel h-1.5 rounded-full overflow-hidden">
              <div
                className={`${result.baseHealth.percentage >= 75 ? "bg-signal" : "bg-primary"} h-full rounded-full transition-all`}
                style={{ width: `${result.baseHealth.percentage}%` }}
              />
            </div>
            <ul className="text-xs space-y-1.5 text-on-surface-variant leading-relaxed break-words">
              {result.baseHealth.findings.map((f, idx) => (
                <li
                  key={`base-${idx}`}
                  className={
                    f.startsWith("Penalized:")
                      ? "text-status-danger font-bold"
                      : f.startsWith("Warning:")
                      ? "text-status-warning"
                      : "text-on-surface-variant"
                  }
                >
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* Category 2: Required Role Match (40 pts) */}
          <div className="bg-inset border border-hairline rounded-[10px] p-4 space-y-3 min-w-0">
            <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5 min-w-0">
                <Briefcase className="h-4 w-4 shrink-0 text-signal" />
                <span className="break-words">Required Role Match</span>
              </span>
              <span className="text-xs font-mono font-semibold tabular-nums text-foreground shrink-0">
                {result.requiredMatch.score} / {result.requiredMatch.maxScore} pts
              </span>
            </div>
            <div className="w-full bg-panel h-1.5 rounded-full overflow-hidden">
              <div
                className={`${result.requiredMatch.percentage >= 75 ? "bg-signal" : "bg-primary"} h-full rounded-full transition-all`}
                style={{ width: `${result.requiredMatch.percentage}%` }}
              />
            </div>
            <ul className="text-xs space-y-1.5 text-on-surface-variant leading-relaxed break-words">
              {result.requiredMatch.findings.slice(0, 5).map((f, idx) => (
                <li key={`req-${idx}`}>{f}</li>
              ))}
            </ul>
          </div>

          {/* Category 3: Preferred Match (15 pts) */}
          <div className="bg-inset border border-hairline rounded-[10px] p-4 space-y-3 min-w-0">
            <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5 min-w-0">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                <span className="break-words">Preferred Match</span>
              </span>
              <span className="text-xs font-mono font-semibold tabular-nums text-foreground shrink-0">
                {result.preferredMatch.score} / {result.preferredMatch.maxScore} pts
              </span>
            </div>
            <div className="w-full bg-panel h-1.5 rounded-full overflow-hidden">
              <div
                className={`${result.preferredMatch.percentage >= 75 ? "bg-signal" : "bg-primary"} h-full rounded-full transition-all`}
                style={{ width: `${result.preferredMatch.percentage}%` }}
              />
            </div>
            <ul className="text-xs space-y-1.5 text-on-surface-variant leading-relaxed break-words">
              {result.preferredMatch.findings.slice(0, 5).map((f, idx) => (
                <li key={`pref-${idx}`}>{f}</li>
              ))}
            </ul>
          </div>

          {/* Category 4: Role-Relevant Evidence (15 pts) */}
          <div className="bg-inset border border-hairline rounded-[10px] p-4 space-y-3 min-w-0">
            <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5 min-w-0">
                <Layers className="h-4 w-4 shrink-0 text-signal" />
                <span className="break-words">Role-Relevant Evidence ({result.selectedProfile})</span>
              </span>
              <span className="text-xs font-mono font-semibold tabular-nums text-foreground shrink-0">
                {result.roleEvidence.score} / {result.roleEvidence.maxScore} pts
              </span>
            </div>
            <div className="w-full bg-panel h-1.5 rounded-full overflow-hidden">
              <div
                className={`${result.roleEvidence.percentage >= 75 ? "bg-signal" : "bg-primary"} h-full rounded-full transition-all`}
                style={{ width: `${result.roleEvidence.percentage}%` }}
              />
            </div>
            <ul className="text-xs space-y-1.5 text-on-surface-variant leading-relaxed break-words">
              {result.roleEvidence.findings.map((f, idx) => (
                <li key={`role-${idx}`}>{f}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Per-Skill Evidence Status Breakdown */}
      {result && result.skillEvaluations.length > 0 && (
        <div className="space-y-3 border-t border-border pt-5">
          <h3 className="text-xs font-semibold text-foreground flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            Skill Demonstration Status Tracing (<span className="tabular-nums">{result.skillEvaluations.length}</span> skills)
          </h3>
          <div className="grid grid-cols-1 gap-2" data-testid="skill-evaluations-list">
            {result.skillEvaluations.map((se, idx) => {
              const badge = STATUS_BADGES[se.status];
              return (
                <div
                  key={`se-${idx}`}
                  data-testid="skill-evaluation-item"
                  className="bg-inset border border-border rounded-[6px] p-3 flex flex-col items-start gap-2 text-xs min-w-0"
                >
                  <div className="min-w-0 w-full">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="font-semibold text-foreground break-words">{se.skill}</span>
                      <span className="text-[10px] text-muted-foreground uppercase font-mono">
                        ({se.category})
                      </span>
                    </div>
                    {se.matchedContext && (
                      <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed break-words">
                        {se.matchedContext}
                      </p>
                    )}
                  </div>
                  <span
                    data-testid={`status-badge-${se.skill}`}
                    className={`w-fit max-w-full px-2 py-0.5 rounded text-[10px] font-semibold border inline-flex items-center gap-1 whitespace-normal ${badge.bg} ${badge.text} ${badge.border}`}
                  >
                    <span>{badge.icon}</span> {badge.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Truthful Actionable Gaps Guidance Panel — Ember Ink Urgent / Non-urgent issue cards */}
      {result && result.gaps.length > 0 && (
        <div className="bg-panel border border-hairline rounded-[10px] p-4 space-y-3" data-testid="actionable-gaps-panel">
          <h3 className="text-xs font-semibold text-primary flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-primary" />
            Actionable Gaps Guidance (Truthful Recommendations)
          </h3>
          <p className="text-xs text-muted-foreground">
            Recommendations point to real, verifiable evidence additions or formatting improvements. No keyword stuffing or hidden text.
          </p>
          <ul className="space-y-2 text-xs text-on-surface-variant leading-relaxed">
            {result.gaps.map((gap, idx) => {
              const isUrgent =
                gap.startsWith("Missing required") || gap.startsWith("Penalized:");
              return (
                <li
                  key={`gap-${idx}`}
                  className="flex items-start gap-2.5 rounded-[8px] border border-hairline bg-inset p-2.5 min-w-0"
                >
                  <span
                    className={`shrink-0 rounded-[5px] border px-1.5 py-0.5 text-[10.5px] font-semibold ${
                      isUrgent
                        ? "border-status-danger/40 bg-status-danger/10 text-status-danger"
                        : "border-primary/40 bg-primary/10 text-primary"
                    }`}
                  >
                    {isUrgent ? "Urgent" : "Non-urgent"}
                  </span>
                  <span className="min-w-0 break-words text-text-secondary">{gap}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {qualitativeError && (
        <div className="p-3 bg-status-danger/10 border border-status-danger/40 rounded-[6px] flex items-center gap-2 text-xs text-status-danger" data-testid="qualitative-error-banner">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{qualitativeError}</span>
        </div>
      )}

      {qualitativeResult && result && (
        <div className="border-t border-border pt-6">
          <QualitativeReviewPanel
            result={qualitativeResult}
            deterministicScore={result.overallScore}
          />
        </div>
      )}
    </div>
  );
}
