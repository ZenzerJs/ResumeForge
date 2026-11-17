"use client";

import React, { useState, useEffect, useLayoutEffect, useRef, useDeferredValue, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  X,
  Loader2,
  Briefcase,
  ClipboardCheck,
  FileText,
  Database,
  XCircle,
  ChevronDown,
  Code2,
  Eye,
  RefreshCw,
  Check,
} from "lucide-react";
import { JobRequirementsSchema, type JobRequirements } from "@/lib/jd-parser/types";
import { RoleProfile, ROLE_PROFILES, AtsEvaluationResult } from "@/lib/ats-evaluator/types";
import { auditResume } from "@/lib/diagnostics/auditResume";
import { resolveClientProviderConfig } from "@/lib/byok-vault";
import { ProviderConfigSchema } from "@/lib/ai/types";
import { getDemoContextFromBrowser, initializeDemoSamples } from "@/lib/demo-client";
import { fetchDemoConfig, fetchSessionUser } from "@/components/auth/session-user";
import { DEMO_JOB } from "@/lib/demo-samples";
import { readApiResponse } from "@/lib/api-error";
import { parseJobDescription } from "@/lib/jd-parser/parser";
import { matchEvidenceToRequirements, type EvidenceItemWithBullets } from "@/lib/matching/matcher";
import dynamic from "next/dynamic";
import { PatchDiffReview } from "./patch-diff-review";
import { AtsScorePanel } from "./ats-score-panel";

const CoverLetterPanel = dynamic(
  () => import("./cover-letter-panel").then((mod) => mod.CoverLetterPanel),
  {
    loading: () => (
      <div className="p-6 flex items-center justify-center text-muted-foreground font-mono text-xs">
        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading Cover Letter Panel...
      </div>
    ),
    ssr: false,
  }
);

const TailorDiagnosticPanel = dynamic(
  () => import("./tailor-diagnostic-panel").then((mod) => mod.TailorDiagnosticPanel),
  {
    loading: () => (
      <div className="p-6 flex items-center justify-center text-muted-foreground font-mono text-xs">
        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading Diagnostics...
      </div>
    ),
    ssr: false,
  }
);
import {
  PatchErrorCategorySchema,
  getPatchRecoveryAction,
  type PatchProposal,
  type Gap,
  type RejectedPatch,
} from "@/lib/ai/patch-schema";
import type { CoverLetterResponse } from "@/lib/ai/cover-letter-schema";
import type {
  PatchDecision,
  EvidenceMetadataEntry,
  StructuredPatchError,
} from "./patch-diff-review";
import { SuggestionPreview } from "./suggestion-preview";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AppShell } from "@/components/design-system/app-shell";
import { PageHeader } from "@/components/design-system/page-header";
import { PageSkeleton } from "@/components/design-system/page-skeleton";
import { isPlaceholderDescription } from "@/lib/ingestion/helpers";
import { JD_PASTE_TEMPLATE, convertHtmlToCleanMarkdown } from "@/lib/ingestion/jd-format";
import { AiProgress, type AiJobStage } from "@/components/ui/ai-progress";
import { Button, buttonVariants } from "@/components/ui/button";
import { QuickAddEvidenceModal } from "./quick-add-evidence-modal";
import {
  parseJobDescriptionDocument,
  createUserRequirement,
  JobDescriptionDocument,
  ProvenanceRequirement,
} from "@/lib/jd/document-pipeline";
import { Plus, Columns3 } from "lucide-react";
import { TechDiffPillList } from "@/components/tracker/tech-diff-pill-list";
import { BrandIcon, hasBrandIcon } from "@/components/design-system/brand-icon";
import { tokenizeHighlightedJd } from "@/lib/jd/highlight-keywords";
import type { ResumeFacts, TailoringValidationContext } from "@/lib/facts/types";
import {
  buildEditorHref,
  buildLibraryHref,
  buildSettingsHref,
  clearActiveApplicationContext,
  clearPendingReviewChoices,
  createSaveBeforeNavigationController,
  normalizeEditorModeParam,
  normalizeTailorTabParam,
  readActiveApplicationContext,
  readPendingReviewChoices,
  resolveTailorEntryContext,
  updateActiveApplicationContext,
  writeActiveApplicationContext,
  writePendingReviewChoices,
  type ApplicationAccountScope,
  type EditorModeParam,
  type TailorWorkspaceTab,
} from "@/lib/tailor/application-context";

interface RankedMatch {
  id: string;
  title: string;
  type: string;
  organization: string | null;
  dates: string | null;
  status: string;
  isDraft: boolean;
  verifiedSummary: string;
  tags: string[];
  score: number;
  matchPercentage: number;
  matchedRequirements: string[];
  matchedBullets: {
    id: string;
    text: string;
    technologies: string[];
    verified: boolean;
    matchedRequirements: string[];
  }[];
}

const SAMPLE_BACKEND_JD = `Senior Backend Engineer — Nova Labs

We are looking for a Senior Backend Engineer to join our core infrastructure team. 
You will be responsible for designing and building highly scalable microservices 
using Go and Python.

Requirements:
- 5+ years of experience in backend development.
- Strong proficiency in Go and Python.
- Experience with Kubernetes and Docker.
- Solid understanding of distributed systems and RESTful APIs.
- Familiarity with PostgreSQL and Redis.

Preferred:
- Experience with AWS or GCP.
- Knowledge of GraphQL.
- Open-source contributions.`;

const SAMPLE_FRONTEND_JD = `Frontend Engineer — WebCraft Systems

Responsibilities:
Build modern, accessible web application interfaces using React and Next.js.

Must Have Requirements:
- 3+ years experience with TypeScript, JavaScript, HTML, and CSS.
- Strong UI component styling experience with Tailwind CSS.
- Experience writing automated tests using Vitest, Jest, or Playwright.

Nice to Have:
- Knowledge of WebAssembly (WASM) and Web performance.
- Experience with state management and Front-End Development best practices.`;

const DEMO_JOB_REQUIREMENTS: JobRequirements = {
  requiredSkills: ["TypeScript", "PostgreSQL"],
  preferredSkills: ["AWS"],
  domainTerms: ["product analytics"],
  roleTitle: DEMO_JOB.roleTitle,
  company: DEMO_JOB.company,
};

function renderHighlightedJd(text: string, skills: string[]) {
  if (!text) return null;
  const tokens = tokenizeHighlightedJd(text, skills);

  return (
    <span className="whitespace-pre-wrap leading-relaxed">
      {tokens.map((token, idx) => {
        if (token.isMatch) {
          return (
            <mark
              key={idx}
              className="bg-primary/20 text-primary font-semibold px-1 py-0.5 rounded border border-primary/40"
            >
              {token.text}
            </mark>
          );
        }
        return <span key={idx}>{token.text}</span>;
      })}
    </span>
  );
}

export function isLocalOrDemoJobId(jobId: string | null | undefined, demoMode: boolean): boolean {
  if (demoMode) return true;
  if (!jobId) return false;
  return jobId.startsWith("guest-job-") || jobId.startsWith("demo-sample-");
}

export function matchGuestEvidenceItems(
  rawItems: unknown[],
  reqs: JobRequirements
): RankedMatch[] {
  const evidenceItems: EvidenceItemWithBullets[] = rawItems
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
    .map((item) => ({
      id: String(item.id || ""),
      type: String(item.type || "project"),
      title: String(item.title || ""),
      organization: item.organization ? String(item.organization) : null,
      dates: item.dates ? String(item.dates) : null,
      verifiedSummary: String(item.verifiedSummary || ""),
      tags: Array.isArray(item.tags) ? item.tags.map(String) : [],
      status: String(item.status || "draft"),
      bullets: Array.isArray(item.bullets)
        ? item.bullets
            .filter((b): b is Record<string, unknown> => Boolean(b && typeof b === "object"))
            .map((b, idx) => ({
              id: String(b.id || `b-${idx}`),
              text: String(b.text || ""),
              technologies: Array.isArray(b.technologies) ? b.technologies.map(String) : [],
              roleAffinity: Array.isArray(b.roleAffinity) ? b.roleAffinity.map(String) : [],
              verified: Boolean(b.verified),
              orderIndex: typeof b.orderIndex === "number" ? b.orderIndex : idx,
            }))
        : [],
    }));
  return matchEvidenceToRequirements(evidenceItems, reqs);
}

export { normalizeTailorTabParam, type TailorWorkspaceTab };
export type TailorPrimaryTab = "job-info" | "3-pane";
export type TailorMoreToolTab = "overview" | "cover-letter" | "diagnostic";

export function formatRequirementSourceLabel(sourceOrConfidence: string): string {
  if (sourceOrConfidence === "USER_ADDED") return "Added manually";
  if (sourceOrConfidence === "VERIFIED_ATS") return "Verified ATS source";
  if (sourceOrConfidence === "STRUCTURED_PAGE") return "Structured posting";
  if (sourceOrConfidence === "USER_PASTED" || sourceOrConfidence === "PASTED") {
    return "Pasted job posting";
  }
  return sourceOrConfidence.replace(/_/g, " ").toLowerCase();
}

export function formatJobDiagnosticLabel(statusOrKind: string): string {
  switch (statusOrKind) {
    case "USER_PASTED":
    case "PASTED":
      return "Pasted job posting";
    case "VERIFIED_ATS":
      return "Verified ATS source";
    case "STRUCTURED_PAGE":
      return "Structured posting page";
    case "PARTIAL_EXTRACTION":
      return "Partial posting extraction";
    default:
      return statusOrKind.replace(/_/g, " ").toLowerCase();
  }
}

export const TAILOR_PRIMARY_TABS: ReadonlyArray<{
  id: TailorPrimaryTab;
  label: string;
  testId: string;
}> = [
  { id: "job-info", label: "Job", testId: "tailor-tab-job-info" },
  { id: "3-pane", label: "Review edits", testId: "tailor-tab-3-pane" },
];

export const TAILOR_MORE_TOOLS: ReadonlyArray<{
  id: TailorMoreToolTab;
  label: string;
  testId: string;
}> = [
  { id: "overview", label: "Overview", testId: "tailor-tool-overview" },
  { id: "cover-letter", label: "Cover letter", testId: "tailor-tool-cover-letter" },
  { id: "diagnostic", label: "Diagnostics", testId: "tailor-tool-diagnostic" },
];

export function isPrimaryTailorTab(tab: TailorWorkspaceTab): tab is TailorPrimaryTab {
  return tab === "job-info" || tab === "3-pane";
}

export function isMoreToolTab(tab: TailorWorkspaceTab): tab is TailorMoreToolTab {
  return tab === "overview" || tab === "cover-letter" || tab === "diagnostic";
}

export function getTailorToolLabel(tab: TailorWorkspaceTab): string {
  switch (tab) {
    case "job-info":
      return "Job";
    case "3-pane":
      return "Review edits";
    case "overview":
      return "Overview";
    case "cover-letter":
      return "Cover letter";
    case "diagnostic":
      return "Diagnostics";
  }
}

export function getTailorPanelLabelledBy(tab: TailorWorkspaceTab): string {
  return isPrimaryTailorTab(tab) ? `tailor-tab-${tab}` : `tailor-tool-heading-${tab}`;
}

export function getTailorBackLabel(previousTab: TailorWorkspaceTab | null): string | null {
  if (!previousTab) return null;
  return `← Back to ${getTailorToolLabel(previousTab)}`;
}

export interface TailorNavigationState {
  activeTab: TailorWorkspaceTab;
  previousTab: TailorWorkspaceTab | null;
}

export function createInitialTailorNavigationState(
  tabParam: string | null | undefined
): TailorNavigationState {
  return {
    activeTab: normalizeTailorTabParam(tabParam),
    previousTab: null,
  };
}

export function transitionTailorNavigation(
  state: TailorNavigationState,
  nextTab: TailorWorkspaceTab,
  options?: { preserveReturnRoute?: boolean }
): TailorNavigationState {
  if (options?.preserveReturnRoute && state.activeTab !== nextTab) {
    return {
      activeTab: nextTab,
      previousTab: state.activeTab,
    };
  }
  return {
    activeTab: nextTab,
    previousTab: null,
  };
}

