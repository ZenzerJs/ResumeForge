"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { fetchDemoConfig } from "@/components/auth/session-user";
import {
  Bot,
  Sparkles,
  Loader2,
  AlertTriangle,
  Settings,
  CheckCircle2,
  X,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Wand2,
  PanelRightClose,
  PanelRightOpen,
  ExternalLink,
  Dock,
} from "lucide-react";
import { QualitativeCategoryFeedback, BulletFeedback } from "@/lib/ai/qualitative-schema";
import { TypstRepairProposal } from "@/lib/ai/repair-schema";
import { ResumeFacts } from "@/lib/facts/types";
import { checkGuardrail } from "@/lib/guardrail/check";
import { assertCanApplyPatches, markDocumentAsPatched } from "@/lib/guardrail/policy";
import { applyPatchProposals } from "@/lib/ai/patch-application";
import { GuardrailResult } from "@/lib/guardrail/types";

/**
 * Pure helper that applies accepted sidebar patches and stamps the document
 * with the persistent patch provenance marker so it survives across sessions.
 */
export function applyAcceptedSidebarPatches(
  source: string,
  acceptedPatches: Array<{ before?: string; after?: string }>
): string {
  let updatedSource = source;
  for (const patch of acceptedPatches) {
    if (patch.before && patch.after) {
      updatedSource = updatedSource.replace(patch.before, patch.after);
    }
  }
  return markDocumentAsPatched(updatedSource);
}
import { GuardrailFeedback } from "@/components/ui/guardrail-feedback";
import { AiMarkdownRenderer } from "@/components/editor/ai-markdown-renderer";
import { ChatPanel } from "@/components/editor/chat-panel";
import { AiProgress, type AiJobStage } from "@/components/ui/ai-progress";
import { resolveClientProviderConfig } from "@/lib/byok-vault";
import { getDemoContextFromBrowser } from "@/lib/demo-client";
import { parseJobDescription } from "@/lib/jd-parser/parser";

async function readJsonSafe<T = Record<string, unknown>>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

interface AiSidebarProps {
  /** Current Typst source in the editor buffer */
  source: string;
  /** Setter to apply AI suggestions directly to the buffer */
  onApplyToBuffer: (newSource: string) => void;
  /** Optional callback to toggle collapse state of AI sidebar */
  onToggleCollapse?: () => void;
  /** Collapsed state boolean */
  isCollapsed?: boolean;
  /** Optional callback to pop out or dock floating window */
  onPopOut?: () => void;
  /** Whether the sidebar is currently in popped-out floating mode */
  isPoppedOut?: boolean;
  /** Frozen master facts snapshot for guardrail checking */
  masterFacts?: ResumeFacts | null;
  /** Task 10.5: Active compile error repair context */
  repairContext?: {
    compileError: string;
    line?: number;
    column?: number;
    sourceExcerpt?: string;
  } | null;
  /** Callback to clear/dismiss repair mode */
  onDismissRepair?: () => void;
  /** Notify parent when Chat vs Tailor tab changes */
  onModeChange?: (mode: "chat" | "tailor") => void;
}

interface PatchSuggestion {
  id: string;
  operation: "MODIFY_BULLET" | "ADD_SKILL" | "REORDER_BULLETS" | "TWEAK_SUMMARY" | "REPORT_GAP";
  targetSection: string;
  before: string;
  after: string;
  rationale: string;
  confidence: number;
  evidenceIds: string[];
  targetId?: string;
}

interface GapItem {
  requirement: string;
  severity: "CRITICAL" | "MODERATE" | "MINOR";
  recommendation: string;
}

const SEVERITY_COLORS = {
  CRITICAL: "text-status-danger bg-status-danger/10 border-status-danger/30",
  MODERATE: "text-status-warning bg-status-warning/15 border-status-warning/40",
  MINOR: "text-text-secondary bg-elevated/60 border-hairline",
};

