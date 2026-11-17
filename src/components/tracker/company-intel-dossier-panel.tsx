"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Building2,
  Sparkles,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  Clock,
  ThumbsUp,
  ThumbsDown,
  CheckCircle2,
  Cpu,
  Layers,
  HelpCircle,
  Award,
} from "lucide-react";
import { normalizeCompany } from "@/lib/company";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { isSafeHref } from "@/lib/security/safe-url";
import { resolveClientProviderConfig } from "@/lib/byok-vault";
import { fetchDemoConfig } from "@/components/auth/session-user";
import { readApiResponse } from "@/lib/api-error";

export interface CompanyDossierData {
  id?: string;
  companySlug: string;
  displayName: string;
  interviewStyle?: {
    format?: "LeetCode Heavy" | "Practical / Systems" | "Take-home Project" | "Behavioral / Values Driven";
    primaryEvaluationCriteria?: string[];
    roundBreakdown?: string[];
    proTips?: string[];
  } | null;
  cultureMetrics?: {
    workLifeBalanceRating?: number;
    deploymentVelocity?: string;
    remoteCulture?: string;
    pros?: string[];
    cons?: string[];
  } | null;
  recentSignals?: string | null;
  referenceNotes?: string | null;
  processNotes?: string | null;
  isWhiteboardFree?: boolean;
  source?: "seed" | "llm" | "seed+llm" | string;
  lastUpdated?: string | Date;
}

interface CompanyIntelDossierPanelProps {
  company: string;
  jobTitle?: string;
  className?: string;
}

