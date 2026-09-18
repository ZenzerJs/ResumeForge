"use client";

import React, { useState, useEffect, useCallback } from "react";
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
  className?: string;
}

const STATUS_BADGES: Record<
  SkillMatchStatus,
  { label: string; bg: string; text: string; border: string; icon: string }
> = {
  DEMONSTRATED_IN_EXPERIENCE: {
    label: "Demonstrated in Experience",
    bg: "bg-emerald-950/80",
    text: "text-emerald-300",
    border: "border-emerald-800/80",
    icon: "✓",
  },
  LISTED_IN_SKILLS_ONLY: {
    label: "Listed in Skills Only",
    bg: "bg-amber-950/80",
    text: "text-amber-300",
    border: "border-amber-800/80",
    icon: "~",
  },
  UNSUPPORTED_GAP: {
    label: "Unsupported Gap",
    bg: "bg-red-950/80",
    text: "text-red-300",
    border: "border-red-800/80",
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
  className = "",
}: AtsScorePanelProps) {
  const [selectedProfile, setSelectedProfile] = useState<RoleProfile>(initialProfile);
  const [result, setResult] = useState<AtsEvaluationResult | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evalError, setEvalError] = useState<string | null>(null);

  const [qualitativeResult, setQualitativeResult] = useState<AtsQualitativeReviewResult | null>(null);
  const [isLoadingQualitative, setIsLoadingQualitative] = useState(false);
  const [qualitativeError, setQualitativeError] = useState<string | null>(null);

  const runEvaluation = useCallback(async (profile: RoleProfile) => {
    if (!useMasterResume && !typstContent.trim()) return;

    setIsEvaluating(true);
    setEvalError(null);
    setQualitativeResult(null);
    setQualitativeError(null);

    try {
      const res = await fetch("/api/ats/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          typstContent: typstContent || undefined,
          extractedRequirements,
          roleTitle,
          roleProfile: profile,
          useMasterResume,
          includeEvidenceBank,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setResult(json.data);
      } else {
        setEvalError(json.error || "Failed to calculate ATS evaluation score.");
      }
    } catch (err) {
      setEvalError(`Evaluation error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsEvaluating(false);
    }
  }, [typstContent, extractedRequirements, roleTitle, useMasterResume, includeEvidenceBank]);

  useEffect(() => {
    runEvaluation(selectedProfile);
  }, [runEvaluation, selectedProfile]);

  const handleFetchQualitativeReview = async () => {
    if (!result) return;

    let aiSettings;
    try {
      const stored = localStorage.getItem("resumeforge_ai_settings");
      aiSettings = stored ? JSON.parse(stored) : null;
    } catch {
      aiSettings = null;
    }

    if (!aiSettings?.provider || !aiSettings?.apiKey) {
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

  const scoreColor =
    (result?.overallScore || 0) >= 80
      ? "text-emerald-400 border-emerald-500/40 bg-emerald-950/30"
      : (result?.overallScore || 0) >= 60
      ? "text-amber-400 border-amber-500/40 bg-amber-950/30"
      : "text-red-400 border-red-500/40 bg-red-950/30";

  return (
    <div
      className={`@container bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg space-y-6 min-w-0 ${className}`}
      data-testid="ats-score-panel"
    >
      {/* Header & Overall Match Meter — stacked in the Tailor sidebar */}
      <div className="flex flex-col gap-4 border-b border-slate-800 pb-6">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-white flex flex-wrap items-center gap-2">
            <BarChart3 className="h-5 w-5 shrink-0 text-amber-400" />
            <span>ATS Quality Score</span>
            <span className="text-[10px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full whitespace-nowrap">
              Deterministic Engine
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            Rule-based evaluation of tailored ResumeVariant against job description & role overlay
          </p>
        </div>

        {result && (
          <div className="flex flex-col @md:flex-row @md:items-stretch gap-3 min-w-0">
            <div
              data-testid="overall-score-badge"
              className={`px-4 py-3 rounded-2xl border flex flex-col items-start justify-center min-w-0 ${scoreColor}`}
            >
              <span className="text-[10px] uppercase tracking-wider font-semibold opacity-80">
                Overall Match
              </span>
              <div className="text-3xl font-extrabold tracking-tight font-mono leading-tight">
                {result.overallScore} <span className="text-sm font-normal text-slate-400">/ 100</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleFetchQualitativeReview}
              disabled={isLoadingQualitative || !result}
              data-testid="get-ai-feedback-btn"
              className="px-4 py-3 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-amber-600/20 transition @md:shrink-0"
            >
              {isLoadingQualitative ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating Feedback...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 text-amber-200" />
                  Get AI Feedback
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Interactive Role Profile Selector */}
      <div className="space-y-2">
        <label className="block text-xs font-semibold text-slate-300 flex items-center gap-2">
          <Layers className="h-3.5 w-3.5 text-amber-400" />
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
                data-testid={`profile-btn-${profile}`}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                  isSelected
                    ? "bg-amber-500 text-slate-950 font-semibold shadow-md shadow-amber-500/20 border border-amber-400"
                    : "bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800"
                }`}
              >
                {isSelected && <Sparkles className="h-3 w-3 text-slate-950" />}
                {profile}
              </button>
            );
          })}
        </div>
      </div>

      {evalError && (
        <div className="p-3 bg-red-950/50 border border-red-800/50 rounded-lg flex items-center gap-2 text-xs text-red-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{evalError}</span>
        </div>
      )}

      {/* 4 Rubric Category Breakdown Cards */}
      {result && (
        <div className="grid grid-cols-1 gap-3" data-testid="category-breakdown-grid">
          {/* Category 1: Base Resume Health (30 pts) */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3 min-w-0">
            <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
              <span className="text-xs font-semibold text-white flex items-center gap-1.5 min-w-0">
                <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400" />
                <span className="break-words">Base Resume Health</span>
              </span>
              <span className="text-xs font-mono font-bold text-slate-200 shrink-0">
                {result.baseHealth.score} / {result.baseHealth.maxScore} pts
              </span>
            </div>
            <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full transition-all"
                style={{ width: `${result.baseHealth.percentage}%` }}
              />
            </div>
            <ul className="text-xs space-y-1.5 text-slate-300 leading-relaxed break-words">
              {result.baseHealth.findings.map((f, idx) => (
                <li
                  key={`base-${idx}`}
                  className={
                    f.startsWith("Penalized:")
                      ? "text-red-400 font-bold"
                      : f.startsWith("Warning:")
                      ? "text-amber-300"
                      : "text-slate-300"
                  }
                >
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* Category 2: Required Role Match (40 pts) */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3 min-w-0">
            <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
              <span className="text-xs font-semibold text-white flex items-center gap-1.5 min-w-0">
                <Briefcase className="h-4 w-4 shrink-0 text-amber-400" />
                <span className="break-words">Required Role Match</span>
              </span>
              <span className="text-xs font-mono font-bold text-slate-200 shrink-0">
                {result.requiredMatch.score} / {result.requiredMatch.maxScore} pts
              </span>
            </div>
            <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-amber-500 h-full transition-all"
                style={{ width: `${result.requiredMatch.percentage}%` }}
              />
            </div>
            <ul className="text-xs space-y-1.5 text-slate-300 leading-relaxed break-words">
              {result.requiredMatch.findings.slice(0, 5).map((f, idx) => (
                <li key={`req-${idx}`}>{f}</li>
              ))}
            </ul>
          </div>

          {/* Category 3: Preferred Match (15 pts) */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3 min-w-0">
            <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
              <span className="text-xs font-semibold text-white flex items-center gap-1.5 min-w-0">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-amber-400" />
                <span className="break-words">Preferred Match</span>
              </span>
              <span className="text-xs font-mono font-bold text-slate-200 shrink-0">
                {result.preferredMatch.score} / {result.preferredMatch.maxScore} pts
              </span>
            </div>
            <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-amber-500 h-full transition-all"
                style={{ width: `${result.preferredMatch.percentage}%` }}
              />
            </div>
            <ul className="text-xs space-y-1.5 text-slate-300 leading-relaxed break-words">
              {result.preferredMatch.findings.slice(0, 5).map((f, idx) => (
                <li key={`pref-${idx}`}>{f}</li>
              ))}
            </ul>
          </div>

          {/* Category 4: Role-Relevant Evidence (15 pts) */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3 min-w-0">
            <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
              <span className="text-xs font-semibold text-white flex items-center gap-1.5 min-w-0">
                <Layers className="h-4 w-4 shrink-0 text-purple-400" />
                <span className="break-words">Role-Relevant Evidence ({result.selectedProfile})</span>
              </span>
              <span className="text-xs font-mono font-bold text-slate-200 shrink-0">
                {result.roleEvidence.score} / {result.roleEvidence.maxScore} pts
              </span>
            </div>
            <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-purple-500 h-full transition-all"
                style={{ width: `${result.roleEvidence.percentage}%` }}
              />
            </div>
            <ul className="text-xs space-y-1.5 text-slate-300 leading-relaxed break-words">
              {result.roleEvidence.findings.map((f, idx) => (
                <li key={`role-${idx}`}>{f}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Per-Skill Evidence Status Breakdown */}
      {result && result.skillEvaluations.length > 0 && (
        <div className="space-y-3 border-t border-slate-800 pt-5">
          <h3 className="text-xs font-semibold text-white flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-amber-400" />
            Skill Demonstration Status Tracing ({result.skillEvaluations.length} skills)
          </h3>
          <div className="grid grid-cols-1 gap-2" data-testid="skill-evaluations-list">
            {result.skillEvaluations.map((se, idx) => {
              const badge = STATUS_BADGES[se.status];
              return (
                <div
                  key={`se-${idx}`}
                  data-testid="skill-evaluation-item"
                  className="bg-slate-950 border border-slate-800 rounded-lg p-3 flex flex-col items-start gap-2 text-xs min-w-0"
                >
                  <div className="min-w-0 w-full">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="font-semibold text-slate-100 break-words">{se.skill}</span>
                      <span className="text-[10px] text-slate-500 uppercase font-mono">
                        ({se.category})
                      </span>
                    </div>
                    {se.matchedContext && (
                      <p className="text-[11px] text-slate-400 mt-1 leading-relaxed break-words">
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

      {/* Truthful Actionable Gaps Guidance Panel */}
      {result && result.gaps.length > 0 && (
        <div className="bg-amber-950/20 border border-amber-900/40 rounded-xl p-4 space-y-3" data-testid="actionable-gaps-panel">
          <h3 className="text-xs font-semibold text-amber-300 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            Actionable Gaps Guidance (Truthful Recommendations)
          </h3>
          <p className="text-xs text-slate-400">
            Recommendations point to real, verifiable evidence additions or formatting improvements. No keyword stuffing or hidden text.
          </p>
          <ul className="space-y-2 text-xs text-amber-200/90 leading-relaxed">
            {result.gaps.map((gap, idx) => (
              <li key={`gap-${idx}`} className="flex items-start gap-2 min-w-0">
                <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-400" />
                <span className="min-w-0 break-words">{gap}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {qualitativeError && (
        <div className="p-3 bg-red-950/50 border border-red-800/50 rounded-lg flex items-center gap-2 text-xs text-red-300" data-testid="qualitative-error-banner">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{qualitativeError}</span>
        </div>
      )}

      {qualitativeResult && result && (
        <div className="border-t border-slate-800 pt-6">
          <QualitativeReviewPanel
            result={qualitativeResult}
            deterministicScore={result.overallScore}
          />
        </div>
      )}
    </div>
  );
}