export function AiSidebar({
  source,
  onApplyToBuffer,
  onToggleCollapse,
  isCollapsed,
  onPopOut,
  isPoppedOut,
  masterFacts,
  repairContext,
  onDismissRepair,
  onModeChange,
}: AiSidebarProps) {
  const searchParams = useSearchParams();
  const urlJobId = searchParams ? searchParams.get("jobId") : null;
  const [mode, setMode] = useState<"chat" | "tailor">("chat");

  const handleModeChange = (next: "chat" | "tailor") => {
    setMode(next);
    onModeChange?.(next);
  };

  const [jdText, setJdText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [tailorStage, setTailorStage] = useState<AiJobStage>("done");
  const [error, setError] = useState<string | null>(null);
  const [noKeyError, setNoKeyError] = useState(false);
  const [suggestions, setSuggestions] = useState<PatchSuggestion[]>([]);
  const [gaps, setGaps] = useState<GapItem[]>([]);
  const [guardrailResult, setGuardrailResult] = useState<GuardrailResult | null>(null);
  const [acceptedIds, setAcceptedIds] = useState<Set<string>>(new Set());
  const [rejectedIds, setRejectedIds] = useState<Set<string>>(new Set());
  const [acknowledgedSkills, setAcknowledgedSkills] = useState<Set<string>>(new Set());
  const [showGaps, setShowGaps] = useState(false);
  const [hasApplied, setHasApplied] = useState(false);
  const [patchBatch, setPatchBatch] = useState<{ batchId: string; revisionToken: string; baseTypstSource: string; jobId: string } | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [demoBaseTypstSource, setDemoBaseTypstSource] = useState<string | null>(null);
  const tailorAbortRef = useRef<AbortController | null>(null);
  const repairAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      tailorAbortRef.current?.abort();
      repairAbortRef.current?.abort();
    };
  }, []);

  // Task 9.6: Seeded feedback context from Tailor review
  const [seededFeedback, setSeededFeedback] = useState<{
    jobId: string;
    overviewCommentary: string;
    categoryFeedbacks: QualitativeCategoryFeedback[];
    bulletFeedbacks: BulletFeedback[];
    nextStepsAdvice: string[];
    timestamp: number;
  } | null>(null);

  // Read seeded feedback on initial mount or when jobId changes
  useEffect(() => {
    if (!urlJobId || typeof window === "undefined") return;
    let cancelled = false;
    (async () => {
      const demoConfig = await fetchDemoConfig();
      if (cancelled) return;
      if (demoConfig?.demoMode) {
        setSeededFeedback(null);
        return;
      }
      try {
        const raw = sessionStorage.getItem(`resumeforge_tailor_feedback_${urlJobId}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.jobId === urlJobId) setSeededFeedback(parsed);
        }
      } catch {
        // sessionStorage unavailable or invalid
      }
    })();
    return () => { cancelled = true; };
  }, [urlJobId]);

  const handleDismissSeededFeedback = () => {
    setSeededFeedback(null);
    if (urlJobId && typeof window === "undefined") return;
    try {
      sessionStorage.removeItem(`resumeforge_tailor_feedback_${urlJobId}`);
    } catch {
      // ignore
    }
  };

  // Preload JD if available from URL jobId
  useEffect(() => {
    if (!urlJobId) return;
    let cancelled = false;
    (async () => {
      const demoConfig = await fetchDemoConfig();
      if (cancelled) return;
      if (demoConfig?.demoMode) {
        try {
          const rawJobs = localStorage.getItem("resumeforge_guest_jobs");
          const jobs = rawJobs ? JSON.parse(rawJobs) : [];
          const localJob = Array.isArray(jobs) ? jobs.find((item) => item?.id === urlJobId) : null;
          if (localJob?.rawDescription) setJdText(localJob.rawDescription);
        } catch {}
        return;
      }
      try {
        const res = await fetch(`/api/jobs/${urlJobId}`);
        const json = await readJsonSafe<{ success?: boolean; data?: { rawDescription?: string } }>(res);
        if (!cancelled && res.ok && json?.success && json.data?.rawDescription) {
          setJdText(json.data.rawDescription);
        }
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [urlJobId]);

  const handleTailor = useCallback(async () => {
    if (!jdText.trim()) {
      setError("Please enter a job description to tailor against.");
      return;
    }

    const aiSettings = await resolveClientProviderConfig();
    if (!aiSettings) {
      setNoKeyError(true);
      setError("AI provider not configured. Please enter your API key in Settings.");
      return;
    }

    tailorAbortRef.current?.abort();
    const controller = new AbortController();
    tailorAbortRef.current = controller;
    const { signal } = controller;

    setIsGenerating(true);
    setTailorStage("connecting");
    setError(null);
    setNoKeyError(false);
    setSuggestions([]);
    setGaps([]);
    setGuardrailResult(null);
    setAcceptedIds(new Set());
    setRejectedIds(new Set());
    setAcknowledgedSkills(new Set());
    setHasApplied(false);
    setPatchBatch(null);
    setIsDemoMode(false);
    setDemoBaseTypstSource(null);

    try {
      const demoConfig = await fetchDemoConfig();
      if (signal.aborted) return;
      const isDemo = demoConfig?.demoMode === true;
      const demoContext = isDemo ? getDemoContextFromBrowser() : undefined;
      if (isDemo && (!demoContext?.masterTypst || demoContext.masterTypst !== source || localStorage.getItem("resumeforge_typst_source") !== source)) {
        throw new Error("The browser resume changed. Reload the demo draft before generating patches.");
      }

      // Step 1: Extract requirements from JD text (client-side in DEMO_MODE)
      setTailorStage("extracting");
      let jobRequirements: {
        requiredSkills: string[];
        preferredSkills: string[];
        domainTerms: string[];
      };

      if (isDemo) {
        jobRequirements = parseJobDescription(jdText);
      } else {
        const extractRes = await fetch("/api/jobs/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rawDescription: jdText }),
          signal,
        });
        const extractJson = await readJsonSafe<{
          success?: boolean;
          error?: string;
          message?: string;
          data?: {
            requiredSkills: string[];
            preferredSkills: string[];
            domainTerms: string[];
          };
        }>(extractRes);
        if (signal.aborted) return;

        if (!extractRes.ok || !extractJson?.success || !extractJson.data) {
          const errMsg =
            extractRes.status === 401
              ? extractJson?.error || "Sign in to extract job requirements."
              : extractJson?.message ||
                extractJson?.error ||
                `Failed to extract job requirements (HTTP ${extractRes.status}).`;
          setError(errMsg);
          setTailorStage("error");
          return;
        }

        jobRequirements = extractJson.data;
      }

      // Persist pasted job descriptions for signed-in users so accepted
      // proposals can be bound to a real server-side job.
      let jobId = urlJobId;
      if (!isDemo && !jobId) {
        const saveRes = await fetch("/api/jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rawDescription: jdText, source: "pasted", personal: true }),
          signal,
        });
        const saveJson = await readJsonSafe<{ success?: boolean; data?: { id?: string } }>(saveRes);
        if (signal.aborted) return;
        if (saveRes.ok && saveJson?.success && typeof saveJson.data?.id === "string") {
          jobId = saveJson.data.id;
        }
      }

      // Step 2: Generate patches against master resume
      setTailorStage("writing");
      const patchRes = await fetch(isDemo ? "/api/demo/generate-patches" : "/api/ai/generate-patches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal,
        body: JSON.stringify({
          providerConfig: {
            provider: aiSettings.provider,
            apiKey: aiSettings.apiKey,
            baseUrl: aiSettings.baseUrl || undefined,
            model: aiSettings.model || undefined,
          },
          jobRequirements: {
            requiredSkills: jobRequirements.requiredSkills,
            preferredSkills: jobRequirements.preferredSkills,
            domainTerms: jobRequirements.domainTerms,
          },
          ...(isDemo ? (demoContext || {}) : (jobId ? { jobId } : {})),
          tailorFeedback: seededFeedback
            ? {
                overviewCommentary: seededFeedback.overviewCommentary,
                nextStepsAdvice: seededFeedback.nextStepsAdvice,
              }
            : undefined,
        }),
      });

      const patchJson = await readJsonSafe<{
        success?: boolean;
        error?: string;
        message?: string;
        data?: {
          verified?: PatchSuggestion[];
          batch?: { batchId: string; revisionToken: string; baseTypstSource: string; jobId: string } | null;
          demo?: boolean;
          gaps?: GapItem[];
        };
      }>(patchRes);
      if (signal.aborted) return;

      if (!patchRes.ok || !patchJson?.success || !patchJson.data) {
        const isProxyProvider = ["openai", "anthropic", "groq"].includes(
          String(aiSettings.provider).toLowerCase()
        );
        const errMsg =
          patchRes.status === 401 && isProxyProvider
            ? isDemo ? "Use your own provider API key in Settings to generate a demo response." : "Sign in to use this provider, or switch to Gemini."
            : patchJson?.message || patchJson?.error || `AI generation failed (HTTP ${patchRes.status}).`;
        setError(errMsg);
        setTailorStage("error");
        if (errMsg.toLowerCase().includes("api key") || errMsg.toLowerCase().includes("provider")) {
          setNoKeyError(true);
        }
        return;
      }

      setTailorStage("verifying");
      const verifiedPatches = patchJson.data.verified || [];
      setSuggestions(verifiedPatches);
      setPatchBatch(patchJson.data.batch || null);
      setIsDemoMode(isDemo && patchJson.data.demo === true);
      setDemoBaseTypstSource(isDemo ? source : null);
      setGaps(patchJson.data.gaps || []);

      // Step 3: Phase 11.2 Guardrail verification against frozen master facts
      if (masterFacts) {
        const gResult = checkGuardrail(source, masterFacts, { patches: verifiedPatches });
        setGuardrailResult(gResult);
      }
      setTailorStage("done");
    } catch (err) {
      if (signal.aborted || (err instanceof DOMException && err.name === "AbortError")) return;
      setError(err instanceof Error ? err.message : "Unexpected error during generation.");
      setTailorStage("error");
    } finally {
      if (tailorAbortRef.current === controller) {
        tailorAbortRef.current = null;
        setIsGenerating(false);
      }
    }
  }, [jdText, masterFacts, seededFeedback, source, urlJobId]);

  const handleAccept = (id: string) => {
    setAcceptedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    setRejectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleReject = (id: string) => {
    setRejectedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    setAcceptedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const unverifiedSkillsInAccepted = React.useMemo(() => {
    if (!masterFacts || acceptedIds.size === 0) return [];
    const acceptedList = suggestions.filter((s) => acceptedIds.has(s.id));
    const gResult = checkGuardrail(source, masterFacts, { patches: acceptedList });
    return Array.from(
      new Set(
        gResult.violations
          .filter((v) => v.kind === "skill" && typeof v.actual === "string")
          .map((v) => v.actual as string)
      )
    );
  }, [masterFacts, acceptedIds, suggestions, source]);

  const toggleSkillAck = (skill: string) => {
    setAcknowledgedSkills((prev) => {
      const next = new Set(prev);
      if (next.has(skill)) next.delete(skill);
      else next.add(skill);
      return next;
    });
  };

  const handleApplyAccepted = async () => {
    if (isDemoMode) {
      if (!demoBaseTypstSource || source !== demoBaseTypstSource || localStorage.getItem("resumeforge_typst_source") !== demoBaseTypstSource) {
        setError("The browser draft changed after these patches were generated. Generate patches again to protect your edits.");
        return;
      }
      const acceptedList = suggestions.filter((suggestion) => acceptedIds.has(suggestion.id));
      if (acceptedList.length === 0) {
        setError("Accept at least one verified patch before applying the local draft.");
        return;
      }
      setIsGenerating(true);
      setError(null);
      try {
        const rawFacts = localStorage.getItem("resumeforge_demo_master_facts");
        const facts = rawFacts ? JSON.parse(rawFacts) as ResumeFacts : null;
        if (!facts) throw new Error("Freeze a local master resume before applying patches.");
        const reconstructed = applyPatchProposals(demoBaseTypstSource, acceptedList);
        const acceptedPatchIds = acceptedList.map((patch) => patch.id);
        if (new Set(acceptedPatchIds).size !== acceptedPatchIds.length || reconstructed.appliedIds.length !== acceptedPatchIds.length || acceptedPatchIds.some((id) => !reconstructed.appliedIds.includes(id))) {
          throw new Error("The local proposal set changed. Generate patches again before applying.");
        }
        assertCanApplyPatches(reconstructed.typstSource, facts, acceptedList, { acknowledgedSkills: Array.from(acknowledgedSkills) });
        const localContent = markDocumentAsPatched(reconstructed.typstSource);
        const { compileTypstToSvg } = await import("@/lib/typst/compiler");
        const compiled = await compileTypstToSvg(localContent);
        if (!compiled.success) throw new Error("The local resume does not compile. Review the accepted patches before applying.");
        localStorage.setItem("resumeforge_typst_source", localContent);
        onApplyToBuffer(localContent);
        setHasApplied(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to apply local patches.");
      } finally {
        setIsGenerating(false);
      }
      return;
    }

    if (!patchBatch) {
      setError("Save this job and generate patches again before applying a persistent variant.");
      return;
    }
    if (source !== patchBatch.baseTypstSource) {
      setError("The resume changed after these patches were generated. Generate patches again to protect your edits.");
      return;
    }
    // Phase 11.2: Enforce guardrail safety gate
    if (masterFacts) {
      const acceptedList = suggestions.filter((s) => acceptedIds.has(s.id));
      try {
        assertCanApplyPatches(source, masterFacts, acceptedList, {
          acknowledgedSkills: Array.from(acknowledgedSkills),
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Cannot apply patches: guardrail check failed.");
        return;
      }
    }

    const acceptedList = suggestions.filter((s) => acceptedIds.has(s.id));
    if (acceptedList.length === 0) return;
    setIsGenerating(true);
    try {
      const reconstructed = applyPatchProposals(patchBatch.baseTypstSource, acceptedList);
      const acceptedPatchIds = acceptedList.map((patch) => patch.id);
      if (reconstructed.appliedIds.length !== acceptedPatchIds.length || acceptedPatchIds.some((id) => !reconstructed.appliedIds.includes(id))) {
        throw new Error("The server proposal set changed. Generate patches again before applying.");
      }
      if (masterFacts) {
        assertCanApplyPatches(source, masterFacts, acceptedList, { acknowledgedSkills: Array.from(acknowledgedSkills) });
      }
      const preview = markDocumentAsPatched(reconstructed.typstSource);
      const { compileTypstToSvg } = await import("@/lib/typst/compiler");
      const compiled = await compileTypstToSvg(preview);
      if (!compiled.success) throw new Error("The reconstructed resume does not compile. Review the accepted patches before applying.");
      const res = await fetch("/api/ai/apply-patches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchId: patchBatch.batchId,
          revisionToken: patchBatch.revisionToken,
          acceptedPatchIds,
          acknowledgedSkills: Array.from(acknowledgedSkills),
          variantTitle: `AI Tailored Variant — ${new Date().toLocaleDateString()}`,
        }),
      });
      const json = await readJsonSafe<{
        success?: boolean;
        error?: string;
        message?: string;
        data?: { typstContent: string };
      }>(res);
      if (!res.ok || !json?.success || !json.data) {
        throw new Error(json?.message || json?.error || `Failed to save tailored variant (HTTP ${res.status}).`);
      }
      onApplyToBuffer(json.data.typstContent);
      setHasApplied(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply patches.");
    } finally {
      setIsGenerating(false);
    }
  };

  const pendingCount = suggestions.filter(
    (s) => !acceptedIds.has(s.id) && !rejectedIds.has(s.id)
  ).length;

  // Task 10.5: Typst Repair Assist state
  const [isRepairing, setIsRepairing] = useState(false);
  const [repairStage, setRepairStage] = useState<AiJobStage>("done");
  const [repairProposal, setRepairProposal] = useState<TypstRepairProposal | null>(null);
  const [repairError, setRepairError] = useState<string | null>(null);
  const [preValidationValid, setPreValidationValid] = useState<boolean | null>(null);
  const [preValidationError, setPreValidationError] = useState<string | null>(null);
  const [repairApplied, setRepairApplied] = useState(false);
  const [confirmLargeRepair, setConfirmLargeRepair] = useState(false);

  useEffect(() => {
    setRepairProposal(null);
    setRepairError(null);
    setRepairStage("done");
    setPreValidationValid(null);
    setPreValidationError(null);
    setRepairApplied(false);
    setConfirmLargeRepair(false);
  }, [repairContext]);

  const handleGenerateRepair = async () => {
    if (!repairContext) return;
    repairAbortRef.current?.abort();
    const controller = new AbortController();
    repairAbortRef.current = controller;
    const { signal } = controller;

    setIsRepairing(true);
    setRepairStage("connecting");
    setRepairError(null);
    setRepairProposal(null);
    setPreValidationValid(null);
    setPreValidationError(null);
    setRepairApplied(false);
    setConfirmLargeRepair(false);

    try {
      const providerConfig = await resolveClientProviderConfig();
      if (signal.aborted) return;

      setRepairStage("writing");
      const res = await fetch("/api/ai/repair-typst", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal,
        body: JSON.stringify({
          source,
          compileError: repairContext.compileError,
          line: repairContext.line,
          column: repairContext.column,
          sourceExcerpt: repairContext.sourceExcerpt,
          providerConfig,
        }),
      });

      const json = await readJsonSafe<{
        success?: boolean;
        error?: string;
        message?: string;
        data?: TypstRepairProposal;
      }>(res);
      if (signal.aborted) return;
      if (res.ok && json?.success && json.data) {
        const prop: TypstRepairProposal = json.data;
        setRepairProposal(prop);

        // Pre-validate replacementSource on client with WASM Typst compiler
        setRepairStage("verifying");
        const { compileTypstToSvg } = await import("@/lib/typst/compiler");
        const valResult = await compileTypstToSvg(prop.replacementSource);
        if (signal.aborted) return;
        if (!valResult.success) {
          setPreValidationValid(false);
          setPreValidationError(valResult.error.message);
        } else {
          setPreValidationValid(true);
          setPreValidationError(null);
        }
        setRepairStage("done");
      } else {
        const errMsg =
          json?.message ||
          json?.error ||
          `Failed to generate Typst repair proposal (HTTP ${res.status}).`;
        setRepairError(errMsg);
        setRepairStage("error");
      }
    } catch (err) {
      if (signal.aborted || (err instanceof DOMException && err.name === "AbortError")) return;
      const errMsg = err instanceof Error ? err.message : "Error generating repair";
      setRepairError(errMsg);
      setRepairStage("error");
    } finally {
      if (repairAbortRef.current === controller) {
        repairAbortRef.current = null;
        setIsRepairing(false);
      }
    }
  };

  const handleApplyRepairFix = () => {
    if (!repairProposal || preValidationValid === false) return;
    onApplyToBuffer(markDocumentAsPatched(repairProposal.replacementSource));
    setRepairApplied(true);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-b-[6px] border-x border-b border-outline/70 bg-panel">
      {/* Header */}
      <div className="flex min-h-8 items-center justify-between border-b border-outline/70 bg-panel px-2.5 py-0.5 md:h-8">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <Wand2 className="h-3.5 w-3.5 text-primary" />
          {repairContext ? "Typst Repair Assist" : mode === "chat" ? "AI Chat" : "AI Tailor"}
        </span>
        <div className="flex items-center gap-2">
          {repairContext && onDismissRepair && (
            <button
              type="button"
              onClick={onDismissRepair}
              className="p-0.5 rounded text-text-secondary hover:text-foreground hover:bg-elevated transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              title="Close Repair Assist Mode"
              data-testid="close-repair-mode-btn"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <Link
            href="/settings"
            className="flex items-center gap-1 text-xs text-text-muted hover:text-foreground transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          >
            <Settings className="h-3 w-3" />
            Settings
          </Link>
          {onPopOut && (
            <button
              type="button"
              onClick={onPopOut}
              className="p-0.5 rounded text-text-secondary hover:text-primary hover:bg-elevated transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              title={isPoppedOut ? "Dock back to sidebar" : "Pop out into floating window"}
              data-testid="popout-ai-window-btn"
            >
              {isPoppedOut ? (
                <Dock className="h-3.5 w-3.5 text-status-warning" />
              ) : (
                <ExternalLink className="h-3.5 w-3.5" />
              )}
            </button>
          )}
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="p-1 rounded text-text-secondary hover:text-foreground hover:bg-elevated transition"
              title={isCollapsed ? "Expand AI Sidebar" : "Collapse AI Sidebar"}
              data-testid="toggle-ai-sidebar-btn"
            >
              {isCollapsed ? (
                <PanelRightOpen className="h-3.5 w-3.5 text-status-warning" />
              ) : (
                <PanelRightClose className="h-3.5 w-3.5" />
              )}
            </button>
          )}
        </div>
      </div>

      {!repairContext && (
        <div
          className="flex items-center gap-1 border-b border-hairline px-3 py-2"
          role="tablist"
          aria-label="AI assistant modes"
          data-testid="ai-mode-tabs"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === "chat"}
            data-testid="ai-tab-chat"
            onClick={() => handleModeChange("chat")}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              mode === "chat"
                ? "bg-primary text-primary-foreground"
                : "text-text-secondary hover:text-foreground hover:bg-elevated"
            }`}
          >
            Chat
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "tailor"}
            data-testid="ai-tab-tailor"
            onClick={() => handleModeChange("tailor")}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              mode === "tailor"
                ? "bg-primary text-primary-foreground"
                : "text-text-secondary hover:text-foreground hover:bg-elevated"
            }`}
          >
            Tailor
          </button>
        </div>
      )}

      {mode === "chat" && !repairContext ? (
        <ChatPanel typstSource={source} />
      ) : (
      <div className="flex flex-1 min-h-0 flex-col overflow-y-auto p-4 gap-4">
        {/* Task 10.5: Typst Repair Assist Mode Card */}
        {repairContext && (
          <div className="rounded-lg border border-status-warning/40 bg-status-warning/15 p-3.5 text-xs text-foreground shadow-md space-y-3">
            <div className="flex items-center justify-between border-b border-status-warning/40 pb-2">
              <div className="flex items-center gap-2 font-bold text-status-warning">
                <Sparkles className="h-4 w-4" />
                <span>Typst Repair Assist</span>
              </div>
              {onDismissRepair && (
                <button
                  type="button"
                  onClick={onDismissRepair}
                  className="text-text-secondary hover:text-foreground text-xs font-mono"
                  data-testid="close-repair-mode-btn"
                >
                  Exit
                </button>
              )}
            </div>

            <div className="space-y-1 font-mono text-xs bg-inset p-2.5 rounded border border-hairline">
              <div className="text-status-danger font-semibold">Compiler Error:</div>
              <div className="text-text-secondary break-words">{repairContext.compileError}</div>
              {repairContext.line && (
                <div className="text-muted-foreground text-xs">Line: {repairContext.line}</div>
              )}
            </div>

            {(isRepairing || repairError || (repairStage !== "done" && repairStage !== "queued")) && (
              <div className="pt-1">
                <AiProgress
                  stage={repairStage}
                  stages={["connecting", "writing", "verifying", "done"]}
                  error={repairError}
                  onDismissError={() => setRepairError(null)}
                />
              </div>
            )}

            {!repairProposal && (
              <button
                type="button"
                disabled={isRepairing}
                onClick={handleGenerateRepair}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground font-bold text-xs shadow transition cursor-pointer"
                data-testid="generate-repair-btn"
              >
                {isRepairing ? (
                  <Loader2 className="h-4 w-4 animate-spin text-primary-foreground" />
                ) : (
                  <Sparkles className="h-4 w-4 text-primary-foreground" />
                )}
                {isRepairing ? "Diagnosing & Generating Fix..." : "Generate AI Repair Proposal"}
              </button>
            )}

            {repairProposal && (
              <div className="space-y-3 pt-1 border-t border-status-warning/40">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-status-warning text-xs">Proposal Summary</span>
                  <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded border ${
                    repairProposal.confidence === "high"
                      ? "bg-status-success/15 text-status-success-soft border-status-success/35"
                      : repairProposal.confidence === "medium"
                      ? "bg-status-warning/15 text-status-warning border-status-warning/40"
                      : "bg-status-danger/10 text-status-danger border-status-danger/30"
                  }`}>
                    {repairProposal.confidence} confidence
                  </span>
                </div>

                <p className="text-sm text-text-secondary leading-relaxed font-sans">{repairProposal.summary}</p>
                <div className="text-muted-foreground text-xs italic font-sans">{repairProposal.errorAnalysis}</div>

                {/* Pre-compilation status badge */}
                {preValidationValid === true && (
                  <div className="flex items-center gap-1.5 text-status-success-soft bg-status-success/15 border border-status-success/35 p-2 rounded text-xs">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-status-success" />
                    <span>Pre-compilation verification: PASSED</span>
                  </div>
                )}

                {preValidationValid === false && (
                  <div className="flex items-center gap-1.5 text-status-danger bg-status-danger/10 border border-status-danger/30 p-2 rounded text-xs">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>Pre-compilation verification: FAILED ({preValidationError})</span>
                  </div>
                )}

                {/* Diff-scope warning & confirmation checkbox if proposal modifies > 25% of lines */}
                {(() => {
                  const origLineCount = source.split("\n").length;
                  const isLargeDiff =
                    repairProposal.changedLinesCount !== undefined &&
                    origLineCount > 0 &&
                    repairProposal.changedLinesCount / origLineCount > 0.25;

                  return (
                    <>
                      {isLargeDiff && (
                        <div className="p-2.5 rounded bg-status-warning/15 border border-status-warning/40 text-status-warning text-xs space-y-2">
                          <div className="flex items-center gap-1.5 font-bold text-status-warning">
                            <AlertTriangle className="h-4 w-4 shrink-0" />
                            <span>Large Repair Warning ({repairProposal.changedLinesCount} lines changed, &gt;25% of document)</span>
                          </div>
                          <p className="text-sm text-foreground/90 leading-tight">
                            Applying this proposal will replace a substantial portion of your document. Confirm below to enable Apply Fix.
                          </p>
                          <label className="flex items-start gap-2 text-xs text-status-warning cursor-pointer pt-0.5">
                            <input
                              type="checkbox"
                              checked={confirmLargeRepair}
                              onChange={(e) => setConfirmLargeRepair(e.target.checked)}
                              className="mt-0.5 rounded border-status-warning bg-inset text-primary focus:ring-ring"
                              data-testid="confirm-large-repair-checkbox"
                            />
                            <span>I confirm I want to replace &gt;25% of my document.</span>
                          </label>
                        </div>
                      )}

                      {repairProposal.warnings && repairProposal.warnings.length > 0 && (
                        <ul className="list-disc pl-4 text-xs text-status-warning space-y-0.5">
                          {repairProposal.warnings.map((w, idx) => (
                            <li key={idx}>{w}</li>
                          ))}
                        </ul>
                      )}

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          disabled={preValidationValid === false || (isLargeDiff && !confirmLargeRepair) || repairApplied}
                          onClick={handleApplyRepairFix}
                          className="flex-1 py-1.5 px-3 rounded font-bold text-xs bg-status-success hover:bg-status-success/90 disabled:opacity-50 text-contrast-ink shadow transition cursor-pointer"
                          data-testid="apply-typst-fix-btn"
                        >
                          {repairApplied ? "Fix Applied!" : "Apply Fix"}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(repairProposal.replacementSource);
                          }}
                          className="py-1.5 px-3 rounded font-semibold text-xs border border-hairline bg-inset hover:bg-elevated text-text-secondary transition"
                        >
                          Copy
                        </button>

                        {onDismissRepair && (
                          <button
                            type="button"
                            onClick={onDismissRepair}
                            className="py-1.5 px-3 rounded font-semibold text-xs border border-hairline bg-inset text-muted-foreground hover:text-foreground transition"
                          >
                            Dismiss
                          </button>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        )}
        {/* Seeded Tailor Feedback Banner */}
        {seededFeedback && (
          <div
            data-testid="seeded-feedback-banner"
            className="p-3.5 bg-status-warning/15 border border-status-warning/40 rounded-xl space-y-2 text-xs shadow-md"
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-status-warning flex items-center gap-1.5 text-xs uppercase tracking-wide">
                <Sparkles className="h-3.5 w-3.5 text-status-warning" />
                Seeded Feedback from Tailor Review
              </span>
              <button
                type="button"
                onClick={handleDismissSeededFeedback}
                data-testid="dismiss-seeded-feedback-btn"
                className="text-status-warning hover:text-status-warning/80 text-xs underline font-medium"
              >
                Dismiss Context
              </button>
            </div>
            <p className="text-text-secondary text-sm leading-relaxed italic bg-inset p-2 rounded border border-hairline">
              &quot;{seededFeedback.overviewCommentary}&quot;
            </p>
            {seededFeedback.nextStepsAdvice && seededFeedback.nextStepsAdvice.length > 0 && (
              <div className="text-xs text-foreground space-y-0.5 pt-1">
                <span className="font-semibold block text-status-warning">Recommended Actions:</span>
                <ul className="list-disc list-inside space-y-0.5 text-text-secondary">
                  {seededFeedback.nextStepsAdvice.map((adv: string, idx: number) => (
                    <li key={idx}>{adv}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* JD Input */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Job Description
          </label>
          <textarea
            rows={6}
            value={jdText}
            onChange={(e) => {
              setJdText(e.target.value);
              setError(null);
              setNoKeyError(false);
            }}
            placeholder={"Paste the job posting here…\n\n(or navigate to a job in the Tracker and click Copy JD to auto-fill)"}
            className="w-full bg-inset border border-hairline rounded-lg p-3 text-xs text-foreground placeholder-text-muted outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none font-mono leading-relaxed"
          />
        </div>

        {/* Staged AI Progress Feedback */}
        {(isGenerating || (tailorStage !== "done" && tailorStage !== "queued") || error) && (
          <div className="pt-1">
            <AiProgress
              stage={tailorStage}
              stages={["connecting", "extracting", "writing", "verifying", "done"]}
              error={error}
              onDismissError={() => setError(null)}
            />
            {noKeyError && (
              <Link
                href="/settings"
                className="mt-2 block underline underline-offset-2 text-status-warning hover:text-status-warning/80 text-xs font-medium"
              >
                → Configure your API key in Settings
              </Link>
            )}
          </div>
        )}

        {/* Generate button */}
        <button
          type="button"
          onClick={handleTailor}
          disabled={isGenerating || !jdText.trim()}
          className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground font-semibold text-xs py-2.5 rounded-lg shadow shadow-primary/20 transition"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating suggestions…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Generate Suggestions
            </>
          )}
        </button>

        {/* Phase 11.2 Mechanical Guardrail Feedback */}
        {guardrailResult && (
          <div className="pt-2">
            <GuardrailFeedback result={guardrailResult} />
          </div>
        )}

        {/* Suggestions list */}
        {suggestions.length > 0 && (
          <div className="space-y-3">
            {unverifiedSkillsInAccepted.length > 0 && (
              <div
                data-testid="unverified-skills-ack-box"
                className="p-3 rounded-lg bg-status-warning/15 border border-status-warning/40 space-y-2 text-xs text-status-warning"
              >
                <div className="flex items-center gap-1.5 font-semibold text-status-warning">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-status-warning" />
                  <span>Acknowledge unverified skills</span>
                </div>
                <p className="text-sm text-text-secondary leading-relaxed">
                  Only add if you have real experience; log it in your Evidence Bank first, or check below to confirm before applying:
                </p>
                <div className="space-y-1 pt-0.5">
                  {unverifiedSkillsInAccepted.map((skill) => (
                    <label
                      key={skill}
                      className="flex items-center gap-2 text-xs text-foreground cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={acknowledgedSkills.has(skill)}
                        onChange={() => toggleSkillAck(skill)}
                        data-testid={`ack-skill-checkbox-${skill}`}
                        className="rounded border-status-warning bg-inset text-primary focus:ring-ring"
                      />
                      <span>I have real experience with <strong>{skill}</strong></span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {suggestions.length} suggestion{suggestions.length !== 1 ? "s" : ""}
                {pendingCount > 0 && (
                  <span className="ml-2 text-status-warning">{pendingCount} pending</span>
                )}
              </h3>
              {acceptedIds.size > 0 && (
                <button
                  type="button"
                  onClick={handleApplyAccepted}
                  disabled={isGenerating || hasApplied}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                    hasApplied
                      ? "bg-status-success/15 text-status-success-soft border border-status-success/35"
                      : "bg-primary hover:bg-primary/90 text-primary-foreground"
                  }`}
                >
                  {hasApplied ? (
                    <>
                      <CheckCircle2 className="h-3 w-3" />
                      Applied!
                    </>
                  ) : (
                    <>
                      <ClipboardCheck className="h-3 w-3" />
                      Apply {acceptedIds.size} accepted
                    </>
                  )}
                </button>
              )}
            </div>

            {suggestions.map((s) => {
              const isAccepted = acceptedIds.has(s.id);
              const isRejected = rejectedIds.has(s.id);
              return (
                <div
                  key={s.id}
                  className={`rounded-lg border p-3 space-y-2 text-xs transition-all ${
                    isAccepted
                      ? "border-status-success/40 bg-status-success/15"
                      : isRejected
                      ? "border-hairline bg-inset/40 opacity-50"
                      : "border-hairline bg-inset"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium text-foreground leading-snug line-clamp-2">
                      {s.targetSection}
                    </span>
                    <span className="shrink-0 text-xs font-mono text-muted-foreground">
                      {Math.round(s.confidence * 100)}%
                    </span>
                  </div>

                  {s.before && (
                    <div className="text-xs bg-status-danger/10 border border-status-danger/30 rounded p-2 text-status-danger font-mono line-clamp-2">
                      − {s.before}
                    </div>
                  )}
                  {s.after && (
                    <div className="text-xs bg-status-success/10 border border-status-success/30 rounded p-2 text-status-success-soft font-mono line-clamp-2">
                      + {s.after}
                    </div>
                  )}

                  <AiMarkdownRenderer content={s.rationale} className="text-text-secondary text-xs" />

                  {!isAccepted && !isRejected && (
                    <div className="flex gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => handleAccept(s.id)}
                        className="flex-1 py-1 rounded bg-status-success/15 hover:bg-status-success/25 text-status-success-soft border border-status-success/25 text-xs font-semibold transition"
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReject(s.id)}
                        className="flex-1 py-1 rounded bg-elevated hover:bg-panel text-text-secondary border border-hairline text-xs font-semibold transition"
                      >
                        Skip
                      </button>
                    </div>
                  )}
                  {(isAccepted || isRejected) && (
                    <button
                      type="button"
                      onClick={() => {
                        setAcceptedIds((p) => { const n = new Set(p); n.delete(s.id); return n; });
                        setRejectedIds((p) => { const n = new Set(p); n.delete(s.id); return n; });
                      }}
                      className="text-xs text-muted-foreground hover:text-foreground transition flex items-center gap-1"
                    >
                      <X className="h-3 w-3" />
                      Undo
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Gaps section */}
        {gaps.length > 0 && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setShowGaps((v) => !v)}
              className="flex items-center justify-between w-full text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition"
            >
              <span>{gaps.length} gap{gaps.length !== 1 ? "s" : ""} identified</span>
              {showGaps ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
            {showGaps &&
              gaps.map((g, i) => (
                <div
                  key={i}
                  className={`rounded-lg border p-2.5 text-xs ${SEVERITY_COLORS[g.severity]}`}
                >
                  <p className="font-semibold">{g.requirement}</p>
                  <p className="mt-1 text-sm opacity-80">{g.recommendation}</p>
                </div>
              ))}
          </div>
        )}

        {/* Empty state */}
        {!isGenerating && suggestions.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center flex-1 text-center py-6 gap-3">
            <div className="rounded-full bg-status-warning/15 border border-status-warning/40 p-3">
              <Bot className="h-6 w-6 text-status-warning" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-foreground">Tailoring Assistant</p>
              <p className="text-sm text-muted-foreground max-w-[200px] leading-relaxed">
                Paste a job description and click Generate to get evidence-backed resume suggestions.
              </p>
            </div>
            <Link
              href="/tracker"
              className="text-xs text-status-warning/80 hover:text-status-warning underline underline-offset-2 transition"
            >
              Browse saved jobs in Tracker →
            </Link>
          </div>
        )}
      </div>
      )}
    </div>
  );
}