export function CompanyIntelDossierPanel({
  company,
  jobTitle,
  className,
}: CompanyIntelDossierPanelProps) {
  const [dossier, setDossier] = useState<CompanyDossierData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasAttemptedFetch, setHasAttemptedFetch] = useState(false);

  const slug = normalizeCompany(company);

  const fetchDossier = useCallback(async (signal?: AbortSignal) => {
    if (!slug) return;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/companies/${encodeURIComponent(slug)}/dossier`, { signal });
      const { ok, data: json } = await readApiResponse<{
        found?: boolean;
        dossier?: CompanyDossierData;
        stale?: boolean;
      }>(res);
      if (signal?.aborted) return;
      if (ok && json?.found && json.dossier) {
        setDossier(json.dossier);
        setIsStale(Boolean(json.stale));
      } else {
        setDossier(null);
      }
    } catch (err) {
      if (signal?.aborted || (err instanceof Error && err.name === "AbortError")) return;
      setDossier(null);
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
        setHasAttemptedFetch(true);
      }
    }
  }, [slug]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchDossier(controller.signal);
    return () => controller.abort();
  }, [fetchDossier]);

  const handleGenerate = async () => {
    if (!slug) return;
    setIsGenerating(true);
    setErrorMessage(null);

    try {
      const demoConfig = await fetchDemoConfig();
      if (demoConfig?.demoMode) {
        setErrorMessage("Company dossier generation requires a signed-in account. Public demo mode is read-only for server-saved dossiers.");
        return;
      }

      const providerConfig = (await resolveClientProviderConfig()) || undefined;
      const res = await fetch(`/api/companies/${encodeURIComponent(slug)}/dossier/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: company,
          jobTitle,
          providerConfig,
        }),
      });
      const { ok, data: json, error } = await readApiResponse<{
        found?: boolean;
        dossier?: CompanyDossierData;
      }>(res, "Failed to generate company dossier. Please check your AI API key.");
      if (ok && json?.found && json.dossier) {
        setDossier(json.dossier);
        setIsStale(false);
      } else {
        setErrorMessage(error || "Failed to generate company dossier. Please check your AI API key.");
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Network error during dossier generation.");
    } finally {
      setIsGenerating(false);
    }
  };

  const getFormatBadgeStyle = (format?: string) => {
    switch (format) {
      case "Practical / Systems":
        return "border-status-success/45 bg-status-success/15 text-status-success-soft";
      case "Take-home Project":
        return "border-sky-500/60 bg-sky-950/40 text-sky-300";
      case "Behavioral / Values Driven":
        return "border-purple-500/60 bg-purple-950/40 text-purple-300";
      case "LeetCode Heavy":
      default:
        return "border-amber-500/60 bg-amber-950/40 text-amber-300";
    }
  };

  const calculateDaysAgo = (dateStr?: string | Date) => {
    if (!dateStr) return 0;
    const diffMs = Date.now() - new Date(dateStr).getTime();
    return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  };

  if (!company) {
    return (
      <div className="p-6 text-center text-muted-foreground border border-hairline rounded-lg bg-inset/70">
        <Building2 className="size-8 mx-auto mb-2 text-muted-foreground/60" />
        <p className="text-xs">No company specified for this job record.</p>
      </div>
    );
  }

  if (isLoading && !hasAttemptedFetch) {
    return (
      <div className="space-y-4 p-6 animate-pulse">
        <div className="h-6 w-1/3 bg-elevated rounded" />
        <div className="h-24 bg-elevated/60 rounded-lg" />
        <div className="h-32 bg-elevated/60 rounded-lg" />
      </div>
    );
  }

  // If dossier has neither synthesized JSON nor seed notes
  const hasSubstantialIntel =
    dossier?.interviewStyle ||
    dossier?.cultureMetrics ||
    dossier?.recentSignals ||
    dossier?.processNotes ||
    dossier?.referenceNotes;

  if (!hasSubstantialIntel && !isGenerating) {
    return (
      <div
        data-testid="dossier-empty-state"
        className={cn(
          "rounded-xl border border-hairline bg-inset/70 p-6 text-center space-y-4",
          className
        )}
      >
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-400">
          <Building2 className="size-6" />
        </div>

        <div className="space-y-1">
          <h3 className="text-sm font-bold text-foreground">
            Company Intelligence for {company}
          </h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Generate an engineering dossier covering real interview formats, evaluation criteria, WLB metrics, and culture signals.
          </p>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center justify-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div>
          <button
            type="button"
            onClick={handleGenerate}
            data-testid="generate-dossier-btn"
            className="inline-flex items-center gap-2 rounded-lg bg-status-success px-4 py-2 text-xs font-semibold text-contrast-ink shadow-md hover:bg-status-success/90 transition"
          >
            <Sparkles className="size-3.5" />
            <span>⚡ Generate Company Intel with AI</span>
          </button>
        </div>

        <p className="text-xs text-muted-foreground">
          Uses your configured LLM API key. Never fires automatically to conserve your tokens.
        </p>
      </div>
    );
  }

  if (isGenerating) {
    return (
      <div className="space-y-4 p-8 rounded-xl border border-hairline bg-inset/70 text-center">
        <RefreshCw className="size-7 mx-auto text-status-success animate-spin" />
        <div className="space-y-1">
          <h3 className="text-xs font-bold text-foreground">Synthesizing Company Intel for {company}...</h3>
          <p className="text-xs text-muted-foreground">
            Analyzing interview loops, evaluation criteria, deployment velocity, and engineering culture.
          </p>
        </div>
      </div>
    );
  }

  const interview = dossier?.interviewStyle;
  const culture = dossier?.cultureMetrics;
  const daysAgo = calculateDaysAgo(dossier?.lastUpdated);
  const keyValuesUrl = `https://www.keyvalues.com/search?query=${encodeURIComponent(company)}`;

  return (
    <div data-testid="company-dossier-container" className={cn("space-y-6 text-xs", className)}>
      {/* Top Banner & Whiteboard Status */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-lg border border-hairline bg-inset/80">
        <div className="flex items-center gap-2.5">
          <Building2 className="size-4 text-primary shrink-0" />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-foreground">{dossier?.displayName || company}</span>
              {dossier?.isWhiteboardFree && (
                <Badge
                  variant="outline"
                  data-testid="badge-whiteboard-free"
                  className="border-status-success/45 bg-status-success/15 text-status-success-soft text-xs font-semibold gap-1"
                >
                  <CheckCircle2 className="size-3 text-status-success" />
                  <span>✓ No Whiteboard Trivia — per Hiring Without Whiteboards</span>
                </Badge>
              )}
            </div>
            {dossier?.processNotes && (
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{dossier.processNotes}</p>
            )}
          </div>
        </div>

        {interview?.format && (
          <Badge variant="outline" className={cn("text-xs font-semibold px-2 py-0.5", getFormatBadgeStyle(interview.format))}>
            {interview.format}
          </Badge>
        )}
      </div>

      {/* SECTION 1: What They Like Testing */}
      <div className="space-y-3">
        <h3 className="font-semibold uppercase tracking-wider text-status-success flex items-center gap-1.5">
          <Cpu className="size-3.5 text-status-success" /> What They Like Testing
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Evaluation Criteria */}
          {interview?.primaryEvaluationCriteria && interview.primaryEvaluationCriteria.length > 0 && (
            <div className="p-3.5 rounded-lg border border-hairline bg-inset/70 space-y-2">
              <span className="font-semibold text-text-secondary text-xs block">Primary Evaluation Criteria</span>
              <div className="flex flex-wrap gap-1.5">
                {interview.primaryEvaluationCriteria.map((crit, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 rounded bg-elevated text-foreground border border-hairline text-xs"
                  >
                    {crit}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Round Breakdown Timeline */}
          {interview?.roundBreakdown && interview.roundBreakdown.length > 0 && (
            <div className="p-3.5 rounded-lg border border-hairline bg-inset/70 space-y-2">
              <span className="font-semibold text-text-secondary text-xs block">Interview Round Breakdown</span>
              <div className="space-y-1.5">
                {interview.roundBreakdown.map((round, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-text-secondary">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-status-success/15 text-status-success-soft border border-status-success/35 text-xs font-bold">
                      {idx + 1}
                    </span>
                    <span className="leading-snug">{round}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 2: Engineering Culture & Vibe */}
      {culture && (
        <div className="space-y-3">
          <h3 className="font-semibold uppercase tracking-wider text-status-success flex items-center gap-1.5">
            <Layers className="size-3.5 text-status-success" /> Engineering Culture &amp; Vibe
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-lg border border-hairline bg-inset/70 space-y-1">
              <span className="text-xs text-muted-foreground uppercase font-semibold block">Work-Life Balance</span>
              <div className="flex items-center gap-1.5">
                <span className="text-base font-bold text-primary">
                  {culture.workLifeBalanceRating ? `${culture.workLifeBalanceRating}/5` : "3.8/5 (est.)"}
                </span>
                <span className="text-xs text-muted-foreground font-mono">rating</span>
              </div>
            </div>

            <div className="p-3 rounded-lg border border-hairline bg-inset/70 space-y-1">
              <span className="text-xs text-muted-foreground uppercase font-semibold block">Deploy Velocity</span>
              <span className="text-xs font-semibold text-foreground block truncate">
                {culture.deploymentVelocity || "Continuous / Daily (est.)"}
              </span>
            </div>

            <div className="p-3 rounded-lg border border-hairline bg-inset/70 space-y-1">
              <span className="text-xs text-muted-foreground uppercase font-semibold block">Remote Policy</span>
              <span className="text-xs font-semibold text-foreground block truncate">
                {culture.remoteCulture || "Hybrid (est.)"}
              </span>
            </div>
          </div>

          {/* Pros and Cons */}
          {((culture.pros && culture.pros.length > 0) || (culture.cons && culture.cons.length > 0)) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {culture.pros && culture.pros.length > 0 && (
                <div className="p-3 rounded-lg border border-status-success/30 bg-status-success/10 space-y-1.5">
                  <span className="font-semibold text-status-success text-xs flex items-center gap-1">
                    <ThumbsUp className="size-3" /> Cultural Strengths
                  </span>
                  <div className="space-y-1">
                    {culture.pros.map((pro, idx) => (
                      <div key={idx} className="flex items-start gap-1.5 text-text-secondary text-xs">
                        <span className="text-status-success font-bold">+</span>
                        <span>{pro}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {culture.cons && culture.cons.length > 0 && (
                <div className="p-3 rounded-lg border border-rose-900/30 bg-rose-950/20 space-y-1.5">
                  <span className="font-semibold text-rose-400 text-xs flex items-center gap-1">
                    <ThumbsDown className="size-3" /> Considerations &amp; Trade-offs
                  </span>
                  <div className="space-y-1">
                    {culture.cons.map((con, idx) => (
                      <div key={idx} className="flex items-start gap-1.5 text-text-secondary text-xs">
                        <span className="text-rose-400 font-bold">−</span>
                        <span>{con}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* SECTION 3: Pro-Tips & Recent Signals */}
      <div className="space-y-3">
        <h3 className="font-semibold uppercase tracking-wider text-status-success flex items-center gap-1.5">
          <Award className="size-3.5 text-status-success" /> Pro-Tips &amp; Recent Hiring Signals
        </h3>

        {interview?.proTips && interview.proTips.length > 0 && (
          <div className="space-y-1.5">
            {interview.proTips.map((tip, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded-lg border border-amber-900/40 bg-amber-950/20 text-text-secondary text-xs italic"
              >
                &ldquo;{tip}&rdquo;
              </div>
            ))}
          </div>
        )}

        {dossier?.recentSignals && (
          <div className="p-3.5 rounded-lg border border-hairline bg-inset/70 space-y-1.5">
            <span className="text-xs uppercase font-semibold text-muted-foreground">Recent Signals &amp; Market Intel</span>
            <p className="text-text-secondary leading-relaxed text-xs">{dossier.recentSignals}</p>
            <p className="text-xs text-muted-foreground italic">
              Model-generated intelligence — verify before relying on it.
            </p>
          </div>
        )}
      </div>

      {/* Footer & Read More Linkout */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-hairline text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>Updated {daysAgo === 0 ? "today" : `${daysAgo}d ago`}</span>
          <span>·</span>
          <span>Source: {dossier?.source || "seed+llm"}</span>
          {isStale && (
            <Badge variant="outline" className="border-amber-500/60 text-amber-300 text-xs">
              Dossier &gt;90d Old
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-3">
          {isSafeHref(keyValuesUrl) && (
            <a
              href={keyValuesUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-secondary hover:text-status-success-soft flex items-center gap-1 transition"
            >
              <span>KeyValues profile</span>
              <ExternalLink className="size-3" />
            </a>
          )}

          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating}
            className="text-status-success hover:underline flex items-center gap-1 disabled:opacity-50"
          >
            <RefreshCw className={cn("size-3", isGenerating && "animate-spin")} />
            <span>Regenerate Intel</span>
          </button>
        </div>
      </div>
    </div>
  );
}