export function TailorWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobIdParam = searchParams.get("jobId");
  const newParam = searchParams.get("new");
  const actionParam = searchParams.get("action");
  const sampleParam = searchParams.get("sample");
  const variantIdParam = searchParams.get("variantId");
  const modeParam = searchParams.get("mode");
  const isExplicitNewEntry =
    newParam === "1" || newParam === "true" || actionParam === "new";
  const isFrontendSampleEntry = sampleParam === "frontend";
  const isExplicitSampleEntry = Boolean(sampleParam);
  const hasExplicitEntryOverride = Boolean(
    jobIdParam || isExplicitNewEntry || isExplicitSampleEntry || variantIdParam || searchParams.get("resumeId")
  );
  const hasInitialJobId = useRef(Boolean(jobIdParam || isExplicitNewEntry || isExplicitSampleEntry));

  const [company, setCompany] = useState(
    jobIdParam || isExplicitNewEntry
      ? ""
      : isFrontendSampleEntry
        ? "WebCraft Systems"
        : "Nova Labs"
  );
  const [roleTitle, setRoleTitle] = useState(
    jobIdParam || isExplicitNewEntry
      ? ""
      : isFrontendSampleEntry
        ? "Frontend Engineer"
        : "Senior Backend Engineer"
  );
  const [rawDescription, setRawDescription] = useState(
    jobIdParam || isExplicitNewEntry
      ? ""
      : isFrontendSampleEntry
        ? SAMPLE_FRONTEND_JD
        : SAMPLE_BACKEND_JD
  );

  const [extractedRequirements, setExtractedRequirements] = useState<JobRequirements | null>(
    jobIdParam || isExplicitNewEntry || isFrontendSampleEntry
      ? null
      : {
          requiredSkills: ["Go", "Python", "Kubernetes", "Docker", "RESTful APIs", "PostgreSQL"],
          preferredSkills: ["AWS/GCP", "GraphQL"],
          domainTerms: ["Distributed Systems", "Microservices"],
          roleTitle: "Senior Backend Engineer",
          company: "Nova Labs",
        }
  );

  const [selectedRoleProfile, setSelectedRoleProfile] = useState<RoleProfile>("Full-stack");
  const tabParam = searchParams.get("tab");
  const [navState, setNavState] = useState<TailorNavigationState>(() =>
    createInitialTailorNavigationState(tabParam)
  );
  const activeTab = navState.activeTab;
  const previousTab = navState.previousTab;
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  const [accountScope, setAccountScope] = useState<ApplicationAccountScope>({
    scopeResolved: false,
  });
  const accountScopeRef = useRef<ApplicationAccountScope>(accountScope);
  accountScopeRef.current = accountScope;

  const [activeVariantId, setActiveVariantId] = useState<string | null>(variantIdParam);
  const [editorMode, setEditorMode] = useState<EditorModeParam | null>(() =>
    normalizeEditorModeParam(modeParam)
  );
  const activeVariantIdRef = useRef<string | null>(activeVariantId);
  activeVariantIdRef.current = activeVariantId;
  const editorModeRef = useRef<EditorModeParam | null>(editorMode);
  editorModeRef.current = editorMode;

  const selectTab = useCallback(
    (nextTab: TailorWorkspaceTab, options?: { preserveReturnRoute?: boolean }) => {
      setNavState((prev) => transitionTailorNavigation(prev, nextTab, options));
      if (accountScopeRef.current.scopeResolved !== false) {
        updateActiveApplicationContext({ tab: nextTab }, accountScopeRef.current);
      }
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        if (url.searchParams.get("tab") !== nextTab) {
          url.searchParams.set("tab", nextTab);
          window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
        }
      }
    },
    []
  );

  useEffect(() => {
    if (tabParam !== null) {
      const normalized = normalizeTailorTabParam(tabParam);
      setNavState((prev) =>
        prev.activeTab === normalized ? prev : { activeTab: normalized, previousTab: null }
      );
    }
  }, [tabParam]);
  const [jobInfoSubTab, setJobInfoSubTab] = useState<"structured" | "original">("original");
  const jobDescriptionRef = useRef<HTMLTextAreaElement>(null);
  const focusJobDescriptionRef = useRef(false);
  const registerJobDescription = useCallback((element: HTMLTextAreaElement | null) => {
    jobDescriptionRef.current = element;
    if (element && focusJobDescriptionRef.current) {
      focusJobDescriptionRef.current = false;
      element.focus();
    }
  }, []);
  const [newUserReqText, setNewUserReqText] = useState("");
  const [customUserReqs, setCustomUserReqs] = useState<ProvenanceRequirement[]>([]);

  const deferredDescription = useDeferredValue(rawDescription);
  const jobDoc = useMemo(() => {
    return parseJobDescriptionDocument({
      text: deferredDescription,
      sourceKind: "PASTED",
    });
  }, [deferredDescription]);

  const [gapSkillToResolve, setGapSkillToResolve] = useState<string | null>(null);
  const [isAutoScanning, setIsAutoScanning] = useState(false);
  const [matches, setMatches] = useState<RankedMatch[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isMatching, setIsMatching] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [isGeneratingPatches, setIsGeneratingPatches] = useState(false);
  const [patchStage, setPatchStage] = useState<AiJobStage>("done");
  const [patchVerified, setPatchVerified] = useState<PatchProposal[]>([]);
  const [patchRejected, setPatchRejected] = useState<RejectedPatch[]>([]);
  const [patchGaps, setPatchGaps] = useState<Gap[]>([]);
  const [patchDecisions, setPatchDecisions] = useState<Record<string, PatchDecision>>({});
  const [acknowledgedSkills, setAcknowledgedSkills] = useState<Set<string>>(new Set());
  const [coverLetterDraft, setCoverLetterDraft] = useState<CoverLetterResponse | null>(null);
  const [patchBatch, setPatchBatch] = useState<{
    batchId: string;
    revisionToken: string;
    baseTypstSource: string;
    jobId: string;
    evidenceRevision?: string;
  } | null>(null);
  const [patchReviewGeneration, setPatchReviewGeneration] = useState(0);
  const [demoPatchBaseSource, setDemoPatchBaseSource] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [resumeReady, setResumeReady] = useState<boolean | null>(null);
  const [masterResumeId, setMasterResumeId] = useState<string | null>(null);
  const masterResumeIdRef = useRef<string | null>(masterResumeId);
  masterResumeIdRef.current = masterResumeId;
  const [masterTypstSource, setMasterTypstSource] = useState<string>("");
  const [masterFactsSnapshot, setMasterFactsSnapshot] = useState<ResumeFacts | null>(null);
  const [validationContext, setValidationContext] = useState<TailoringValidationContext | null>(null);
  const [evidenceMetadata, setEvidenceMetadata] = useState<Record<string, EvidenceMetadataEntry>>({});
  const [verifiedEvidenceCount, setVerifiedEvidenceCount] = useState<number | null>();
  const [activeVariantContent, setActiveVariantContent] = useState<string>("");
  const [patchError, setPatchError] = useState<string | null>(null);
  const [structuredPatchError, setStructuredPatchError] = useState<StructuredPatchError | null>(null);
  const [selectedPatchId, setSelectedPatchId] = useState<string | null>(null);
  const [secondaryDeskTab, setSecondaryDeskTab] = useState<"preview" | "ats" | "job">("preview");
  const [showJobContextSheet, setShowJobContextSheet] = useState(false);
  const [showTypstSource, setShowTypstSource] = useState(false);
  const [showErrorTechDetails, setShowErrorTechDetails] = useState(false);
  const [savedJobId, setSavedJobId] = useState<string | null>(null);
  const savedJobIdRef = useRef<string | null>(null);
  const navControllerRef = useRef(createSaveBeforeNavigationController());
  const navigationErrorRef = useRef<HTMLDivElement>(null);
  const lastFailedNavTargetRef = useRef<{
    target: "settings" | "editor" | "library";
    buildHref: (jobId: string | null) => string;
  } | null>(null);
  const [pendingNavTarget, setPendingNavTarget] = useState<"settings" | "editor" | "library" | null>(null);
  const isOpeningSettings = pendingNavTarget === "settings";
  const isNavigatingAway = pendingNavTarget !== null;
  const [navigationError, setNavigationError] = useState<string | null>(null);
  const [jobLoadError, setJobLoadError] = useState<{
    kind: "not-found" | "forbidden" | "error";
    jobId: string;
    message: string;
  } | null>(null);
  const userEditedRef = useRef(false);
  const saveQueueRef = useRef(Promise.resolve());
  const roleTitleRef = useRef(roleTitle);
  const scanGenerationRef = useRef(0);
  roleTitleRef.current = roleTitle;
  const tabListRef = useRef<HTMLDivElement>(null);
  const [tabIndicator, setTabIndicator] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);
  const [animateTabIndicator, setAnimateTabIndicator] = useState(false);

  const [isTier2Fetching, setIsTier2Fetching] = useState<boolean>(false);
  const [tier2Status, setTier2Status] = useState<{ type: "loading" | "success" | "error"; message: string } | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isLoadingJob, setIsLoadingJob] = useState(Boolean(jobIdParam));
  const [restoredJobId, setRestoredJobId] = useState<string | null>(null);
  const [providerConfigStatus, setProviderConfigStatus] = useState<{
    checked: boolean;
    ready: boolean;
  }>({ checked: false, ready: false });

  const refreshProviderStatus = useCallback(async () => {
    try {
      const [cfg, demoConfig] = await Promise.all([resolveClientProviderConfig(), fetchDemoConfig()]);
      const ready = Boolean(cfg && ProviderConfigSchema.safeParse(cfg).success && (
        !demoConfig.demoMode || (
          cfg.provider !== "ollama" && cfg.provider !== "custom" &&
          cfg.apiKey && cfg.apiKey.length <= 500
        )
      ));
      setProviderConfigStatus({
        checked: true,
        ready,
      });
    } catch {
      setProviderConfigStatus({ checked: true, ready: false });
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleRefresh = () => {
      void refreshProviderStatus();
    };
    window.addEventListener("focus", handleRefresh);
    window.addEventListener("storage", handleRefresh);
    return () => {
      window.removeEventListener("focus", handleRefresh);
      window.removeEventListener("storage", handleRefresh);
    };
  }, [refreshProviderStatus]);

  const [atsResult, setAtsResult] = useState<AtsEvaluationResult | null>(null);

  const loadEvidenceMetadata = useCallback(async (isDemoMode?: boolean) => {
    const buildMap = (items: Array<{
      id: string;
      title?: string;
      organization?: string | null;
      dates?: string | null;
      status?: string;
      verifiedSummary?: string;
      bullets?: Array<{ id: string; text: string }>;
    }>) => {
      const next: Record<string, EvidenceMetadataEntry> = {};
      for (const item of items) {
        if (!item?.id) continue;
        const bulletTexts: Record<string, string> = {};
        if (Array.isArray(item.bullets)) {
          for (const bullet of item.bullets) {
            if (bullet?.id && bullet.text) {
              bulletTexts[bullet.id] = bullet.text;
            }
          }
        }
        next[item.id] = {
          id: item.id,
          title: item.title || item.id,
          organization: item.organization ?? null,
          dates: item.dates ?? null,
          status: item.status || "verified",
          verifiedSummary: item.verifiedSummary || "",
          bulletTexts,
        };
      }
      return next;
    };

    try {
      if (isDemoMode && typeof window !== "undefined") {
        setVerifiedEvidenceCount(getDemoContextFromBrowser()?.evidenceItems.length ?? 0);
        const raw = localStorage.getItem("resumeforge_guest_evidence");
        const parsed = raw ? JSON.parse(raw) : [];
        if (Array.isArray(parsed)) {
          setEvidenceMetadata(buildMap(parsed));
        }
        return;
      }

      const res = await fetch("/api/evidence");
      const { ok, data: json } = await readApiResponse<{
        success?: boolean;
        guest?: boolean;
        data?: Array<{
          id: string;
          title?: string;
          organization?: string | null;
          dates?: string | null;
          status?: string;
          verifiedSummary?: string;
          bullets?: Array<{ id: string; text: string }>;
        }>;
      }>(res);

      if (ok && json?.success && Array.isArray(json.data) && !json.guest) {
        setVerifiedEvidenceCount(json.data.filter((item) => item.status === "verified").length);
        setEvidenceMetadata(buildMap(json.data));
        return;
      }

      setVerifiedEvidenceCount(ok && json?.guest ? 0 : null);

      if (typeof window !== "undefined") {
        const raw = localStorage.getItem("resumeforge_guest_evidence");
        const parsed = raw ? JSON.parse(raw) : [];
        if (Array.isArray(parsed)) {
          setEvidenceMetadata(buildMap(parsed));
        }
      }
    } catch {
      setVerifiedEvidenceCount((count) => count ?? null);
    }
  }, []);

  const diagnosticReport = useMemo(() => {
    if (activeTab !== "diagnostic") return undefined;
    return auditResume({
      resumeText: activeVariantContent || masterTypstSource || "",
      requiredSkills: extractedRequirements?.requiredSkills || [],
      preferredSkills: extractedRequirements?.preferredSkills || [],
    });
  }, [activeTab, activeVariantContent, masterTypstSource, extractedRequirements]);

  useEffect(() => {
    async function loadMasterOrStarterResume() {
      try {
        const [config, sessionUser] = await Promise.all([
          fetchDemoConfig(),
          fetchSessionUser(),
        ]);
        const resolvedScope: ApplicationAccountScope = {
          userId: sessionUser?.id ?? null,
          demoMode: config?.demoMode === true,
          scopeResolved: true,
        };
        setAccountScope(resolvedScope);
        accountScopeRef.current = resolvedScope;

        const entry = resolveTailorEntryContext(searchParams, resolvedScope, {
          explicitNewJob: isExplicitNewEntry,
          explicitSample: isFrontendSampleEntry ? "frontend" : isExplicitSampleEntry ? true : false,
        });
        if (entry.variantId) setActiveVariantId(entry.variantId);
        if (entry.mode) setEditorMode(entry.mode);
        if (entry.source === "stored-active" && entry.jobId) {
          if (!tabParam && entry.tab) {
            setNavState({ activeTab: entry.tab, previousTab: null });
          }
          setRestoredJobId(entry.jobId);
        }

        if (config?.demoMode) {
          setIsDemo(true);
          initializeDemoSamples();
          let localSource = localStorage.getItem("resumeforge_typst_source");
          if (!localSource) {
            const starterResponse = await fetch("/templates/starter-resume.typ").catch(() => null);
            localSource = starterResponse?.ok ? await starterResponse.text() : `// Local demo draft\n= Resume\n\n== Skills\nTypeScript, PostgreSQL\n`;
            localStorage.setItem("resumeforge_typst_source", localSource);
            localStorage.setItem("resumeforge_has_guest_draft", "true");
          }
          setMasterTypstSource(localSource);
          setActiveVariantContent(localSource);
          setResumeReady(Boolean(localSource));
          if (!hasInitialJobId.current && entry.source !== "stored-active" && !hasExplicitEntryOverride) {
            setCompany(DEMO_JOB.company);
            setRoleTitle(DEMO_JOB.roleTitle);
            setRawDescription(DEMO_JOB.rawDescription);
            setExtractedRequirements(DEMO_JOB_REQUIREMENTS);
          }
          const frozen = localStorage.getItem("resumeforge_demo_master_facts");
          try {
            setMasterFactsSnapshot(frozen ? JSON.parse(frozen) as ResumeFacts : null);
          } catch {
            setMasterFactsSnapshot(null);
          }
          await loadEvidenceMetadata(true);
          return;
        }
      } catch {}
      try {
        const [res] = await Promise.all([fetch("/api/resumes"), loadEvidenceMetadata(false)]);
        const { ok, data: json } = await readApiResponse<{
          success?: boolean;
          data?: { id: string; isMaster: boolean; isProtected: boolean; typstSource: string; factSnapshot?: ResumeFacts | null }[];
          validationContext?: TailoringValidationContext | null;
        }>(res);
        if (ok && json?.success && Array.isArray(json.data)) {
          const master = json.data.find((resume) => resume.isMaster);
          setResumeReady(Boolean(master?.isProtected && master.factSnapshot));
          const resume = master ?? json.data[0];
          if (resume) {
            setMasterResumeId(master?.id ?? null);
            setMasterTypstSource(resume.typstSource);
            setActiveVariantContent(resume.typstSource);
            setMasterFactsSnapshot(master?.factSnapshot ?? json.validationContext?.masterBaseline ?? null);
            setValidationContext(json.validationContext ?? null);
            return;
          }
        }
      } catch {}

      try {
        const tRes = await fetch("/templates/starter-resume.typ");
        if (tRes.ok) {
          const text = await tRes.text();
          setMasterTypstSource(text);
          setActiveVariantContent(text);
          return;
        }
      } catch {}

      const defaultSource = `#let resume-section(title) = [ === #title ]\n#resume-section("Skills")\nLanguages: TypeScript, Node.js, Python, PostgreSQL\n#resume-section("Experience")\n*Software Engineer* (2024 - Present)\n- Built REST APIs using Node.js and PostgreSQL.\n`;
      setMasterTypstSource(defaultSource);
      setActiveVariantContent(defaultSource);
    }

    void Promise.all([loadMasterOrStarterResume(), refreshProviderStatus()]).finally(() =>
      setIsBootstrapping(false)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadEvidenceMetadata, refreshProviderStatus]);

  const triggerTier2Fetch = useCallback(async (jobIdToFetch: string) => {
    setIsTier2Fetching(true);
    setTier2Status({
      type: "loading",
      message: "Attempting Tier 2 on-demand full-text fetch from posting page...",
    });

    try {
      const res = await fetch(`/api/jobs/${jobIdToFetch}/fetch-fulltext`, {
        method: "POST",
      });
      const { ok, data: json, error } = await readApiResponse<{
        success?: boolean;
        cached?: boolean;
        data?: { rawDescription: string };
      }>(
        res,
        "Couldn't extract automatically (page requires JavaScript rendering or login). Paste using the Role / Company / Requirements format below."
      );

      if (ok && json?.success && json.data) {
        setExtractedRequirements(null);
        setRawDescription(convertHtmlToCleanMarkdown(json.data.rawDescription));
        setTier2Status({
          type: "success",
          message: json.cached
            ? "Loaded full job description from cache."
            : "Successfully extracted full job description text from external posting page!",
        });
      } else {
        setTier2Status({
          type: "error",
          message:
            error ||
            "Couldn't extract automatically (page requires JavaScript rendering or login). Paste using the Role / Company / Requirements format below.",
        });
      }
    } catch {
      setTier2Status({
        type: "error",
        message: "Network error during fetch — please paste the description manually below.",
      });
    } finally {
      setIsTier2Fetching(false);
    }
  }, []);

  const saveJobNow = async (opts?: {
    forceUpdate?: boolean;
    requirements?: JobRequirements | null;
    requireSuccess?: boolean;
  }): Promise<string | null> => {
    if (!rawDescription.trim()) return null;

    const payload = {
      company: company.trim() || undefined,
      roleTitle: roleTitle.trim() || undefined,
      rawDescription,
      extractedRequirements: opts?.requirements ?? extractedRequirements ?? undefined,
    };

    const existingId = savedJobIdRef.current;
    const demoConfig = await fetchDemoConfig();

    const saveLocalGuestJob = (targetId?: string | null): string => {
      const localId = targetId || `guest-job-${Date.now()}`;
      savedJobIdRef.current = localId;
      setSavedJobId(localId);
      const currentScope: ApplicationAccountScope =
        accountScopeRef.current.scopeResolved !== false
          ? accountScopeRef.current
          : { userId: null, demoMode: demoConfig?.demoMode === true, scopeResolved: true };
      writeActiveApplicationContext(
        {
          jobId: localId,
          tab: activeTabRef.current,
          roleTitle: payload.roleTitle || "Target Role",
          company: payload.company || "Target Company",
          variantId: activeVariantId ?? undefined,
          resumeId: masterResumeId && masterResumeId !== "demo-local" ? masterResumeId : undefined,
          mode: editorMode ?? undefined,
        },
        currentScope
      );
      try {
        const raw = localStorage.getItem("resumeforge_guest_jobs");
        const parsed = raw ? JSON.parse(raw) : [];
        const list = Array.isArray(parsed) ? parsed : [];
        const idx = list.findIndex((item) => item?.id === localId);
        const existingRecord = idx >= 0 ? list[idx] : {};
        const nextRecord = {
          ...existingRecord,
          id: localId,
          company: payload.company || "Target Company",
          roleTitle: payload.roleTitle || "Target Role",
          rawDescription: payload.rawDescription,
          requirements: payload.extractedRequirements,
          status: existingRecord?.status || "SAVED",
        };
        if (idx >= 0) {
          list[idx] = nextRecord;
        } else {
          list.unshift(nextRecord);
        }
        localStorage.setItem("resumeforge_guest_jobs", JSON.stringify(list));
      } catch (error) {
        if (opts?.requireSuccess) throw error;
      }
      setSaveStatus("Job saved to local workspace.");
      return localId;
    };

    if (isLocalOrDemoJobId(existingId, demoConfig?.demoMode === true)) {
      return saveLocalGuestJob(existingId);
    }

    if (existingId) {
      if (opts?.forceUpdate !== false) {
        try {
          const updateRes = await fetch(`/api/jobs/${existingId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const { ok: updateOk, status: updateStatus, data: updateJson, error: updateError } =
            await readApiResponse<{ success?: boolean }>(
              updateRes,
              "Unable to update saved job posting."
            );
          if (updateOk && updateJson?.success) {
            writeActiveApplicationContext(
              {
                jobId: existingId,
                tab: activeTabRef.current,
                roleTitle: payload.roleTitle,
                company: payload.company,
                variantId: activeVariantId ?? undefined,
                resumeId: masterResumeId && masterResumeId !== "demo-local" ? masterResumeId : undefined,
                mode: editorMode ?? undefined,
              },
              accountScopeRef.current
            );
            setSaveStatus("Job posting saved to database.");
            return existingId;
          }
          if (updateStatus === 404) {
            setSaveStatus("Shared catalog postings are read-only; using your edits in-session.");
            return opts?.requireSuccess ? null : existingId;
          }
          setSaveStatus(updateError || "Unable to update saved job posting.");
          return opts?.requireSuccess ? null : existingId;
        } catch {
          setSaveStatus("Network error updating job posting.");
          return opts?.requireSuccess ? null : existingId;
        }
      }
      return existingId;
    }

    const sessionUser = await fetchSessionUser();
    if (!sessionUser) {
      return saveLocalGuestJob(null);
    }

    try {
      const saveRes = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          source: "pasted",
          personal: true,
        }),
      });
      const { ok: saveOk, status: saveStatusCode, data: saveJson, error: saveError } =
        await readApiResponse<{
          success?: boolean;
          code?: string;
          data?: { id: string };
        }>(saveRes, "Failed to save job posting.");
      if (saveOk && saveJson?.success && saveJson.data?.id) {
        savedJobIdRef.current = saveJson.data.id;
        setSavedJobId(saveJson.data.id);
        writeActiveApplicationContext(
          {
            jobId: saveJson.data.id,
            tab: activeTabRef.current,
            roleTitle: payload.roleTitle,
            company: payload.company,
            variantId: activeVariantId ?? undefined,
            resumeId: masterResumeId && masterResumeId !== "demo-local" ? masterResumeId : undefined,
            mode: editorMode ?? undefined,
          },
          { userId: sessionUser.id, demoMode: demoConfig?.demoMode === true, scopeResolved: true }
        );
        setSaveStatus("Job posting saved to database.");
        return saveJson.data.id;
      }
      if (saveStatusCode === 401 || saveJson?.code === "GUEST_READ_ONLY") {
        return saveLocalGuestJob(null);
      }
      if (saveError) {
        setErrorMessage(saveError);
      }
    } catch {}
    return null;
  };

  const ensureJobSaved = (opts?: {
    forceUpdate?: boolean;
    requirements?: JobRequirements | null;
    requireSuccess?: boolean;
  }): Promise<string | null> => {
    const run = saveQueueRef.current.then(() => saveJobNow(opts));
    saveQueueRef.current = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  };

  const handleGeneratePatches = async () => {
    if (!extractedRequirements || nextStep) {
      const message = nextStep === "resume"
        ? isDemo ? "Save a resume draft in the Editor first." : "Save and freeze your master resume in the Editor first."
        : nextStep === "evidence" ? "Add or verify an item in the Evidence Bank first."
        : nextStep === "provider" ? "No AI provider configured. Please configure your API key in Settings."
        : "Extract requirements from the job description first.";
      setStructuredPatchError(null);
      setPatchError(message);
      setPatchStage("error");
      return;
    }

    const aiSettings = await resolveClientProviderConfig();

    if (!aiSettings) {
      setPatchError("No AI provider configured. Please configure your API key in Settings.");
      setPatchStage("error");
      return;
    }

    setIsGeneratingPatches(true);
    setPatchStage("connecting");
    setPatchError(null);
    setStructuredPatchError(null);
    setShowErrorTechDetails(false);
    setSelectedPatchId(null);
    setPatchVerified([]);
    setPatchRejected([]);
    setPatchGaps([]);
    setPatchDecisions({});
    setAcknowledgedSkills(new Set());
    setPatchBatch(null);
    setDemoPatchBaseSource(null);
    setPatchReviewGeneration((generation) => generation + 1);

    try {
      const demoConfig = await fetchDemoConfig();
      const isDemo = demoConfig?.demoMode === true;
      let jobId: string | null = null;
      let demoContext: ReturnType<typeof getDemoContextFromBrowser>;
      if (isDemo) {
        demoContext = getDemoContextFromBrowser();
        const currentSource = masterTypstSource || activeVariantContent;
        if (!demoContext?.masterTypst || demoContext.masterTypst !== currentSource) {
          throw new Error("The local resume changed. Reload the demo workspace before generating patches.");
        }
        setDemoPatchBaseSource(currentSource);
      } else {
        jobId = await ensureJobSaved();
        if (!jobId) throw new Error("Failed to save job posting before patch generation.");
      }

      setPatchStage("writing");
      const res = await fetch(isDemo ? "/api/demo/generate-patches" : "/api/ai/generate-patches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerConfig: {
            provider: aiSettings.provider,
            apiKey: aiSettings.apiKey,
            baseUrl: aiSettings.baseUrl || undefined,
            model: aiSettings.model || undefined,
          },
          jobRequirements: {
            requiredSkills: extractedRequirements.requiredSkills,
            preferredSkills: extractedRequirements.preferredSkills,
            domainTerms: extractedRequirements.domainTerms,
            roleTitle: roleTitle || undefined,
            company: company || undefined,
          },
          ...(isDemo ? (demoContext || {}) : { jobId }),
        }),
      });

      const { ok: patchOk, data: json, error: patchApiError } = await readApiResponse<{
        success?: boolean;
        error?: string;
        errorCategory?: string;
        recoveryAction?: string;
        details?: Record<string, unknown>;
        data?: {
          verified?: PatchProposal[];
          rejected?: RejectedPatch[];
          gaps?: Gap[];
          batch?: {
            batchId: string;
            revisionToken: string;
            baseTypstSource: string;
            jobId: string;
            evidenceRevision?: string;
          } | null;
          masterResumeId?: string | null;
          validationContext?: TailoringValidationContext | null;
          demo?: boolean;
        };
      }>(res, "Failed to generate patches.");

      if (!patchOk || !json?.success || !json.data) {
        const message = json?.error || patchApiError || "Failed to generate patches.";
        const parsedCategory = PatchErrorCategorySchema.safeParse(json?.errorCategory);
        if (parsedCategory.success) {
          setStructuredPatchError({
            category: parsedCategory.data,
            message,
            recoveryAction: json?.recoveryAction || getPatchRecoveryAction(parsedCategory.data),
            details: json?.details,
          });
        }
        setPatchError(message);
        setPatchStage("error");
        setIsGeneratingPatches(false);
        return;
      }

      setPatchStage("verifying");
      const verifiedList: PatchProposal[] = json.data.verified || [];
      const initialDecisions: Record<string, PatchDecision> = {};
      for (const patch of verifiedList) {
        initialDecisions[patch.id] = "pending";
      }
      if (json.data.validationContext) {
        setValidationContext(json.data.validationContext);
        if (json.data.validationContext.masterBaseline) {
          setMasterFactsSnapshot(json.data.validationContext.masterBaseline);
        }
      }
      setPatchDecisions(initialDecisions);
      setAcknowledgedSkills(new Set());
      setPatchVerified(verifiedList);
      setPatchRejected(json.data.rejected || []);
      setPatchGaps(json.data.gaps || []);
      setPatchBatch(json.data.batch || null);
      setMasterResumeId(json.data.masterResumeId || (json.data.demo ? "demo-local" : null));
      setSelectedPatchId(verifiedList[0]?.id ?? null);
      if (verifiedList.length > 0) {
        setSecondaryDeskTab("preview");
      }
      selectTab("3-pane");
      void loadEvidenceMetadata(isDemo);
      setPatchStage("done");
    } catch (err) {
      setPatchError(`Error: ${err instanceof Error ? err.message : String(err)}`);
      setPatchStage("error");
    } finally {
      setIsGeneratingPatches(false);
    }
  };

  const matchGuestEvidenceLocally = useCallback((reqs: JobRequirements): RankedMatch[] => {
    if (typeof window === "undefined") return [];
    try {
      initializeDemoSamples();
      const raw = localStorage.getItem("resumeforge_guest_evidence");
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      return matchGuestEvidenceItems(parsed, reqs);
    } catch {
      return [];
    }
  }, []);

  const handleExtract = async () => {
    if (!rawDescription.trim()) {
      setErrorMessage("Please paste a job description before extracting requirements.");
      return;
    }

    const extractGeneration = ++scanGenerationRef.current;
    setIsAutoScanning(false);
    setErrorMessage(null);
    setIsExtracting(true);

    try {
      const [demoConfig, sessionUser] = await Promise.all([
        fetchDemoConfig(),
        fetchSessionUser(),
      ]);
      if (extractGeneration !== scanGenerationRef.current) return;

      if (!sessionUser || demoConfig?.demoMode) {
        const parsed = parseJobDescription(rawDescription);
        setExtractedRequirements(parsed);
        if (parsed.roleTitle && !roleTitle) {
          setRoleTitle(parsed.roleTitle);
        }
        await ensureJobSaved({ forceUpdate: true, requirements: parsed });
        await fetchMatches(parsed);
        return;
      }

      const res = await fetch("/api/jobs/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawDescription }),
      });

      const { ok, status, data: json, error } = await readApiResponse<{
        success?: boolean;
        data?: JobRequirements;
      }>(res, "Failed to extract requirements.");
      if (extractGeneration !== scanGenerationRef.current) return;
      if (!ok || !json?.success || !json.data) {
        if (status === 401 || demoConfig?.demoMode) {
          const parsed = parseJobDescription(rawDescription);
          setExtractedRequirements(parsed);
          if (parsed.roleTitle && !roleTitle) {
            setRoleTitle(parsed.roleTitle);
          }
          await ensureJobSaved({ forceUpdate: true, requirements: parsed });
          await fetchMatches(parsed);
          return;
        }
        setErrorMessage(error || "Failed to extract requirements.");
        setIsExtracting(false);
        return;
      }

      setExtractedRequirements(json.data);
      if (json.data.roleTitle && !roleTitle) {
        setRoleTitle(json.data.roleTitle);
      }

      // Persist posting + extracted requirements into PostgreSQL
      await ensureJobSaved({ forceUpdate: true, requirements: json.data });

      await fetchMatches(json.data);
    } catch (err) {
      if (extractGeneration !== scanGenerationRef.current) return;
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      if (extractGeneration === scanGenerationRef.current) {
        setIsExtracting(false);
      }
    }
  };

  const handleSaveJob = async () => {
    const id = await ensureJobSaved({ forceUpdate: true });
    if (id) {
      setSaveStatus("Job posting saved successfully!");
    } else {
      setErrorMessage("Failed to save job posting.");
    }
  };

  const fetchMatches = useCallback(async (reqs: JobRequirements, signal?: AbortSignal) => {
    setIsMatching(true);
    try {
      const demoConfig = await fetchDemoConfig();
      if (signal?.aborted) return;
      if (demoConfig?.demoMode) {
        setMatches(matchGuestEvidenceLocally(reqs));
        return;
      }

      const res = await fetch("/api/jobs/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reqs),
        signal,
      });
      if (signal?.aborted) return;

      const { ok, status, data: json } = await readApiResponse<{
        success?: boolean;
        data?: RankedMatch[];
      }>(res);
      if (ok && json?.success && Array.isArray(json.data)) {
        setMatches(json.data);
      } else if (status === 401) {
        setMatches(matchGuestEvidenceLocally(reqs));
      }
    } catch (err) {
      if (signal?.aborted) return;
      console.error("Match error:", err);
    } finally {
      setIsMatching(false);
    }
  }, [matchGuestEvidenceLocally]);

  const targetJobToLoad = jobIdParam || restoredJobId;
  const loadedFromStoredRef = useRef(false);
  loadedFromStoredRef.current = Boolean(!jobIdParam && restoredJobId);

  useEffect(() => {
    if (!targetJobToLoad) return;
    const controller = new AbortController();
    const { signal } = controller;
    setIsLoadingJob(true);
    setJobLoadError(null);
    userEditedRef.current = false;
    setCoverLetterDraft(null);
    setExtractedRequirements(null);
    setMatches([]);

    async function loadJobById(jobId: string) {
      try {
        const [demoConfig, sessionUser] = await Promise.all([
          fetchDemoConfig(),
          fetchSessionUser(),
        ]);
        const demoMode = demoConfig?.demoMode === true;
        if (signal.aborted) return;
        const localOnly = isLocalOrDemoJobId(jobId, demoMode);
        const resolvedScope: ApplicationAccountScope = {
          userId: sessionUser?.id ?? null,
          demoMode,
          scopeResolved: true,
        };
        type LoadedJob = {
          id: string;
          company?: string | null;
          roleTitle?: string | null;
          rawDescription?: string;
          requirements?: unknown;
          extractedRequirements?: unknown;
          requirementsStatus?: string;
        };
        let job: LoadedJob | null = null;
        let responseStatus: number | null = null;

        if (localOnly) {
          if (demoMode) initializeDemoSamples();
          const jobs = JSON.parse(localStorage.getItem("resumeforge_guest_jobs") ?? "[]");
          job = (Array.isArray(jobs) ? jobs.find((item) => item?.id === jobId) : null) ??
            (jobId === DEMO_JOB.id ? DEMO_JOB : null);
        } else {
          const res = await fetch(`/api/jobs/${jobId}`, { signal });
          responseStatus = res.status;
          const { ok, data: json } = await readApiResponse<{ success?: boolean; data?: LoadedJob }>(res);
          if (ok && json?.success && json.data) job = json.data;
        }

        if (signal.aborted || userEditedRef.current) return;
        if (!job) {
          const activeStored = readActiveApplicationContext(resolvedScope);
          if (loadedFromStoredRef.current || activeStored?.jobId === jobId) {
            clearActiveApplicationContext();
          }
          savedJobIdRef.current = null;
          setSavedJobId(null);
          if (responseStatus === 401 || responseStatus === 403) {
            setJobLoadError({
              kind: "forbidden",
              jobId,
              message: "That job posting belongs to a different account or requires sign-in. Return to Jobs to pick an available role.",
            });
          } else {
            setJobLoadError({
              kind: "not-found",
              jobId,
              message: "This job posting could not be found—it may have been deleted or belong to another session.",
            });
          }
          return;
        }

        setJobLoadError(null);
        setCompany(job.company ?? "");
        setRoleTitle(job.roleTitle ?? "");
        setRawDescription(convertHtmlToCleanMarkdown(job.rawDescription ?? ""));
        savedJobIdRef.current = localOnly ? null : job.id;
        setSavedJobId(savedJobIdRef.current);

        const storedRequirements = localOnly
          ? job.requirements ?? (job.id === DEMO_JOB.id ? DEMO_JOB_REQUIREMENTS : undefined)
          : job.requirementsStatus === "ready" ? job.extractedRequirements : undefined;
        const parsed = JobRequirementsSchema.safeParse(storedRequirements);
        if (parsed.success && job.rawDescription?.trim()) {
          setExtractedRequirements(parsed.data);
          void fetchMatches(parsed.data, signal);
        }
        writeActiveApplicationContext(
          {
            jobId: job.id,
            tab: activeTabRef.current,
            roleTitle: job.roleTitle ?? undefined,
            company: job.company ?? undefined,
            variantId: activeVariantIdRef.current ?? undefined,
            resumeId:
              masterResumeIdRef.current && masterResumeIdRef.current !== "demo-local"
                ? masterResumeIdRef.current
                : undefined,
            mode: editorModeRef.current ?? undefined,
          },
          resolvedScope
        );
        const restoredChoices = readPendingReviewChoices(job.id, resolvedScope);
        if (restoredChoices && Object.keys(restoredChoices.decisions).length > 0) {
          setPatchDecisions(restoredChoices.decisions);
          if (restoredChoices.acknowledgedSkills.length > 0) {
            setAcknowledgedSkills(new Set(restoredChoices.acknowledgedSkills));
          }
        }
        if (!localOnly && job.rawDescription && isPlaceholderDescription(job.rawDescription)) {
          void triggerTier2Fetch(job.id);
        }
      } catch {
        if (!signal.aborted) {
          setJobLoadError({
            kind: "error",
            jobId,
            message: "Unable to load that job posting right now. Return to Jobs or start a new posting below.",
          });
        }
      } finally {
        if (!signal.aborted) setIsLoadingJob(false);
      }
    }

    void loadJobById(targetJobToLoad);
    return () => controller.abort();
  }, [targetJobToLoad, fetchMatches, triggerTier2Fetch]);

  const handleRemoveRequirement = (category: "required" | "preferred" | "domain", termToRemove: string) => {
    if (!extractedRequirements) return;

    const updated: JobRequirements = {
      ...extractedRequirements,
      requiredSkills:
        category === "required"
          ? extractedRequirements.requiredSkills.filter((t) => t !== termToRemove)
          : extractedRequirements.requiredSkills,
      preferredSkills:
        category === "preferred"
          ? extractedRequirements.preferredSkills.filter((t) => t !== termToRemove)
          : extractedRequirements.preferredSkills,
      domainTerms:
        category === "domain"
          ? extractedRequirements.domainTerms.filter((t) => t !== termToRemove)
          : extractedRequirements.domainTerms,
    };

    setExtractedRequirements(updated);
    fetchMatches(updated);
  };

  const coveredSkills = useMemo(() => {
    const skills = [
      ...(extractedRequirements?.requiredSkills ?? []),
      ...(extractedRequirements?.preferredSkills ?? []),
    ];
    const covered = new Set<string>();
    if (skills.length === 0 || matches.length === 0) return covered;
    for (const skill of skills) {
      const needle = skill.toLowerCase();
      const isMatch = matches.some(
        (m) =>
          m.matchedRequirements.some(
            (r) => r.toLowerCase().includes(needle) || needle.includes(r.toLowerCase())
          ) ||
          m.verifiedSummary.toLowerCase().includes(needle) ||
          m.matchedBullets.some((b) => b.text.toLowerCase().includes(needle))
      );
      if (isMatch) covered.add(skill);
    }
    return covered;
  }, [extractedRequirements, matches]);

  const { verifiedRequiredSkills, missingRequiredSkills } = useMemo(() => {
    const required = extractedRequirements?.requiredSkills ?? [];
    return {
      verifiedRequiredSkills: required.filter((s) => coveredSkills.has(s)),
      missingRequiredSkills: required.filter((s) => !coveredSkills.has(s)),
    };
  }, [extractedRequirements, coveredSkills]);

  const highlightedJdView = useMemo(
    () => renderHighlightedJd(rawDescription, extractedRequirements?.requiredSkills ?? []),
    [rawDescription, extractedRequirements?.requiredSkills]
  );

  const pendingRescanRef = useRef(false);

  // Auto-rescan debounce when rawDescription changes (runs before auto-save to prevent double DB writes)
  useEffect(() => {
    if (!userEditedRef.current || !rawDescription.trim() || rawDescription.length < 50) {
      pendingRescanRef.current = false;
      return;
    }

    pendingRescanRef.current = true;
    const generation = ++scanGenerationRef.current;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      if (generation !== scanGenerationRef.current) return;
      try {
        setIsAutoScanning(true);
        const [demoConfig, sessionUser] = await Promise.all([
          fetchDemoConfig(),
          fetchSessionUser(),
        ]);
        if (generation !== scanGenerationRef.current || controller.signal.aborted) return;

        if (!sessionUser || demoConfig?.demoMode) {
          const parsed = parseJobDescription(rawDescription);
          pendingRescanRef.current = false;
          setExtractedRequirements(parsed);
          if (parsed.roleTitle && !roleTitleRef.current) {
            setRoleTitle(parsed.roleTitle);
          }
          await fetchMatches(parsed, controller.signal);
          void ensureJobSaved({ forceUpdate: true, requirements: parsed });
          return;
        }

        const res = await fetch("/api/jobs/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rawDescription }),
          signal: controller.signal,
        });
        const { ok, status, data: json, error } = await readApiResponse<{
          success?: boolean;
          data?: JobRequirements;
        }>(res, "Sign in to extract job requirements.");
        if (generation !== scanGenerationRef.current) return;
        pendingRescanRef.current = false;
        if (status === 401) {
          const parsed = parseJobDescription(rawDescription);
          setExtractedRequirements(parsed);
          if (parsed.roleTitle && !roleTitleRef.current) {
            setRoleTitle(parsed.roleTitle);
          }
          await fetchMatches(parsed, controller.signal);
          void ensureJobSaved({ forceUpdate: true, requirements: parsed });
          return;
        }
        if (ok && json?.success && json.data) {
          setExtractedRequirements(json.data);
          if (json.data.roleTitle && !roleTitleRef.current) {
            setRoleTitle(json.data.roleTitle);
          }
          await fetchMatches(json.data, controller.signal);
        } else {
          if (error) setErrorMessage(error);
          void ensureJobSaved({ forceUpdate: true });
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        pendingRescanRef.current = false;
        void ensureJobSaved({ forceUpdate: true });
        console.error("Auto-rescan error:", err);
      } finally {
        if (generation === scanGenerationRef.current) {
          pendingRescanRef.current = false;
          setIsAutoScanning(false);
        }
      }
    }, 1200);

    return () => {
      pendingRescanRef.current = false;
      controller.abort();
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawDescription]);

  // Ensure a job record exists so CoverLetterPanel can generate,
  // and keep company / role / description / requirements synced in PostgreSQL.
  useEffect(() => {
    if (!userEditedRef.current) return;
    if (!rawDescription.trim()) return;
    if (pendingRescanRef.current) return;
    const timer = setTimeout(() => {
      void ensureJobSaved({ forceUpdate: true });
    }, 900);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawDescription, company, roleTitle, extractedRequirements]);

  // Refresh matches when requirements present on mount
  useEffect(() => {
    if (extractedRequirements) {
      void fetchMatches(extractedRequirements);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Measure active tab pill synchronously before paint; animate only between two visible primary tabs
  const prevTabIndicatorRef = useRef<typeof tabIndicator>(null);
  useLayoutEffect(() => {
    const container = tabListRef.current;
    if (!container) return;

    const measure = () => {
      const activeEl = container.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
      if (!activeEl) {
        prevTabIndicatorRef.current = null;
        setAnimateTabIndicator(false);
        setTabIndicator(null);
        return;
      }
      const hadPreviousIndicator = prevTabIndicatorRef.current !== null;
      const next = {
        left: activeEl.offsetLeft,
        top: activeEl.offsetTop,
        width: activeEl.offsetWidth,
        height: activeEl.offsetHeight,
      };
      prevTabIndicatorRef.current = next;
      setAnimateTabIndicator(hadPreviousIndicator);
      setTabIndicator(next);
    };

    measure();
    if (typeof document !== "undefined" && document.fonts?.ready) {
      void document.fonts.ready.then(() => {
        if (tabListRef.current === container) measure();
      });
    }

    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    observer?.observe(container);
    container.querySelectorAll<HTMLElement>('[role="tab"]').forEach((tabEl) => observer?.observe(tabEl));
    return () => {
      observer?.disconnect();
    };
  }, [activeTab, isBootstrapping, isLoadingJob]);

  const tabButtonClass = (tab: TailorPrimaryTab) =>
    `relative z-10 flex min-h-11 items-center gap-1.5 sm:gap-2 rounded-lg px-2.5 sm:px-3 text-sm font-medium whitespace-nowrap transition-colors ${
      activeTab === tab
        ? tabIndicator
          ? "text-foreground"
          : "bg-elevated text-foreground border border-hairline"
        : "text-muted-foreground hover:text-foreground"
    }`;

  const evidenceTitlesMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const [id, entry] of Object.entries(evidenceMetadata)) {
      map[id] = entry.organization ? `${entry.title} (${entry.organization})` : entry.title;
    }
    return map;
  }, [evidenceMetadata]);

  const effectiveSecondaryTab: "preview" | "ats" | "job" =
    patchVerified.length === 0 && secondaryDeskTab === "preview" ? "ats" : secondaryDeskTab;

  const isSampleJob = !savedJobId && company === "Nova Labs" && rawDescription === SAMPLE_BACKEND_JD;
  const hasJobRequirements = extractedRequirements !== null;
  const hasJobDescription = Boolean(rawDescription.trim());
  const hasVerifiedEvidence = Boolean(verifiedEvidenceCount);
  const readiness = [
    {
      label: isDemo ? "Resume draft" : "Master resume",
      ready: resumeReady === true,
      detail: resumeReady ? (isDemo ? "Saved in this browser" : "Frozen in Editor")
        : resumeReady === null ? "Status unavailable" : "Save required",
    },
    {
      label: "Evidence Bank",
      ready: hasVerifiedEvidence,
      detail: verifiedEvidenceCount === undefined ? "Checking…"
        : verifiedEvidenceCount === null ? "Status unavailable"
        : hasVerifiedEvidence ? `${verifiedEvidenceCount} verified ${verifiedEvidenceCount === 1 ? "item" : "items"}`
        : "Verified evidence needed",
    },
    {
      label: "Job requirements",
      ready: hasJobRequirements,
      detail: hasJobRequirements ? "Extracted" : isExtracting || isAutoScanning ? "Extracting…"
        : hasJobDescription ? "Extraction needed" : "Job description needed",
    },
    {
      label: "AI provider",
      ready: providerConfigStatus.ready,
      detail: providerConfigStatus.ready ? "Configured" : providerConfigStatus.checked ? "Setup needed" : "Checking…",
    },
  ];
  const nextStep = !hasJobRequirements ? "job" : !resumeReady ? "resume"
    : !hasVerifiedEvidence ? "evidence" : !providerConfigStatus.ready ? "provider" : null;

  const handleJobSetup = () => {
    if (activeTab !== "job-info") selectTab("job-info", { preserveReturnRoute: true });
    setJobInfoSubTab("original");
    if (hasJobDescription) {
      void handleExtract();
    } else if (jobDescriptionRef.current) {
      jobDescriptionRef.current.focus();
    } else {
      focusJobDescriptionRef.current = true;
    }
  };

  const navigateWithSave = async (
    target: "settings" | "editor" | "library",
    buildTargetHref: (resolvedJobId: string | null) => string
  ) => {
    if (navControllerRef.current.isPending) return;
    setPendingNavTarget(target);
    setNavigationError(null);
    lastFailedNavTargetRef.current = { target, buildHref: buildTargetHref };

    const currentJobId = savedJobIdRef.current || jobIdParam;
    const hasPendingSave = userEditedRef.current && Boolean(rawDescription.trim());
    const hasPendingReviewChoices = Object.values(patchDecisions).some((d) => d !== "pending");

    const outcome = await navControllerRef.current.execute<string | null>({
      hasPendingSave,
      hasPendingReviewChoices,
      canPreserveReviewChoices: Boolean(currentJobId),
      preserveReviewChoices: () => {
        if (!currentJobId) return false;
        return Boolean(
          writePendingReviewChoices(
            {
              jobId: currentJobId,
              batchId: patchBatch?.batchId ?? null,
              decisions: patchDecisions,
              acknowledgedSkills: Array.from(acknowledgedSkills),
            },
            accountScopeRef.current
          )
        );
      },
      save: async () => {
        const savedId = await ensureJobSaved({ forceUpdate: true, requireSuccess: true });
        if (!savedId) {
          return {
            ok: false,
            error: "Could not save your job draft. Your edits are still here. Please retry.",
          };
        }
        return { ok: true, context: savedId };
      },
      onNavigate: (resolvedId) => {
        const activeJobId = resolvedId ?? savedJobIdRef.current ?? jobIdParam;
        router.push(buildTargetHref(activeJobId));
      },
      onErrorFocus: () => {
        requestAnimationFrame(() => navigationErrorRef.current?.focus());
      },
    });

    if (outcome.status === "failed") {
      setNavigationError(outcome.error);
      setPendingNavTarget(null);
    } else if (outcome.status === "cancelled") {
      setPendingNavTarget(null);
    }
  };

  const handleOpenSettings = async () => {
    await navigateWithSave("settings", (activeJobId) =>
      buildSettingsHref({
        from: "tailor",
        tab: activeTab,
        jobId: activeJobId,
        variantId: activeVariantId,
        resumeId: masterResumeId && masterResumeId !== "demo-local" ? masterResumeId : null,
        mode: editorMode,
      })
    );
  };

  const handleOpenEditor = async (overrideVariantId?: string | null) => {
    await navigateWithSave("editor", (activeJobId) =>
      buildEditorHref({
        variantId: overrideVariantId ?? activeVariantId,
        resumeId: masterResumeId && masterResumeId !== "demo-local" ? masterResumeId : null,
        mode: editorMode,
        from: "tailor",
        tab: activeTab,
        jobId: activeJobId,
      })
    );
  };

  const handleOpenLibrary = async (skill?: string) => {
    await navigateWithSave("library", (activeJobId) =>
      buildLibraryHref({
        from: "tailor",
        tab: activeTab,
        jobId: activeJobId,
        variantId: activeVariantId,
        resumeId: masterResumeId && masterResumeId !== "demo-local" ? masterResumeId : null,
        mode: editorMode,
        skill: skill ?? null,
      })
    );
  };

  const updateJobDescription = (description: string) => {
    userEditedRef.current = true;
    setJobLoadError(null);
    scanGenerationRef.current++;
    setIsExtracting(false);
    setIsAutoScanning(false);
    setRawDescription(description);
    setExtractedRequirements(null);
    setMatches([]);
  };

  const handleClearSampleJob = () => {
    savedJobIdRef.current = null;
    setSavedJobId(null);
    setJobLoadError(null);
    setCompany("");
    setRoleTitle("");
    updateJobDescription("");
    setCustomUserReqs([]);
    selectTab("job-info");
    setJobInfoSubTab("original");
  };

  if (isBootstrapping || isLoadingJob) {
    return <PageSkeleton variant="tailor" />;
  }

  return (
    <AppShell variant="tailor">
      <div className="relative z-10 flex-1 pt-4 md:pt-8 pb-12 px-4 md:px-8 max-w-[1600px] mx-auto w-full font-body-regular motion-reduce:[&_*]:transition-none motion-reduce:[&_.animate-spin]:animate-none motion-reduce:[&_.animate-pulse]:animate-none">
        <PageHeader
          title="Tailor"
          className="mb-4 gap-3 md:[&>div:last-child]:max-w-none"
          statusBadge={
            isAutoScanning ? (
              <span
                data-testid="auto-scanning-indicator"
                className="flex items-center gap-1.5 rounded-full border border-status-warning/40 bg-status-warning/15 px-2.5 py-0.5 text-xs font-mono text-status-warning animate-pulse"
              >
                <Loader2 className="h-3 w-3 animate-spin" /> Auto-rescanning...
              </span>
            ) : undefined
          }
          actions={
            <div className="grid w-full min-w-0 gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center xl:gap-5">
              <ul
                id="tailor-readiness"
                data-testid="tailor-readiness"
                aria-label="Resume edit prerequisites"
                tabIndex={-1}
                className="grid scroll-mt-20 grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4 xl:gap-x-5"
              >
                {readiness.map(({ label, ready, detail }) => (
                  <li key={label} className="min-w-0 text-xs leading-snug">
                    <p className="font-semibold text-foreground">{label}</p>
                    <div className={`mt-0.5 flex items-start gap-1.5 ${ready ? "text-status-success-soft" : "text-muted-foreground"}`}>
                      {ready ? <CheckCircle2 className="size-3.5 shrink-0" aria-hidden />
                        : <AlertTriangle className="size-3.5 shrink-0" aria-hidden />}
                      {label === "AI provider" && nextStep !== "provider" && !ready && providerConfigStatus.checked ? (
                        <button
                          type="button"
                          onClick={() => void handleOpenSettings()}
                          disabled={isNavigatingAway}
                          className="text-left font-medium underline underline-offset-2 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-60"
                        >
                          {isOpeningSettings ? "Saving…" : "Configure in Settings"}
                        </button>
                      ) : (label === "Master resume" || label === "Resume draft") && nextStep !== "resume" && ready === false ? (
                        <button
                          type="button"
                          onClick={() => void handleOpenEditor()}
                          disabled={isNavigatingAway}
                          className="text-left font-medium underline underline-offset-2 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-60"
                        >
                          {pendingNavTarget === "editor"
                            ? "Saving…"
                            : isDemo
                              ? "Open resume draft"
                              : "Save in Editor"}
                        </button>
                      ) : label === "Evidence Bank" && nextStep !== "evidence" && verifiedEvidenceCount === 0 ? (
                        <button
                          type="button"
                          onClick={() => void handleOpenLibrary()}
                          disabled={isNavigatingAway}
                          className="text-left font-medium underline underline-offset-2 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-60"
                        >
                          {pendingNavTarget === "library" ? "Saving…" : "Open Evidence Bank"}
                        </button>
                      ) : <span>{detail}</span>}
                    </div>
                  </li>
                ))}
              </ul>

              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 max-sm:[&>*]:h-11 max-sm:[&>*]:px-2.5 md:justify-end">
                {nextStep === "job" && (
                  <Button onClick={handleJobSetup} disabled={isExtracting}>
                    {isExtracting ? "Extracting…" : hasJobDescription ? "Extract requirements" : "Paste job description"}
                  </Button>
                )}
                {nextStep === "resume" && (
                  <Button onClick={() => void handleOpenEditor()} disabled={isNavigatingAway}>
                    {pendingNavTarget === "editor"
                      ? "Saving…"
                      : isDemo
                        ? "Open resume draft"
                        : "Save a master résumé"}
                  </Button>
                )}
                {nextStep === "evidence" && (
                  <Button onClick={() => void handleOpenLibrary()} disabled={isNavigatingAway}>
                    {pendingNavTarget === "library"
                      ? "Saving…"
                      : verifiedEvidenceCount === 0
                        ? "Verify evidence"
                        : "Open Evidence Bank"}
                  </Button>
                )}
                {nextStep === "provider" && (
                  <Button onClick={() => void handleOpenSettings()} disabled={isNavigatingAway || !providerConfigStatus.checked}>
                    {isOpeningSettings ? "Saving…" : "Configure in Settings"}
                  </Button>
                )}
                <Button
                  onClick={handleGeneratePatches}
                  disabled={isGeneratingPatches}
                  variant={nextStep ? "ghost" : "default"}
                  aria-describedby="tailor-readiness"
                  data-testid="generate-patches-btn"
                >
                  {isGeneratingPatches ? <Loader2 className="animate-spin" aria-hidden /> : <Sparkles aria-hidden />}
                  Suggest resume edits
                </Button>
              </div>
              {navigationError && (
                <div
                  ref={navigationErrorRef}
                  tabIndex={-1}
                  role="alert"
                  className="flex flex-wrap items-center gap-3 text-sm text-status-danger xl:col-span-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                >
                  <span>{navigationError}</span>
                  {lastFailedNavTargetRef.current && (
                    <button
                      type="button"
                      onClick={() => {
                        const retryTarget = lastFailedNavTargetRef.current;
                        if (retryTarget) void navigateWithSave(retryTarget.target, retryTarget.buildHref);
                      }}
                      className="rounded border border-status-danger/40 bg-status-danger/10 px-2.5 py-1 text-xs font-semibold text-status-danger hover:bg-status-danger/20"
                    >
                      Retry save &amp; continue
                    </button>
                  )}
                </div>
              )}
            </div>
          }
        />

        {jobLoadError && (
          <div
            role="alert"
            data-testid="job-load-error-banner"
            className="mb-4 rounded-xl border border-status-danger/40 bg-status-danger/10 p-4 flex flex-wrap items-center justify-between gap-3 text-sm"
          >
            <div className="flex items-start gap-2.5 min-w-0">
              <AlertTriangle className="h-4 w-4 text-status-danger shrink-0 mt-0.5" aria-hidden />
              <p className="text-foreground break-words">{jobLoadError.message}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Link
                href="/tracker"
                data-testid="job-load-error-back-to-jobs"
                className={buttonVariants({ variant: "default", size: "sm" })}
              >
                Back to Jobs
              </Link>
              <button
                type="button"
                onClick={handleClearSampleJob}
                className="min-h-9 rounded-md border border-control bg-panel px-3 text-xs font-medium text-foreground hover:bg-elevated"
              >
                Start a new job
              </button>
            </div>
          </div>
        )}

        <div
          data-testid="active-job-header-banner"
          className="mb-4 rounded-xl surface-raised edge-glow px-4 py-3 flex flex-wrap items-center justify-between gap-2 sm:px-5"
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-medium text-muted-foreground">{company || "Untitled company"}</p>
              {isSampleJob && (
                <span
                  data-testid="sample-job-badge"
                  className="inline-flex items-center rounded-full border border-status-warning/40 bg-status-warning/15 px-2 py-0.5 text-xs font-semibold text-status-warning"
                >
                  Sample job
                </span>
              )}
            </div>
            <p className="mt-0.5 break-words text-xl font-semibold leading-snug text-foreground">
              {roleTitle || "Untitled role"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono tabular-nums">
            {isSampleJob && (
              <button
                type="button"
                data-testid="clear-sample-job-btn"
                onClick={handleClearSampleJob}
                className="min-h-8 inline-flex items-center gap-1 rounded-md border border-control bg-panel px-2.5 py-1 font-sans text-xs font-medium text-foreground hover:bg-elevated transition-colors"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
                Clear sample &amp; paste job
              </button>
            )}
            <span className="rounded-md border border-hairline bg-elevated px-2.5 py-1 text-on-surface-variant">
              {savedJobId ? "Saved posting" : isSampleJob ? "Sample preset" : "Working draft"}
            </span>
            {atsResult && (
              <span className="rounded-md border border-hairline bg-inset px-2.5 py-1 text-foreground">
                ATS {atsResult.overallScore}%
              </span>
            )}
            <div className="inline-flex min-h-10 min-w-0 max-w-full items-center gap-2 rounded-md border border-hairline bg-panel px-2.5 py-1 font-sans">
              <label
                htmlFor="tailor-role-profile-select"
                className="shrink-0 whitespace-nowrap text-xs font-medium leading-none text-muted-foreground"
              >
                ATS profile
              </label>
              <select
                id="tailor-role-profile-select"
                value={selectedRoleProfile}
                onChange={(e) => setSelectedRoleProfile(e.target.value as RoleProfile)}
                className="h-8 min-w-0 max-w-full cursor-pointer rounded bg-transparent py-0 text-sm font-medium leading-normal text-foreground focus-visible:outline-2 focus-visible:outline-primary"
                data-testid="tailor-role-profile-select"
              >
                {ROLE_PROFILES.map((profile) => (
                  <option key={profile} value={profile} className="bg-panel text-foreground">
                    {profile}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {(isGeneratingPatches || (patchStage !== "done" && patchStage !== "queued") || patchError) && (
          <div className="mb-4 space-y-2">
            <AiProgress
              stage={patchStage}
              stages={["connecting", "writing", "verifying", "done"]}
              error={patchError}
              onDismissError={() => {
                setPatchError(null);
                setStructuredPatchError(null);
                setPatchStage("done");
              }}
            />
            {structuredPatchError && (
              <div
                role="alert"
                data-testid="generate-patches-structured-error"
                className="rounded-xl border border-status-danger/40 bg-status-danger/10 p-4 text-sm text-foreground transition-opacity duration-150 motion-reduce:transition-none space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="font-semibold text-status-danger break-words">{structuredPatchError.message}</p>
                    <p className="text-sm text-text-secondary break-words">
                      Suggested recovery:{" "}
                      {structuredPatchError.recoveryAction === "review_evidence"
                        ? "Verify or restore evidence citations in your Evidence Bank."
                        : "Regenerate suggestions against your current master resume and evidence."}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {structuredPatchError.recoveryAction === "review_evidence" && (
                      <button
                        type="button"
                        onClick={() => void handleOpenLibrary()}
                        disabled={isNavigatingAway}
                        className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-status-danger/40 bg-status-danger/15 px-3 text-xs font-semibold text-status-danger hover:bg-status-danger/25 disabled:opacity-60"
                      >
                        {pendingNavTarget === "library" ? "Saving…" : "Review evidence"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleGeneratePatches()}
                      disabled={isGeneratingPatches}
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
                    >
                      <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                      Generate updated suggestions
                    </button>
                  </div>
                </div>
                {structuredPatchError.details && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowErrorTechDetails((prev) => !prev)}
                      aria-expanded={showErrorTechDetails}
                      className="inline-flex items-center gap-1 text-xs font-mono text-status-danger hover:underline"
                    >
                      <ChevronDown className={`h-3.5 w-3.5 ${showErrorTechDetails ? "rotate-180" : ""}`} aria-hidden />
                      Technical details ({structuredPatchError.category})
                    </button>
                    {showErrorTechDetails && (
                      <pre className="mt-2 overflow-x-auto rounded border border-status-danger/35 bg-inset p-2.5 font-mono text-xs text-text-secondary break-all whitespace-pre-wrap">
                        {JSON.stringify(structuredPatchError.details, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {(errorMessage || saveStatus) && (
          <div className="mb-4 space-y-2">
            {errorMessage && (
              <div className="rounded-lg border border-status-danger/40 bg-status-danger/10 px-3 py-2 text-xs text-status-danger flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {errorMessage}
              </div>
            )}
            {saveStatus && (
              <div className="rounded-lg border status-success-surface px-3 py-2 text-xs flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> {saveStatus}
              </div>
            )}
          </div>
        )}

        {tier2Status && (
          <div
            className={`mb-4 rounded-lg border px-3 py-2 text-xs flex items-start gap-2 ${
              tier2Status.type === "error"
                ? "border-status-danger/40 bg-status-danger/10 text-status-danger"
                : tier2Status.type === "success"
                ? "status-success-surface"
                : "border-hairline bg-panel text-text-secondary"
            }`}
          >
            {isTier2Fetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            <span>{tier2Status.message}</span>
          </div>
        )}

        {/* Tab Navigation & Secondary Tools */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div
            ref={tabListRef}
            className="relative inline-flex max-w-full items-center gap-1 rounded-xl border p-1 glass-bar [&>button:focus-visible]:outline [&>button:focus-visible]:outline-2 [&>button:focus-visible]:outline-primary [&>button:focus-visible]:outline-offset-2"
            role="tablist"
            aria-label="Tailor views"
            onKeyDown={(event) => {
              if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
              const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
              const current = tabs.indexOf(document.activeElement as HTMLButtonElement);
              if (current < 0) return;
              const next =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                  ? tabs.length - 1
                  : (current + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
              event.preventDefault();
              tabs[next].focus();
              tabs[next].click();
            }}
          >
            <span
              aria-hidden="true"
              data-testid="tailor-tab-indicator"
              className={`pointer-events-none absolute left-0 top-0 rounded-lg border border-hairline bg-elevated shadow-[var(--shadow-1)] motion-reduce:transition-none ${
                animateTabIndicator ? "transition-[transform,width,height] duration-200 ease-out" : ""
              }`}
              style={
                tabIndicator
                  ? {
                      transform: `translate(${tabIndicator.left}px, ${tabIndicator.top}px)`,
                      width: `${tabIndicator.width}px`,
                      height: `${tabIndicator.height}px`,
                      opacity: 1,
                    }
                  : { opacity: 0 }
              }
            />

            <button
              type="button"
              role="tab"
              id="tailor-tab-job-info"
              aria-controls="tailor-view-panel"
              tabIndex={activeTab === "3-pane" ? -1 : 0}
              aria-selected={activeTab === "job-info"}
              onClick={() => selectTab("job-info")}
              data-testid="tailor-tab-job-info"
              className={tabButtonClass("job-info")}
            >
              <Briefcase className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>Job</span>
            </button>

            <button
              type="button"
              role="tab"
              id="tailor-tab-3-pane"
              aria-controls="tailor-view-panel"
              tabIndex={activeTab === "3-pane" ? 0 : -1}
              aria-selected={activeTab === "3-pane"}
              onClick={() => selectTab("3-pane")}
              data-testid="tailor-tab-3-pane"
              className={tabButtonClass("3-pane")}
            >
              <Columns3 className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>Review edits</span>
            </button>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                data-testid="tailor-more-tools-trigger"
                data-active-tool={isMoreToolTab(activeTab) ? activeTab : undefined}
                className={`min-h-11 inline-flex items-center gap-1.5 rounded-xl border px-3 text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 ${
                  isMoreToolTab(activeTab)
                    ? "border-primary/45 bg-elevated text-foreground shadow-[var(--shadow-1)]"
                    : "border-hairline glass-bar text-muted-foreground hover:text-foreground"
                }`}
              >
                <span>More tools</span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="min-w-[13rem] border-control bg-elevated text-foreground shadow-[var(--shadow-2)]"
            >
              {TAILOR_MORE_TOOLS.map((tool) => {
                const isActive = activeTab === tool.id;
                const Icon =
                  tool.id === "overview"
                    ? Sparkles
                    : tool.id === "cover-letter"
                    ? FileText
                    : AlertTriangle;
                return (
                  <DropdownMenuItem
                    key={tool.id}
                    data-testid={tool.testId}
                    onSelect={() => selectTab(tool.id)}
                    className={`min-h-10 cursor-pointer gap-2 px-3 py-2 text-sm focus:bg-panel focus:text-foreground ${
                      isActive ? "bg-panel/80 font-semibold text-foreground" : "text-on-surface-variant"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                    <span className="flex-1">{tool.label}</span>
                    {isActive && <Check className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div
          id="tailor-view-panel"
          role="tabpanel"
          tabIndex={0}
          aria-labelledby={getTailorPanelLabelledBy(activeTab)}
        >
        {isMoreToolTab(activeTab) && (
          <div
            data-testid="tailor-secondary-tool-banner"
            className="mb-4 rounded-xl surface-raised px-4 py-3 flex flex-wrap items-center justify-between gap-3"
          >
            <div className="min-w-0 space-y-0.5">
              <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                More tools
              </p>
              <h2
                id={`tailor-tool-heading-${activeTab}`}
                className="text-lg font-semibold text-foreground"
              >
                {getTailorToolLabel(activeTab)}
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                data-testid="tool-back-to-job-btn"
                onClick={() => selectTab("job-info")}
                className="min-h-10 rounded-md border border-control bg-inset px-3 text-xs font-medium text-foreground hover:bg-elevated transition-colors"
              >
                ← Job
              </button>
              <button
                type="button"
                data-testid="tool-back-to-review-btn"
                onClick={() => selectTab("3-pane")}
                className="min-h-10 rounded-md border border-control bg-inset px-3 text-xs font-medium text-foreground hover:bg-elevated transition-colors"
              >
                Review edits →
              </button>
            </div>
          </div>
        )}
        {activeTab === "3-pane" ? (
          /* Workstream 2 Review-First Workspace (~60% Primary Review / ~40% Resume Preview) */
          <div className="space-y-4" data-testid="tailor-3pane-container">
            {/* Compact Context Bar */}
            <div className="rounded-xl surface-raised px-4 py-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5 min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 min-w-0">
                  <Briefcase className="h-4 w-4 text-primary shrink-0" aria-hidden />
                  <span className="text-sm font-semibold text-foreground break-words">
                    {roleTitle || "Untitled role"}
                  </span>
                  {company && (
                    <span className="text-xs text-muted-foreground break-words">
                      ·{"\u00A0"}{company}
                    </span>
                  )}
                </div>
                {atsResult && (
                  <span className="rounded-md border border-hairline bg-elevated px-2 py-0.5 text-xs font-mono tabular-nums text-foreground">
                    ATS {atsResult.overallScore}%
                  </span>
                )}
                {extractedRequirements && (
                  <span className="rounded-md border border-hairline bg-inset px-2 py-0.5 text-xs font-mono tabular-nums text-muted-foreground">
                    {verifiedRequiredSkills.length}/{extractedRequirements.requiredSkills.length} req skills
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowJobContextSheet(true)}
                  data-testid="workspace-job-details-btn"
                  className="min-h-10 px-3 rounded-md border border-control bg-inset text-xs font-medium text-foreground hover:bg-elevated flex items-center gap-1.5"
                >
                  <Briefcase className="h-3.5 w-3.5 text-primary" aria-hidden />
                  Requirements &amp; JD
                </button>
                <button
                  type="button"
                  onClick={() => setShowTypstSource((prev) => !prev)}
                  data-testid="toggle-typst-source-btn"
                  aria-pressed={showTypstSource}
                  className={`min-h-10 px-3 rounded-md border text-xs font-medium flex items-center gap-1.5 ${
                    showTypstSource
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-control bg-inset text-foreground hover:bg-elevated"
                  }`}
                >
                  <Code2 className="h-3.5 w-3.5" aria-hidden />
                  {showTypstSource ? "Hide Typst Source" : "Typst Source"}
                </button>
                <button
                  type="button"
                  onClick={() => selectTab("job-info", { preserveReturnRoute: true })}
                  data-testid="edit-job-info-btn"
                  className="min-h-10 px-2.5 text-xs text-primary hover:underline shrink-0"
                >
                  Edit job &amp; requirements →
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-6 items-start">
              {/* Primary Review Pane (~60% desktop, full-width below xl) */}
              <section
                className="min-w-0 rounded-xl surface-raised p-4 sm:p-5 flex flex-col gap-4"
                data-testid="tailor-pane-center"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-hairline">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 text-primary shrink-0" aria-hidden />
                    <h2 className="text-lg text-foreground font-semibold">
                      Suggested edits
                    </h2>
                  </div>
                </div>

                {(patchVerified.length > 0 || patchRejected.length > 0 || patchGaps.length > 0) &&
                masterResumeId &&
                (savedJobId || masterResumeId === "demo-local") ? (
                  <PatchDiffReview
                    key={`${patchReviewGeneration}-${patchBatch?.batchId || "local"}`}
                    verified={patchVerified}
                    rejected={patchRejected}
                    gaps={patchGaps}
                    masterTypstSource={masterTypstSource || activeVariantContent}
                    jobId={savedJobId || "demo-local-job"}
                    batch={patchBatch}
                    localOnly={masterResumeId === "demo-local"}
                    localBaseTypstSource={demoPatchBaseSource}
                    masterFactsSnapshot={masterFactsSnapshot}
                    validationContext={validationContext}
                    onValidationContextUpdate={(nextCtx) => {
                      setValidationContext(nextCtx);
                      if (nextCtx.masterBaseline) {
                        setMasterFactsSnapshot(nextCtx.masterBaseline);
                      }
                    }}
                    evidenceMetadata={evidenceMetadata}
                    decisions={patchDecisions}
                    onDecisionsChange={setPatchDecisions}
                    acknowledgedSkills={acknowledgedSkills}
                    onAcknowledgedSkillsChange={setAcknowledgedSkills}
                    selectedPatch={selectedPatchId}
                    onSelectedPatchChange={setSelectedPatchId}
                    onRegeneratePatches={() => void handleGeneratePatches()}
                    renderInlinePreview={false}
                    tailorTab={activeTab}
                    masterResumeId={masterResumeId === "demo-local" ? null : masterResumeId}
                    editorMode={editorMode}
                    onApplySuccess={(variantId, mergedContent) => {
                      setActiveVariantContent(mergedContent);
                      clearPendingReviewChoices();
                      if (masterResumeId === "demo-local") {
                        setMasterTypstSource(mergedContent);
                        localStorage.setItem("resumeforge_typst_source", mergedContent);
                        setSaveStatus("Job-specific variant applied to your working draft — ATS will re-score against updated content.");
                      } else {
                        setActiveVariantId(variantId);
                        updateActiveApplicationContext({ variantId }, accountScopeRef.current);
                        setSaveStatus("Job-specific variant saved — ATS will re-score against your job-specific variant.");
                      }
                    }}
                  />
                ) : (
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {nextStep ? (
                      <><a href="#tailor-readiness" className="font-medium text-primary underline underline-offset-2">Complete setup</a> to see suggested edits here.</>
                    ) : "Use Suggest resume edits to compare proposed changes and check citations here."}
                  </p>
                )}

                {showTypstSource && (
                  <div className="flex flex-col space-y-2 pt-3 border-t border-hairline">
                    <div className="flex items-center justify-between text-xs text-muted-foreground font-mono tabular-nums">
                      <span>
                        Resume source (
                        {activeVariantId
                          ? "job-specific variant"
                          : masterResumeId && masterResumeId !== "demo-local"
                            ? "master résumé"
                            : "working draft"}
                        )
                      </span>
                      <span>{(activeVariantContent || masterTypstSource).split("\n").length} lines</span>
                    </div>
                    <pre
                      data-testid="typst-ast-preview"
                      className="overflow-y-auto max-h-[420px] p-4 bg-inset border border-hairline rounded font-mono text-xs text-on-surface-variant leading-relaxed whitespace-pre-wrap break-words selection:bg-primary/30"
                    >
                      {activeVariantContent || masterTypstSource || "// Loading Typst source..."}
                    </pre>
                  </div>
                )}
              </section>

              {/* Secondary Pane (~40% desktop): Live Paper Preview + ATS + On-Demand Job Context */}
              <aside
                className="min-w-0 xl:sticky xl:top-6 rounded-xl surface-raised p-4 sm:p-5 flex flex-col gap-4"
                data-testid="tailor-pane-right"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-hairline">
                  <div className="flex items-center gap-1 rounded-lg border border-hairline bg-inset p-1" role="tablist" aria-label="Review details">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={effectiveSecondaryTab === "preview"}
                      disabled={patchVerified.length === 0}
                      onClick={() => setSecondaryDeskTab("preview")}
                      data-testid="workspace-secondary-preview-tab"
                      className={`min-h-9 px-3 rounded-md text-xs font-medium flex items-center gap-1.5 disabled:opacity-45 ${
                        effectiveSecondaryTab === "preview"
                          ? "bg-elevated text-foreground border border-hairline"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Eye className="h-3.5 w-3.5" aria-hidden />
                      Preview {patchVerified.length > 0 ? `(${patchVerified.length})` : ""}
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={effectiveSecondaryTab === "ats"}
                      onClick={() => setSecondaryDeskTab("ats")}
                      data-testid="workspace-secondary-ats-tab"
                      className={`min-h-9 px-3 rounded-md text-xs font-medium flex items-center gap-1.5 ${
                        effectiveSecondaryTab === "ats"
                          ? "bg-elevated text-foreground border border-hairline"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <ClipboardCheck className="h-3.5 w-3.5" aria-hidden />
                      ATS {atsResult ? `${atsResult.overallScore}%` : "Score"}
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={effectiveSecondaryTab === "job"}
                      onClick={() => setSecondaryDeskTab("job")}
                      data-testid="workspace-secondary-job-tab"
                      className={`min-h-9 px-3 rounded-md text-xs font-medium flex items-center gap-1.5 ${
                        effectiveSecondaryTab === "job"
                          ? "bg-elevated text-foreground border border-hairline"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Briefcase className="h-3.5 w-3.5" aria-hidden />
                      Job Details
                    </button>
                  </div>
                </div>

                {effectiveSecondaryTab === "preview" && patchVerified.length > 0 && (
                  <div className="transition-opacity duration-150 motion-reduce:transition-none">
                    <SuggestionPreview
                      base={masterResumeId === "demo-local" ? demoPatchBaseSource : patchBatch?.baseTypstSource}
                      current={masterTypstSource || activeVariantContent}
                      validBatch={
                        masterResumeId === "demo-local"
                          ? Boolean(demoPatchBaseSource)
                          : Boolean(patchBatch && patchBatch.baseTypstSource && patchBatch.jobId === (savedJobId || "demo-local-job"))
                      }
                      localStorageSourceKey={masterResumeId === "demo-local" ? "resumeforge_typst_source" : undefined}
                      patches={patchVerified}
                      decisions={patchDecisions}
                      selected={selectedPatchId}
                      onSelect={setSelectedPatchId}
                      onDecision={(id, decision) =>
                        setPatchDecisions((prev) => ({
                          ...prev,
                          [id]: decision,
                        }))
                      }
                      evidenceTitles={evidenceTitlesMap}
                    />
                  </div>
                )}

                <div className={effectiveSecondaryTab === "ats" ? "transition-opacity duration-150 motion-reduce:transition-none" : "hidden"}>
                  {extractedRequirements && (activeVariantContent || masterTypstSource) ? (
                    <div className="overflow-y-auto max-h-[720px] pr-1">
                      <AtsScorePanel
                        appearance="tailor"
                        typstContent={activeVariantContent || masterTypstSource}
                        extractedRequirements={extractedRequirements}
                        roleTitle={roleTitle}
                        rawDescription={rawDescription}
                        evaluatedSourceLabel={
                          activeVariantId
                            ? "job-specific variant"
                            : masterResumeId && masterResumeId !== "demo-local"
                              ? "master résumé"
                              : "working draft"
                        }
                        initialProfile={selectedRoleProfile}
                        onProfileChange={setSelectedRoleProfile}
                        onEvaluationComplete={setAtsResult}
                        includeEvidenceBank
                        className="!bg-transparent !border-0 !shadow-none !p-0"
                      />
                    </div>
                  ) : (
                    <div className="p-4 rounded border border-hairline bg-inset text-xs text-muted-foreground font-mono">
                      Extract job requirements to calculate deterministic ATS match score.
                    </div>
                  )}
                </div>

                {effectiveSecondaryTab === "job" && (
                  <div className="space-y-4 transition-opacity duration-150 motion-reduce:transition-none">
                    {extractedRequirements && extractedRequirements.requiredSkills.length > 0 && (
                      <div className="space-y-1.5 pb-3 border-b border-hairline">
                        <span className="text-xs text-muted-foreground font-medium block">
                          Required Skills &amp; Gaps
                        </span>
                        <TechDiffPillList
                          allRequiredSkills={extractedRequirements.requiredSkills}
                          verifiedSkillNames={verifiedRequiredSkills}
                          missingSkillNames={missingRequiredSkills}
                          maxDisplay={10}
                        />
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <span className="text-xs text-muted-foreground font-medium block">
                        Job Description (Keywords Highlighted)
                      </span>
                      <div
                        data-testid="tailor-jd-highlighted-view"
                        className="overflow-y-auto max-h-[540px] p-4 bg-inset border border-hairline rounded-lg text-sm text-on-surface-variant space-y-2 leading-relaxed break-words"
                      >
                        {highlightedJdView}
                      </div>
                    </div>
                  </div>
                )}
              </aside>
            </div>
          </div>
        ) : activeTab === "overview" ? (
          <section className="rounded-xl surface-raised p-5 space-y-6" data-testid="tailor-overview-panel">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-hairline">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary shrink-0" aria-hidden />
                <h2 className="text-lg leading-snug text-foreground font-semibold">
                  Tailoring Overview
                </h2>
              </div>
              <button
                type="button"
                onClick={() => selectTab("job-info", { preserveReturnRoute: true })}
                data-testid="edit-job-info-btn"
                className="min-h-11 text-sm text-primary hover:underline"
              >
                Edit job &amp; requirements →
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-lg border border-hairline bg-inset p-4 space-y-2">
                <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Review &amp; ATS</p>
                <p className="text-2xl font-bold tabular-nums text-foreground">
                  {atsResult ? `${atsResult.overallScore}%` : "Ready"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {patchVerified.length > 0
                    ? `${patchVerified.length} verified suggestions (${Object.values(patchDecisions).filter((d) => d === "accepted").length} accepted)`
                    : `Profile: ${selectedRoleProfile}`}
                </p>
                <button
                  type="button"
                  onClick={() => selectTab("3-pane")}
                  data-testid="overview-open-workspace-btn"
                  className="inline-flex min-h-11 sm:min-h-0 items-center text-xs font-semibold text-primary hover:underline"
                >
                  Review edits →
                </button>
              </div>

              <div className="rounded-lg border border-hairline bg-inset p-4 space-y-2">
                <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Requirements &amp; Matches</p>
                <p className="text-2xl font-bold tabular-nums text-foreground">
                  {extractedRequirements ? extractedRequirements.requiredSkills.length : 0} skills
                </p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {matches.length} evidence bank matches found
                </p>
                <button
                  type="button"
                  onClick={() => selectTab("job-info", { preserveReturnRoute: true })}
                  className="inline-flex min-h-11 sm:min-h-0 items-center text-xs font-semibold text-primary hover:underline"
                >
                  Review job &amp; requirements →
                </button>
              </div>

              <div className="rounded-lg border border-hairline bg-inset p-4 space-y-2">
                <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Cover Letter</p>
                <p className="text-2xl font-bold text-foreground">
                  {coverLetterDraft ? "Draft ready" : savedJobId ? "Unlocked" : "Save job"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Evidence-grounded letter tailored to this posting
                </p>
                <button
                  type="button"
                  onClick={() => selectTab("cover-letter")}
                  data-testid="overview-open-cover-letter-btn"
                  className="inline-flex min-h-11 sm:min-h-0 items-center text-xs font-semibold text-primary hover:underline"
                >
                  Open Cover letter →
                </button>
              </div>

              <div className="rounded-lg border border-hairline bg-inset p-4 space-y-2">
                <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Diagnostics</p>
                <p className="text-2xl font-bold text-foreground">Audit</p>
                <p className="text-xs text-muted-foreground">
                  Deterministic checks and grounded resume fixes
                </p>
                <button
                  type="button"
                  onClick={() => selectTab("diagnostic")}
                  data-testid="overview-open-diagnostics-btn"
                  className="inline-flex min-h-11 sm:min-h-0 items-center text-xs font-semibold text-primary hover:underline"
                >
                  Open Diagnostics →
                </button>
              </div>
            </div>

            {extractedRequirements && extractedRequirements.requiredSkills.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-hairline">
                <span className="text-xs text-muted-foreground font-medium block">
                  Key Required Skills &amp; Gaps
                </span>
                <TechDiffPillList
                  allRequiredSkills={extractedRequirements.requiredSkills}
                  verifiedSkillNames={verifiedRequiredSkills}
                  missingSkillNames={missingRequiredSkills}
                  maxDisplay={8}
                />
              </div>
            )}
          </section>
        ) : activeTab === "cover-letter" ? (
          <section
            id="cover-letter-section"
            data-testid="tailor-cover-letter-section"
            className="rounded-xl surface-raised p-5 flex flex-col"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-2 border-b border-hairline">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="h-4 w-4 text-primary shrink-0" aria-hidden />
                <h2 className="text-lg text-foreground font-semibold">
                  {coverLetterDraft ? "Generated Cover Letter" : "Cover Letter"}
                </h2>
              </div>
            </div>
            {savedJobId ? (
              <CoverLetterPanel
                jobId={savedJobId}
                company={company}
                roleTitle={roleTitle}
                rawDescription={rawDescription}
                extractedRequirements={extractedRequirements || undefined}
                activeRoleProfile={selectedRoleProfile}
                draftCoverLetter={coverLetterDraft}
                onDraftCoverLetterChange={setCoverLetterDraft}
              />
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-hairline bg-inset p-4">
                <p className="text-sm text-on-surface-variant">
                  Save the current job posting to generate an evidence-grounded cover letter tailored to{" "}
                  <span className="text-primary font-semibold">{company || "this role"}</span>.
                </p>
                <button
                  type="button"
                  onClick={() => void handleSaveJob()}
                  data-testid="unlock-cover-letter-btn"
                  className="inline-flex min-h-11 sm:min-h-0 items-center justify-center shrink-0 rounded-md bg-primary px-3 py-1.5 font-mono text-xs font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
                >
                  Save Job &amp; Unlock Cover Letter
                </button>
              </div>
            )}
          </section>
        ) : activeTab === "diagnostic" ? (
          <TailorDiagnosticPanel
            report={diagnosticReport}
            typstAst={activeVariantContent}
            evidence={matches}
            variantContext={{ masterResumeId, jobId: savedJobId }}
            validationContext={validationContext}
            onValidationContextUpdate={(nextCtx) => {
              setValidationContext(nextCtx);
              if (nextCtx.masterBaseline) {
                setMasterFactsSnapshot(nextCtx.masterBaseline);
              }
            }}
            onPatchApplied={(patchedTypstAst) => {
              setActiveVariantContent(patchedTypstAst);
              setSaveStatus("Deterministic fix applied to working copy — review, then save or re-run guardrail.");
            }}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] gap-6">
          <div className="flex flex-col gap-6 min-w-0">
              <>
                {/* Job Info & Requirements View */}
                <section className="rounded-xl surface-raised p-4 sm:p-5" data-testid="tailor-job-info-panel">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2 border-b border-hairline sm:mb-4">
                    <div className="flex items-center gap-2 min-w-0">
                      <Briefcase className="h-4 w-4 text-primary shrink-0" aria-hidden />
                      <h2 className="text-lg text-foreground font-semibold">Target Job Posting</h2>
                    </div>
                    {previousTab !== null && (
                      <button
                        type="button"
                        onClick={() => selectTab(previousTab)}
                        data-testid="back-to-overview-btn"
                        className="min-h-11 text-sm text-primary hover:underline"
                      >
                        {getTailorBackLabel(previousTab)}
                      </button>
                    )}
                  </div>

                  {/* Critical extraction warning remains prominent outside disclosure */}
                  {jobDoc.diagnostics.status === "PARTIAL_EXTRACTION" && (
                    <div
                      data-testid="confidence-banner-partial-extraction"
                      className="mb-4 p-3 rounded-lg bg-status-warning/10 border border-status-warning/35 text-sm text-status-warning flex items-start gap-2"
                    >
                      <AlertTriangle className="size-4 text-status-warning shrink-0" />
                      <span>Partial Extraction: Description may be incomplete. Paste full description below.</span>
                    </div>
                  )}

                  {/* Sub-tab Selector */}
                  <div className="flex flex-wrap items-center gap-1 rounded-lg bg-inset p-1 mb-3 sm:mb-5">
                    <button
                      type="button"
                      onClick={() => setJobInfoSubTab("original")}
                      data-testid="job-subtab-original"
                      className={`min-h-11 px-3 text-sm rounded-md transition-colors ${
                        jobInfoSubTab === "original"
                          ? "bg-elevated text-foreground font-medium"
                          : "text-muted-foreground hover:text-foreground hover:bg-elevated/50"
                      }`}
                    >
                      Job input
                    </button>
                    <button
                      type="button"
                      onClick={() => setJobInfoSubTab("structured")}
                      data-testid="job-subtab-structured"
                      className={`min-h-11 px-3 text-sm rounded-md transition-colors ${
                        jobInfoSubTab === "structured"
                          ? "bg-elevated text-foreground font-medium"
                          : "text-muted-foreground hover:text-foreground hover:bg-elevated/50"
                      }`}
                    >
                      Breakdown
                    </button>
                  </div>

                  {/* Subtab 1: Structured Breakdown */}
                  {jobInfoSubTab === "structured" && (
                    <div className="space-y-4 text-sm">
                      {/* Sections breakdown */}
                      <div className="space-y-2.5">
                        <span className="text-xs font-medium text-muted-foreground block">
                          Document Sections ({jobDoc.sections.length})
                        </span>
                        {jobDoc.sections.map((sec) => (
                          <div
                            key={sec.id}
                            className="p-3 rounded bg-inset border border-hairline space-y-1.5"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-bold text-[#ffb77d]">{sec.heading}</span>
                              <span className="text-xs px-1.5 py-0.5 rounded bg-elevated text-text-secondary font-semibold uppercase">
                                {sec.kind}
                              </span>
                            </div>
                            <div className="text-text-secondary text-sm whitespace-pre-wrap leading-relaxed break-words">
                              {sec.markdown}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Add Custom Requirement */}
                      <div className="p-3 rounded bg-inset border border-hairline space-y-2">
                        <span className="font-semibold text-text-secondary block">
                          Add Custom Requirement
                        </span>
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="text"
                            value={newUserReqText}
                            onChange={(e) => setNewUserReqText(e.target.value)}
                            placeholder="e.g. 5+ years Go microservices experience"
                            data-testid="add-user-requirement-input"
                            className="min-w-0 min-h-11 flex-1 bg-panel border border-hairline px-3 text-sm text-foreground rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (!newUserReqText.trim()) return;
                              const newReq = createUserRequirement(newUserReqText.trim());
                              setCustomUserReqs((prev) => [...prev, newReq]);
                              if (extractedRequirements) {
                                setExtractedRequirements({
                                  ...extractedRequirements,
                                  requiredSkills: Array.from(
                                    new Set([...extractedRequirements.requiredSkills, newReq.label])
                                  ),
                                });
                              }
                              setNewUserReqText("");
                            }}
                            data-testid="add-user-requirement-btn"
                            className="min-h-11 px-3 rounded-lg border border-hairline text-foreground font-medium text-sm hover:bg-elevated"
                          >
                            Add Requirement
                          </button>
                        </div>
                        {customUserReqs.length > 0 && (
                          <div className="pt-2 space-y-1">
                            <span className="text-xs text-muted-foreground">Custom User Requirements:</span>
                            <div className="flex flex-wrap gap-1.5">
                              {customUserReqs.map((req) => (
                                <span
                                  key={req.id}
                                  className="px-2 py-0.5 rounded bg-status-warning/10 border border-status-warning/35 text-xs text-status-warning flex items-center gap-1"
                                >
                                  <span>{req.label}</span>
                                  <span className="text-xs px-1.5 py-0.5 rounded bg-status-warning/20 text-status-warning font-semibold">
                                    {formatRequirementSourceLabel(req.confidence)}
                                  </span>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Subtab 2: Original Source */}
                  {jobInfoSubTab === "original" && (
                    <div className="space-y-4">
                      <div>
                        <div className="flex flex-wrap items-center justify-between gap-x-2">
                          <label htmlFor="tailor-job-description" className="text-xs font-medium text-muted-foreground">
                            Job description
                          </label>
                          <button
                            type="button"
                            onClick={handleExtract}
                            disabled={isExtracting}
                            data-testid="extract-reqs-btn"
                            className="min-h-11 text-sm text-primary hover:underline"
                          >
                            {isExtracting ? "Scanning..." : "Extract Requirements"}
                          </button>
                        </div>
                        <textarea
                          id="tailor-job-description"
                          ref={registerJobDescription}
                          value={rawDescription}
                          onChange={(e) => updateJobDescription(e.target.value)}
                          rows={8}
                          data-testid="jd-textarea"
                          placeholder={JD_PASTE_TEMPLATE}
                          className="w-full bg-inset text-foreground text-base sm:text-sm p-4 rounded-lg border border-hairline resize-y leading-relaxed"
                        />
                        {tier2Status?.type === "error" ? (
                          <pre className="mt-2 whitespace-pre-wrap rounded border border-hairline bg-inset p-3 font-mono text-xs leading-relaxed text-muted-foreground">
                            {JD_PASTE_TEMPLATE}
                          </pre>
                        ) : null}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="tailor-company" className="block text-xs font-medium text-muted-foreground mb-2">Company</label>
                          <input
                            id="tailor-company"
                            name="company"
                            type="text"
                            autoComplete="organization"
                            value={company}
                            onChange={(e) => {
                              userEditedRef.current = true;
                              setCompany(e.target.value);
                            }}
                            className="w-full min-h-11 bg-inset border border-hairline px-3 text-base sm:text-sm text-foreground rounded-lg"
                          />
                        </div>
                        <div>
                          <label htmlFor="tailor-role" className="block text-xs font-medium text-muted-foreground mb-2">Role</label>
                          <input
                            id="tailor-role"
                            name="role"
                            type="text"
                            autoComplete="off"
                            value={roleTitle}
                            onChange={(e) => {
                              userEditedRef.current = true;
                              setRoleTitle(e.target.value);
                            }}
                            className="w-full min-h-11 bg-inset border border-hairline px-3 text-base sm:text-sm text-foreground rounded-lg"
                          />
                          {roleTitle.length > 32 && (
                            <p className="mt-2 break-words text-sm leading-relaxed text-muted-foreground">{roleTitle}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          data-testid="sample-backend-btn"
                          onClick={() => {
                            setCompany("Nova Labs");
                            setRoleTitle("Senior Backend Engineer");
                            updateJobDescription(SAMPLE_BACKEND_JD);
                          }}
                          className="min-h-11 text-sm px-3 rounded-lg border border-hairline text-text-secondary hover:bg-elevated hover:text-foreground"
                        >
                          Sample Backend JD
                        </button>
                        <button
                          type="button"
                          data-testid="sample-frontend-btn"
                          onClick={() => {
                            setCompany("WebCraft Systems");
                            setRoleTitle("Frontend Engineer");
                            updateJobDescription(SAMPLE_FRONTEND_JD);
                          }}
                          className="min-h-11 text-sm px-3 rounded-lg border border-hairline text-text-secondary hover:bg-elevated hover:text-foreground"
                        >
                          Sample Frontend JD
                        </button>
                        <button
                          type="button"
                          data-testid="save-job-btn"
                          onClick={() => void handleSaveJob()}
                          className="min-h-11 text-sm px-3 rounded-lg border border-hairline text-text-secondary hover:bg-elevated hover:text-foreground"
                        >
                          Save Job
                        </button>
                        <button
                          type="button"
                          data-testid="open-3pane-tailor-btn"
                          onClick={() => selectTab("3-pane")}
                          className="min-h-11 text-sm px-3 rounded-lg border border-hairline text-text-secondary hover:bg-elevated hover:text-foreground transition"
                        >
                          Review edits →
                        </button>
                      </div>
                    </div>
                  )}

                  <details
                    data-testid="job-extraction-diagnostics-details"
                    className="mt-4 rounded-lg border border-hairline bg-inset px-3 py-2 text-xs"
                  >
                    <summary
                      data-testid="job-extraction-diagnostics-summary"
                      className="cursor-pointer select-none py-1 font-mono text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 rounded"
                    >
                      Extraction diagnostics · {formatJobDiagnosticLabel(jobDoc.diagnostics.status)}
                    </summary>
                    <div className="mt-3 space-y-3 border-t border-hairline pt-3 font-mono text-xs">
                      {jobDoc.diagnostics.status === "VERIFIED_ATS" && (
                        <div
                          data-testid="confidence-banner-verified-ats"
                          className="p-3 rounded-lg status-success-surface border text-sm font-sans flex items-start gap-2"
                        >
                          <CheckCircle2 className="size-4 text-status-success shrink-0" />
                          <span>Verified ATS Source: Loaded directly from official ATS endpoint. No action needed.</span>
                        </div>
                      )}
                      {jobDoc.diagnostics.status === "STRUCTURED_PAGE" && (
                        <div
                          data-testid="confidence-banner-structured-page"
                          className="p-3 rounded-lg bg-signal/10 border border-signal/35 text-sm font-sans text-signal flex items-start gap-2"
                        >
                          <FileText className="size-4 text-signal shrink-0" />
                          <span>Structured Page Extraction: Review extracted sections before tailoring.</span>
                        </div>
                      )}
                      {jobDoc.diagnostics.status === "USER_PASTED" && (
                        <div
                          data-testid="confidence-banner-user-pasted"
                          className="p-3 rounded-lg bg-panel border border-hairline text-sm font-sans text-text-secondary flex items-start gap-2"
                        >
                          <FileText className="size-4 text-muted-foreground shrink-0" />
                          <span>Pasted job posting: Review and edit the job description as needed.</span>
                        </div>
                      )}
                      <div className="p-3 rounded bg-panel border border-hairline space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-muted-foreground">Source type:</span>
                          <span className="px-2 py-0.5 rounded bg-signal/10 text-signal border border-signal/35 font-semibold text-xs">
                            {formatJobDiagnosticLabel(jobDoc.sourceKind)}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-muted-foreground">Acquired At:</span>
                          <span className="text-foreground text-xs break-all">{jobDoc.acquiredAt}</span>
                        </div>
                        <div className="space-y-1">
                          <span className="text-muted-foreground block">Content Hash (SHA-256):</span>
                          <code className="block p-1.5 rounded bg-inset border border-hairline text-xs text-status-success break-all">
                            {jobDoc.contentHash}
                          </code>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                          <span className="text-muted-foreground">Diagnostics Status:</span>
                          <span className="px-2 py-0.5 rounded status-success-surface border font-semibold text-xs">
                            {formatJobDiagnosticLabel(jobDoc.diagnostics.status)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </details>
                </section>

                <section className="rounded-xl surface-raised p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-2 border-b border-hairline">
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      <ClipboardCheck className="h-4 w-4 text-primary shrink-0" aria-hidden />
                      <h2 className="text-lg text-foreground font-semibold">Extracted Requirements</h2>
                      {extractedRequirements && (
                        <span className="rounded-md border border-hairline bg-inset px-2 py-0.5 text-xs font-mono tabular-nums text-muted-foreground">
                          Evidence covers {verifiedRequiredSkills.length}/{extractedRequirements.requiredSkills.length} required skills
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={handleExtract}
                      className="inline-flex min-h-11 sm:min-h-0 items-center text-status-success text-xs hover:underline font-mono"
                    >
                      {isExtracting ? "Scanning..." : isMatching ? "Matching..." : "Re-Scan"}
                    </button>
                  </div>

                  {extractedRequirements && (
                    <>
                      <div className="mb-4">
                        <h3 className="font-mono text-xs text-muted-foreground mb-2">Required Skills</h3>
                        <div className="flex flex-wrap gap-2">
                          {extractedRequirements.requiredSkills.map((skill) => {
                            const covered = coveredSkills.has(skill);
                            return (
                              <div
                                key={skill}
                                className={`flex items-center gap-1.5 px-2.5 py-1 bg-inset rounded text-xs font-mono border ${
                                  covered ? "border-status-success/40 text-text-secondary" : "border-status-danger/30 text-text-secondary"
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => handleRemoveRequirement("required", skill)}
                                  title="Click to remove"
                                  data-testid={`req-skill-${skill}`}
                                  className="flex items-center gap-1.5 hover:text-foreground"
                                >
                                  {covered ? (
                                    <CheckCircle2 className="h-3.5 w-3.5 text-status-success shrink-0" aria-hidden />
                                  ) : (
                                    <XCircle className="h-3.5 w-3.5 text-status-danger shrink-0" aria-hidden />
                                  )}
                                  {hasBrandIcon(skill) && (
                                    <BrandIcon name={skill} className="h-3.5 w-3.5 shrink-0" />
                                  )}
                                  {skill}
                                  <span data-testid={`remove-term-${skill}`} className="inline-flex">
                                    <X className="h-3 w-3 opacity-50" />
                                  </span>
                                </button>
                                {!covered && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setGapSkillToResolve(skill);
                                    }}
                                    data-testid={`resolve-gap-${skill}`}
                                    className="ml-1 rounded bg-primary/15 px-1.5 py-0.5 text-xs font-semibold text-primary hover:bg-primary/25 transition-colors flex items-center gap-0.5"
                                    title="Add evidence for this missing skill"
                                  >
                                    <Plus className="h-2.5 w-2.5" />
                                    Add
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <h3 className="font-mono text-xs text-muted-foreground mb-2">Preferred Skills</h3>
                        <div className="flex flex-wrap gap-2">
                          {extractedRequirements.preferredSkills.map((skill) => (
                            <button
                              type="button"
                              key={skill}
                              onClick={() => handleRemoveRequirement("preferred", skill)}
                              className="px-2.5 py-1 bg-inset rounded text-xs font-mono border border-hairline text-muted-foreground flex items-center gap-1.5"
                            >
                              {hasBrandIcon(skill) && (
                                <BrandIcon name={skill} className="h-3.5 w-3.5 shrink-0" />
                              )}
                              {skill}
                              <X className="h-3 w-3 opacity-50" />
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </section>
              </>
          </div>

          <div className="flex flex-col gap-6 min-w-0">
            <section className="rounded-xl surface-raised p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-2 border-b border-hairline">
                <div className="flex items-center gap-2 min-w-0">
                  <Database className="h-4 w-4 text-primary shrink-0" aria-hidden />
                  <h2 className="text-lg text-foreground font-semibold">Evidence Matches</h2>
                </div>
                <span className="rounded-md border border-hairline bg-inset px-2 py-0.5 text-xs font-mono tabular-nums text-muted-foreground">
                  {matches.length} matched
                </span>
              </div>
              <div className="space-y-3">
                {isMatching && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Matching Evidence Bank...
                  </div>
                )}
                {!isMatching && matches.length === 0 && (
                  <p className="text-sm text-muted-foreground">No evidence matches yet. Re-scan after updating the Evidence Bank.</p>
                )}
                {matches.slice(0, 6).map((m) => (
                  <div
                    key={m.id}
                    className="p-3 bg-inset border border-hairline rounded hover:border-primary/50 transition-colors"
                  >
                    <div className="flex flex-wrap justify-between items-start mb-1 gap-2">
                      <h4 className="font-bold text-sm text-foreground min-w-0">{m.title}</h4>
                      <span
                        className={`shrink-0 text-xs font-mono tabular-nums px-2 py-0.5 rounded border ${
                          m.matchPercentage >= 60
                            ? "bg-status-success/15 border-status-success/40 text-status-success"
                            : "bg-elevated text-muted-foreground border-hairline"
                        }`}
                      >
                        {m.matchPercentage}% evidence match · {m.matchPercentage >= 60 ? "High" : "Low"}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {m.organization ? `@ ${m.organization}` : ""}
                      {m.dates ? ` • ${m.dates}` : ""}
                      {m.isDraft ? " · draft" : ""}
                    </p>
                    <p className="text-sm leading-relaxed text-on-surface-variant line-clamp-2">{m.verifiedSummary}</p>
                    {m.matchedRequirements.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {m.matchedRequirements.slice(0, 4).map((req) => (
                          <span
                            key={req}
                            data-testid="matched-req-badge"
                            className="text-xs font-mono px-1.5 py-0.5 rounded bg-elevated text-on-surface-variant border border-hairline"
                          >
                            {req}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
        )}
        </div>
      </div>
      <Sheet open={showJobContextSheet} onOpenChange={setShowJobContextSheet}>
        <SheetContent side="right" className="w-[min(100vw,30rem)] overflow-y-auto bg-panel border-hairline text-foreground">
          <SheetHeader className="pb-3 border-b border-hairline">
            <SheetTitle className="text-foreground">
              {roleTitle || "Target Role"}
            </SheetTitle>
            <SheetDescription className="text-muted-foreground">
              {company ? `${company} · ` : ""}Job description &amp; extracted requirements
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-4">
            {extractedRequirements && extractedRequirements.requiredSkills.length > 0 && (
              <div className="space-y-1.5 pb-3 border-b border-hairline">
                <span className="text-xs text-muted-foreground font-medium block">
                  Required Skills &amp; Gaps
                </span>
                <TechDiffPillList
                  allRequiredSkills={extractedRequirements.requiredSkills}
                  verifiedSkillNames={verifiedRequiredSkills}
                  missingSkillNames={missingRequiredSkills}
                  maxDisplay={12}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <span className="text-xs text-muted-foreground font-medium block">
                Job Description (Keywords Highlighted)
              </span>
              <div className="p-4 bg-inset border border-hairline rounded-lg text-sm text-on-surface-variant space-y-2 leading-relaxed break-words">
                {highlightedJdView}
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
      <QuickAddEvidenceModal
        isOpen={Boolean(gapSkillToResolve)}
        onClose={() => setGapSkillToResolve(null)}
        initialSkill={gapSkillToResolve || ""}
        onEvidenceCreated={async () => {
          void loadEvidenceMetadata(isDemo);
          if (extractedRequirements) {
            await fetchMatches(extractedRequirements);
          }
        }}
      />
    </AppShell>
  );
}
