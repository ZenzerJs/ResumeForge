"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  KeyRound,
  ArrowRight,
  ChevronRight,
  Upload,
  X,
} from "lucide-react";
import { TopNav } from "@/components/navigation/top-nav";
import { LandingAtmosphere } from "@/components/landing/landing-atmosphere";
import { AmbientColorBlobs } from "@/components/design-system/workspace-atmosphere";
import { ProductProofCard } from "@/components/landing/product-proof-card";
import { LandingFooter } from "@/components/landing/landing-footer";
import { AtsSandboxSection } from "@/components/landing/ats-sandbox-section";
import { CompetitiveMatrixSection } from "@/components/landing/competitive-matrix-section";
import { resolveClientProviderConfig } from "@/lib/byok-vault";
import type { DashboardStats } from "@/lib/db/stats";
import { clearDemoSamplesForPersonalResume } from "@/lib/demo-client";
import { fetchSessionUser, type SessionUser } from "@/components/auth/session-user";
import {
  buildTailorHref,
  buildTailorNewJobHref,
  buildTailorSampleHref,
  isValidContextId,
  resolveGlobalTailorContext,
  type ApplicationAccountScope,
  type StorageLike,
} from "@/lib/tailor/application-context";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface GuestEvidenceSummary {
  personalVerifiedCount: number;
  personalDraftCount: number;
  hasSampleVerified: boolean;
}

export interface GuestJobsSummary {
  personalCount: number;
  hasSampleJob: boolean;
}

export interface OnboardingChecklistInput {
  stats: DashboardStats;
  hasLocalResume: boolean;
  guestEvidence: GuestEvidenceSummary;
  guestJobs: GuestJobsSummary;
  hasAiKey: boolean;
  aiKeyless: boolean;
}

export interface OnboardingChecklistState {
  step1Done: boolean;
  step2Done: boolean;
  step3Done: boolean;
  step4Done: boolean;
  completedCount: number;
  progressPct: number;
}

const DEMO_SAMPLE_ID_PREFIX = "demo-sample-";

const WORKSPACE_LINKS = [
  { href: "/editor", label: "Edit your resume", description: "Update your master resume, preview the page, and export a PDF." },
  { href: "/library", label: "Save work you can verify", description: "Keep a record of what you built, used, and achieved." },
  { href: "/tailor", label: "Tailor for a role", description: "See where your experience fits and review each suggested edit." },
  { href: "/tracker", label: "Track applications", description: "Keep saved roles, interviews, and application status in one place." },
  { href: "/settings", label: "Set up an AI provider", description: "Choose a provider and test your connection." },
  { href: "/practice", label: "Practice for interviews", description: "Work through coding and behavioral questions." },
];

const EMPTY_GUEST_EVIDENCE: GuestEvidenceSummary = {
  personalVerifiedCount: 0,
  personalDraftCount: 0,
  hasSampleVerified: false,
};

const EMPTY_GUEST_JOBS: GuestJobsSummary = {
  personalCount: 0,
  hasSampleJob: false,
};

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || value === null || typeof value === "string";
}

export function hasLocalPersonalResume(raw: string | null): boolean {
  return Boolean(
    raw &&
      raw.trim().length > 30 &&
      !raw.includes("// Starter Typst Resume") &&
      !raw.includes("// Synthetic sample.")
  );
}

/**
 * Parses `resumeforge_guest_evidence` strictly, counting only records whose
 * status is `"verified"` and distinguishing `demo-sample-` fixtures from personal entries.
 */
export function parseGuestEvidenceSummary(raw: string | null): GuestEvidenceSummary {
  if (!raw) return { ...EMPTY_GUEST_EVIDENCE };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ...EMPTY_GUEST_EVIDENCE };
  }
  if (!Array.isArray(parsed)) return { ...EMPTY_GUEST_EVIDENCE };

  let personalVerifiedCount = 0;
  let personalDraftCount = 0;
  let hasSampleVerified = false;

  for (const item of parsed) {
    if (!isPlainRecord(item)) continue;
    if (!isNonEmptyString(item.id)) continue;
    if (
      item.title !== undefined &&
      item.title !== null &&
      !isNonEmptyString(item.title)
    ) {
      continue;
    }
    if (!isOptionalString(item.status)) continue;

    const isSample = item.id.trim().startsWith(DEMO_SAMPLE_ID_PREFIX);
    if (item.status === "verified") {
      if (isSample) {
        hasSampleVerified = true;
      } else {
        personalVerifiedCount += 1;
      }
    } else if (!isSample && item.status === "draft") {
      personalDraftCount += 1;
    }
  }

  return { personalVerifiedCount, personalDraftCount, hasSampleVerified };
}

/**
 * Parses `resumeforge_guest_jobs` strictly, requiring record identity and
 * non-empty job content while separating `demo-sample-` fixtures from personal jobs.
 */
export function parseGuestJobsSummary(raw: string | null): GuestJobsSummary {
  if (!raw) return { ...EMPTY_GUEST_JOBS };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ...EMPTY_GUEST_JOBS };
  }
  if (!Array.isArray(parsed)) return { ...EMPTY_GUEST_JOBS };

  let personalCount = 0;
  let hasSampleJob = false;

  for (const item of parsed) {
    if (!isPlainRecord(item)) continue;
    if (!isNonEmptyString(item.id)) continue;
    if (
      !isOptionalString(item.rawDescription) ||
      !isOptionalString(item.company) ||
      !isOptionalString(item.roleTitle)
    ) {
      continue;
    }

    const hasContent =
      isNonEmptyString(item.rawDescription) ||
      isNonEmptyString(item.roleTitle) ||
      isNonEmptyString(item.company);
    if (!hasContent) continue;

    if (item.id.trim().startsWith(DEMO_SAMPLE_ID_PREFIX)) {
      hasSampleJob = true;
    } else {
      personalCount += 1;
    }
  }

  return { personalCount, hasSampleJob };
}

export interface SavedRoleEntry {
  href: string;
  roleLabel: string;
}

function findLatestGuestPersonalJob(raw: string | null): { id: string; label: string } | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;

  for (const item of parsed) {
    if (!isPlainRecord(item)) continue;
    if (!isValidContextId(typeof item.id === "string" ? item.id.trim() : null)) continue;
    const id = (item.id as string).trim();
    if (id.startsWith(DEMO_SAMPLE_ID_PREFIX)) continue;
    const role = isNonEmptyString(item.roleTitle) ? item.roleTitle.trim() : null;
    const company = isNonEmptyString(item.company) ? item.company.trim() : null;
    const label = role && company ? `${role} (${company})` : role ?? company;
    if (label) {
      return { id, label };
    }
  }
  return null;
}

export function resolveHomeSavedRole(
  scope: ApplicationAccountScope,
  guestJobsRaw: string | null,
  storage?: StorageLike | null
): SavedRoleEntry | null {
  if (scope.scopeResolved === false) return null;

  const { href, activeContext } = resolveGlobalTailorContext(scope, storage);
  if (activeContext) {
    const activeRole = activeContext.roleTitle?.trim();
    const activeCompany = activeContext.company?.trim();
    const label = activeRole ?? activeCompany ?? "saved role";
    return { href, roleLabel: label };
  }

  if (!scope.userId) {
    const guestJob = findLatestGuestPersonalJob(guestJobsRaw);
    if (guestJob) {
      return {
        href: buildTailorHref({ jobId: guestJob.id, tab: "job-info" }),
        roleLabel: guestJob.label,
      };
    }
  }

  return null;
}

export function computeOnboardingChecklistState({
  stats,
  hasLocalResume,
  guestEvidence,
  guestJobs,
  hasAiKey,
  aiKeyless,
}: OnboardingChecklistInput): OnboardingChecklistState {
  const step1Done = Boolean(stats.hasMasterResume || hasLocalResume);
  const step2Done = Boolean(
    stats.verifiedEvidenceCount > 0 || guestEvidence.personalVerifiedCount > 0
  );
  const step3Done = Boolean(hasAiKey) && !aiKeyless;
  const step4Done = Boolean(stats.hasTargetJob || guestJobs.personalCount > 0);
  const completedCount = [step1Done, step2Done, step3Done, step4Done].filter(Boolean).length;
  const progressPct = Math.round((completedCount / 4) * 100);

  return {
    step1Done,
    step2Done,
    step3Done,
    step4Done,
    completedCount,
    progressPct,
  };
}

interface SetupChecklistProps extends OnboardingChecklistInput {
  demoMode: boolean;
  savedRole?: SavedRoleEntry | null;
  onUploadPdf: () => void;
  onDismiss: () => void;
}

export function SetupChecklist({
  stats,
  hasLocalResume,
  guestEvidence,
  guestJobs,
  hasAiKey,
  aiKeyless,
  demoMode,
  savedRole,
  onUploadPdf,
  onDismiss,
}: SetupChecklistProps) {
  const {
    step1Done,
    step2Done,
    step3Done,
    step4Done,
    completedCount,
    progressPct,
  } = computeOnboardingChecklistState({
    stats,
    hasLocalResume,
    guestEvidence,
    guestJobs,
    hasAiKey,
    aiKeyless,
  });

  const verifiedEvidenceCount =
    stats.verifiedEvidenceCount > 0
      ? stats.verifiedEvidenceCount
      : guestEvidence.personalVerifiedCount;

  const newJobHref = buildTailorNewJobHref({ tab: "job-info" });
  const sampleHref = buildTailorSampleHref({
    sample: demoMode ? "demo" : undefined,
    tab: "job-info",
  });

  return (
    <div className="rounded-[10px] surface-raised edge-glow p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-outline/70">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className="text-lg font-bold tracking-tight text-foreground md:text-xl">Quick start</h2>
          <span
            data-testid="onboarding-progress-badge"
            aria-live="polite"
            className="font-mono text-xs text-muted-foreground tabular-nums"
          >
            {completedCount} of 4 steps completed ({progressPct}%)
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div
            role="progressbar"
            aria-label="Workspace setup progress"
            aria-valuemin={0}
            aria-valuemax={4}
            aria-valuenow={completedCount}
            className="w-32 bg-inset h-2 rounded-full overflow-hidden"
          >
            <div
              className="ombre-bar h-full rounded-full transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <button
            type="button"
            onClick={onDismiss}
            data-testid="dismiss-onboarding-btn"
            aria-label="Dismiss quick start guide"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[6px] text-muted-foreground hover:bg-elevated hover:text-foreground transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-5">
        {/* Step 1: Master Resume */}
        <div
          data-testid="onboarding-step-1"
          data-complete={step1Done ? "true" : "false"}
          className={`rounded-[8px] border p-4 flex flex-col justify-between gap-3 transition ${
            step1Done
              ? "border-status-success/30 bg-status-success/10"
              : "border-primary/40 bg-inset"
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Step 1
              </span>
              {step1Done ? (
                <CheckCircle2 className="h-4 w-4 text-status-success" aria-hidden="true" />
              ) : (
                <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
              )}
            </div>
            <h3 className="text-sm font-bold text-foreground mb-1">
              Create or import your resume
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Upload an existing PDF or use the Guided Visual Builder—no code required.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={onUploadPdf}
              className="text-xs font-mono font-semibold px-2.5 py-1.5 rounded-[6px] bg-elevated border border-outline text-foreground hover:bg-muted transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Upload PDF
            </button>
            <Link
              href="/editor?mode=visual"
              data-testid="onboarding-open-visual-editor"
              className="text-xs font-mono font-semibold text-primary hover:underline flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-[4px]"
            >
              Visual Builder <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          </div>
        </div>

        {/* Step 2: Evidence Bank */}
        <div
          data-testid="onboarding-step-2"
          data-complete={step2Done ? "true" : "false"}
          className={`rounded-[8px] border p-4 flex flex-col justify-between gap-3 transition ${
            step2Done
              ? "border-status-success/30 bg-status-success/10"
              : "border-outline/70 bg-inset"
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Step 2
              </span>
              {step2Done ? (
                <CheckCircle2 className="h-4 w-4 text-status-success" aria-hidden="true" />
              ) : (
                <span className="h-2 w-2 rounded-full bg-text-muted" aria-hidden="true" />
              )}
            </div>
            <h3 className="text-sm font-bold text-foreground mb-1">
              Verify your first evidence item
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Store real project and work bullets and verify at least one so tailoring stays grounded.
            </p>
            {!step2Done && guestEvidence.hasSampleVerified ? (
              <p
                data-testid="onboarding-step-2-sample-note"
                className="mt-2 font-mono text-xs text-muted-foreground"
              >
                Synthetic sample available · verify your own item
              </p>
            ) : null}
          </div>
          <Link
            href="/library"
            className="text-xs font-mono font-semibold text-primary hover:underline flex items-center gap-1 pt-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-[4px]"
          >
            {step2Done ? `View ${verifiedEvidenceCount} Verified` : "Verify Evidence"}{" "}
            <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </Link>
        </div>

        {/* Step 3: Add AI Provider Key */}
        <div
          data-testid="onboarding-step-3"
          data-complete={step3Done ? "true" : "false"}
          className={`rounded-[8px] border p-4 flex flex-col justify-between gap-3 transition ${
            step3Done
              ? "border-status-success/30 bg-status-success/10"
              : "border-outline/70 bg-inset"
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Step 3
              </span>
              {step3Done ? (
                <CheckCircle2 className="h-4 w-4 text-status-success" aria-hidden="true" />
              ) : (
                <span className="h-2 w-2 rounded-full bg-text-muted" aria-hidden="true" />
              )}
            </div>
            <h3 className="text-sm font-bold text-foreground mb-1">
              Connect an AI provider
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {demoMode
                ? "Use your own Gemini, OpenAI, Anthropic, or Groq key. Your key is stored in this browser when browser storage is available."
                : aiKeyless
                  ? "Test your local or custom endpoint in Settings."
                  : "Add a provider key in Settings or use the provider configured by your host."}
            </p>
          </div>
          <Link
            href="/settings"
            className="text-xs font-mono font-semibold text-primary hover:underline flex items-center gap-1 pt-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-[4px]"
          >
            {step3Done ? "Manage provider" : "Open provider settings"}{" "}
            <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </Link>
        </div>

        {/* Step 4: Add Target Job */}
        <div
          data-testid="onboarding-step-4"
          data-complete={step4Done ? "true" : "false"}
          className={`rounded-[8px] border p-4 flex flex-col justify-between gap-3 transition ${
            step4Done
              ? "border-status-success/30 bg-status-success/10"
              : "border-outline/70 bg-inset"
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Step 4
              </span>
              {step4Done ? (
                <CheckCircle2 className="h-4 w-4 text-status-success" aria-hidden="true" />
              ) : (
                <span className="h-2 w-2 rounded-full bg-text-muted" aria-hidden="true" />
              )}
            </div>
            <h3 className="text-sm font-bold text-foreground mb-1">
              Add a target job
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Save a job description, then open Tailor to review matches and proposed edits.
            </p>
            {!step4Done && guestJobs.hasSampleJob ? (
              <p
                data-testid="onboarding-step-4-sample-note"
                className="mt-2 font-mono text-xs text-muted-foreground"
              >
                Synthetic sample available · save your own job
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <Link
              href={step4Done ? (savedRole?.href ?? "/tailor") : newJobHref}
              data-testid="onboarding-step-4-action"
              className="text-xs font-mono font-semibold text-primary hover:underline flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-[4px]"
            >
              {step4Done
                ? savedRole
                  ? `Open Tailor · ${savedRole.roleLabel}`
                  : "Open Tailor"
                : "Add Target Job"}{" "}
              <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </Link>
            {!step4Done ? (
              <Link
                href={sampleHref}
                data-testid="onboarding-step-4-sample-link"
                className="text-xs font-mono text-muted-foreground hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-[4px]"
              >
                Try sample
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

interface HomeLandingProps {
  initialStats: DashboardStats;
  demoMode: boolean;
}

export function HomeLanding({ initialStats, demoMode }: HomeLandingProps) {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats>(initialStats);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const [isClearingMaster, setIsClearingMaster] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [sessionUser, setSessionUser] = useState<SessionUser | null | undefined>(undefined);
  const [savedRole, setSavedRole] = useState<SavedRoleEntry | null>(null);

  const pdfInputRef = useRef<HTMLInputElement>(null);
  const cancelClearBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setStats(initialStats);
  }, [initialStats]);

  useEffect(() => {
    let cancelled = false;
    void fetchSessionUser().then((next) => {
      if (!cancelled) setSessionUser(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const refreshLocalState = () => {
      const rawGuestJobs = localStorage.getItem("resumeforge_guest_jobs");
      setSavedRole(
        resolveHomeSavedRole(
          {
            userId: sessionUser?.id ?? null,
            demoMode,
            scopeResolved: sessionUser !== undefined,
          },
          rawGuestJobs
        )
      );
    };

    refreshLocalState();
    window.addEventListener("focus", refreshLocalState);
    window.addEventListener("storage", refreshLocalState);
    window.addEventListener("resumeforge:evidence-changed", refreshLocalState);
    window.addEventListener("resumeforge:application-context-changed", refreshLocalState);

    return () => {
      window.removeEventListener("focus", refreshLocalState);
      window.removeEventListener("storage", refreshLocalState);
      window.removeEventListener("resumeforge:evidence-changed", refreshLocalState);
      window.removeEventListener("resumeforge:application-context-changed", refreshLocalState);
    };
  }, [demoMode, sessionUser]);

  const convertGuestPdfLocally = async (file: File): Promise<string> => {
    const [
      { extractPdfEvidence, detectSectionHeading },
      { buildResumeDocument, renderResumeDocument, isResumeLayoutV2Enabled, typstContent },
    ] = await Promise.all([
      import("@/lib/evidence/pdfExtractor"),
      import("@/lib/typst/resume-document"),
    ]);

    const arrayBuffer = await file.arrayBuffer();
    const evidence = await extractPdfEvidence(arrayBuffer, file.name);
    const rawLines = evidence.pages
      .flatMap((p) => p.text.split(/\r?\n/))
      .map((line) => line.trim())
      .filter(Boolean);

    if (rawLines.length === 0) {
      throw new Error("Could not extract readable text from PDF.");
    }

    const safeFileName = file.name.replace(/[\r\n\u2028\u2029]/g, " ");
    const headerComments = [
      "// @pdf-conversion-draft: Review and edit before saving as Master Resume",
      "// @conversion-path: fallback",
      `// PDF source: "${safeFileName}" — converted ${new Date().toISOString().slice(0, 10)}`,
    ].join("\n");

    if (isResumeLayoutV2Enabled()) {
      const normalizedSource = rawLines.join("\n");
      const assignments: import("@/lib/typst/resume-document").ResumeAssignment[] = [];
      let offset = 0;
      let seenSection = false;
      let currentSecKind: string | null = null;

      rawLines.forEach((line, idx) => {
        const start = offset;
        const end = start + line.length;
        offset = end + 1;

        if (idx === 0) {
          assignments.push({ kind: "name", span: { start, end } });
          return;
        }
        const detectedSec = detectSectionHeading(line);
        if (detectedSec) {
          assignments.push({ kind: "section", span: { start, end } });
          seenSection = true;
          currentSecKind = detectedSec;
          return;
        }
        if (
          !seenSection &&
          /(@|https?:\/\/|linkedin\.com|github\.com|\b\d{3}[-. )\s]\d{3})/i.test(line)
        ) {
          assignments.push({ kind: "contact", span: { start, end } });
          return;
        }
        if (/^[-–—•*▪\u2022]\s+/.test(line)) {
          assignments.push({ kind: "bullet", span: { start, end } });
          return;
        }
        if (currentSecKind === "skills") {
          assignments.push({ kind: "skill", span: { start, end } });
        }
      });

      const doc = buildResumeDocument(normalizedSource, assignments);
      return `${headerComments}\n\n${renderResumeDocument(doc, "comfortable")}`;
    }

    const titleLine = typstContent(rawLines[0]);
    const bodyLines = rawLines.slice(1).map((line) => {
      if (detectSectionHeading(line)) {
        return `\n== ${typstContent(line.replace(/[:\-—–\s]+$/, "").trim())}\n`;
      }
      if (/^[-–—•*▪\u2022]\s+/.test(line)) {
        return `- ${typstContent(line.replace(/^[-–—•*▪\u2022]\s+/, ""))}`;
      }
      return typstContent(line);
    });

    const v1Body = [
      '#set page(paper: "us-letter", margin: (x: 1.5cm, y: 1.35cm))',
      '#set text(font: "Liberation Sans", size: 9.5pt, fill: rgb("#1c1e20"))',
      "#set par(leading: 0.55em)",
      "#set list(marker: [•], spacing: 0.28em, indent: 0em, body-indent: 0.45em)",
      "",
      `= ${titleLine}`,
      "",
      ...bodyLines,
    ].join("\n");

    return `${headerComments}\n\n${v1Body}\n`;
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setNotification({ type: "error", message: "Please select a valid .pdf document" });
      return;
    }

    try {
      setIsUploadingPdf(true);
      setNotification(null);

      const formData = new FormData();
      formData.append("file", file);

      try {
        const providerConfig = await resolveClientProviderConfig();
        if (providerConfig) {
          formData.append("providerConfig", JSON.stringify(providerConfig));
        }
      } catch {}

      const res = await fetch("/api/resumes/upload-pdf", {
        method: "POST",
        body: formData,
      });

      if (res.status === 401) {
        const localTypstSource = await convertGuestPdfLocally(file);
        clearDemoSamplesForPersonalResume(localTypstSource);
        localStorage.setItem("resumeforge_typst_source", localTypstSource);
        localStorage.setItem("resumeforge_has_guest_draft", "true");
        localStorage.removeItem("resumeforge_draft_migrated");
        localStorage.removeItem("resumeforge_migration_dismissed");
        router.push("/editor");
        return;
      }

      const rawText = await res.text();
      let json: {
        success?: boolean;
        error?: string;
        data?: { id?: string; typstSource?: string };
      };
      try {
        json = rawText ? (JSON.parse(rawText) as typeof json) : {};
      } catch {
        const message =
          res.status === 413
            ? "PDF upload exceeds the hosted 4.5 MB request size limit."
            : `PDF upload failed (HTTP ${res.status || 500}). Please try again.`;
        setNotification({ type: "error", message });
        return;
      }
      if (res.ok && json.success && json.data?.typstSource && !json.data?.id) {
        clearDemoSamplesForPersonalResume(json.data.typstSource);
        localStorage.setItem("resumeforge_typst_source", json.data.typstSource);
        localStorage.setItem("resumeforge_has_guest_draft", "true");
        router.push("/editor");
      } else if (res.ok && json.success && json.data?.id) {
        router.push(`/editor?resumeId=${json.data.id}`);
      } else {
        setNotification({
          type: "error",
          message: json.error || "Failed to upload PDF resume",
        });
      }
    } catch (err) {
      setNotification({
        type: "error",
        message: err instanceof Error ? err.message : "Error uploading PDF",
      });
    } finally {
      setIsUploadingPdf(false);
      if (pdfInputRef.current) pdfInputRef.current.value = "";
    }
  };

  const handleClearMaster = async () => {
    try {
      setIsClearingMaster(true);
      setNotification(null);

      const res = await fetch("/api/resumes/clear-master", { method: "POST" });
      const json = await res.json();

      if (res.ok && json.success) {
        setShowClearConfirm(false);
        setNotification({
          type: "success",
          message: "Master Resume status cleared for this session.",
        });
        setStats((current) => ({
          ...current,
          hasMasterResume: false,
          masterResumeTitle: null,
        }));
      }
    } catch {
      setNotification({
        type: "error",
        message: "Failed to clear master resume",
      });
    } finally {
      setIsClearingMaster(false);
    }
  };

  const newJobHref = buildTailorNewJobHref({ tab: "job-info" });
  const sampleHref = buildTailorSampleHref({
    sample: demoMode ? "demo" : undefined,
    tab: "job-info",
  });
  const isSignedInViewer =
    Boolean(sessionUser?.id) ||
    (stats as { isGuest?: boolean }).isGuest === false ||
    (!demoMode &&
      sessionUser === undefined &&
      (stats.hasMasterResume ||
        stats.evidenceCount > 0 ||
        stats.jobsCount > 0 ||
        stats.variantsCount > 0 ||
        stats.coverLettersCount > 0));

  return (
    <div className="bg-canvas text-foreground font-body-regular min-h-dvh min-w-0 flex flex-col overflow-x-hidden antialiased selection:bg-primary/25 selection:text-primary leading-[1.6] relative">
      <LandingAtmosphere />

      <TopNav />

      <main id="main-content" className="flex-grow min-w-0 pt-[calc(6rem+env(safe-area-inset-top))] pb-16 flex flex-col relative z-10 overflow-visible">
        {/* Notification Toast */}
        {notification ? (
          <div
            role="status"
            aria-live="polite"
            className={`p-3.5 rounded-[8px] border flex items-center justify-between text-xs font-semibold max-w-xl mx-auto w-full shadow-lg z-20 transition-opacity duration-150 ${
              notification.type === "success"
                ? "bg-status-success/10 border-status-success/30 text-status-success-soft"
                : "bg-status-danger/10 border-status-danger/30 text-status-danger"
            }`}
          >
            <div className="flex items-center gap-2">
              {notification.type === "success" ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-status-success-soft" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0 text-status-danger" />
              )}
              <span>{notification.message}</span>
            </div>
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => setNotification(null)}
              className="text-muted-foreground hover:text-foreground transition-colors ml-4 min-h-11 min-w-11 inline-flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        ) : null}

        {/* Hero Section with Staggered Reveal */}
        <section className="relative min-h-[680px] flex items-center px-6 md:px-12 max-w-7xl mx-auto w-full z-10 py-12">
          <div className="grid md:grid-cols-2 gap-12 items-center relative z-10 w-full">
            {/* Hero Text Left Column with clear-window glass backing plane */}
            <div
              data-testid="landing-hero-copy-glass"
              className="flex flex-col gap-6 rounded-[14px] glass-pane p-6 sm:p-8"
            >
              {!isSignedInViewer && (
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-hairline bg-inset/80 w-fit">
                  <span className="h-2 w-2 rounded-full bg-signal shadow-[0_0_0_3px_rgb(var(--accent-contrast)/0.2)]" aria-hidden />
                  <KeyRound className="h-3.5 w-3.5 text-primary" aria-hidden />
                  <span className="font-mono text-xs text-text-secondary">Guest drafts stay in your browser · Use your own AI key</span>
                </div>
              )}

              <h1 className="text-4xl md:text-5xl lg:text-6xl text-foreground leading-tight font-bold tracking-[-0.04em] text-pretty">
                Tailor your resume. <span className="text-ember-gradient">Keep every claim true.</span>
              </h1>

              <p className="text-on-surface-variant text-base md:text-lg max-w-xl leading-relaxed">
                Built for internship and early-career applicants. Tailor a protected master resume to each role, review every proposed edit before it applies, and use your own AI key.
              </p>

              <div className="flex items-center gap-4 pt-2 flex-wrap">
                {savedRole ? (
                  <>
                    <Link
                      href={savedRole.href}
                      data-testid="hero-resume-role-btn"
                      className="bg-primary text-primary-foreground btn-glow font-bold px-6 py-3 rounded-[6px] inline-flex items-center gap-2 hover:opacity-95 transition-opacity min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                    >
                      <ArrowRight className="h-4 w-4" aria-hidden />
                      Resume {savedRole.roleLabel}
                    </Link>
                    <Link
                      href={newJobHref}
                      data-testid="hero-start-tailoring-btn"
                      className="bg-panel border border-outline/70 text-foreground font-semibold px-5 py-3 rounded-[6px] inline-flex items-center gap-2 hover:bg-elevated transition-colors min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                    >
                      New Target Job
                    </Link>
                  </>
                ) : (
                  <Link
                    href={newJobHref}
                    data-testid="hero-start-tailoring-btn"
                    className="bg-primary text-primary-foreground btn-glow font-bold px-6 py-3 rounded-[6px] inline-flex items-center gap-2 hover:opacity-95 transition-opacity min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                  >
                    <ArrowRight className="h-4 w-4" aria-hidden />
                    Start Tailoring
                  </Link>
                )}

                <label htmlFor="landing-pdf-upload" className="sr-only">
                  Upload PDF resume
                </label>
                <input
                  id="landing-pdf-upload"
                  type="file"
                  ref={pdfInputRef}
                  onChange={handlePdfUpload}
                  accept=".pdf"
                  className="hidden"
                  data-testid="pdf-upload-input"
                />
                <button
                  type="button"
                  disabled={isUploadingPdf}
                  onClick={() => pdfInputRef.current?.click()}
                  data-testid="upload-pdf-hero-btn"
                  className="bg-panel border border-outline/70 text-foreground font-semibold px-5 py-3 rounded-[6px] inline-flex items-center gap-2 hover:bg-elevated transition-colors min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                >
                  {isUploadingPdf ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden />
                  ) : (
                    <Upload className="h-4 w-4 text-primary" aria-hidden />
                  )}
                  {isUploadingPdf ? "Converting PDF…" : "Upload PDF Resume"}
                </button>

                {stats?.hasMasterResume && (
                  <button
                    type="button"
                    disabled={isClearingMaster}
                    onClick={() => setShowClearConfirm(true)}
                    data-testid="clear-master-btn"
                    className="text-muted-foreground hover:text-status-danger text-xs font-mono px-3 py-2 rounded-[6px] border border-transparent hover:border-status-danger/30 transition-colors flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Clear Master
                  </button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <Link
                  href={sampleHref}
                  data-testid="hero-sample-job-link"
                  className="inline-flex min-h-11 items-center gap-1.5 font-mono-data text-mono-data text-muted-foreground hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-[4px]"
                >
                  <span>Try sample job posting</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </div>
            </div>

            <ProductProofCard />
          </div>
        </section>

        <div className="relative overflow-hidden" data-testid="landing-lower-atmosphere-stage">
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-px ombre-divider" />
          <AmbientColorBlobs testId="landing-lower-blobs" variant="landing-lower" />
          <div className="relative z-10 mx-auto w-full max-w-7xl px-6 md:px-12">
            <section className="py-10 md:py-12" data-testid="capability-grid-section" aria-labelledby="workspace-tools-heading">
              <h2 id="workspace-tools-heading" className="mb-4 text-2xl font-bold tracking-tight text-foreground md:text-3xl">
                Workspace tools
              </h2>
              <ul className="grid gap-x-10 sm:grid-cols-2">
                {WORKSPACE_LINKS.map(({ href, label, description }) => (
                  <li key={href} className="min-w-0 border-t border-hairline">
                    <Link
                      href={href}
                      className="group flex items-center justify-between gap-4 rounded-[6px] px-2 py-3 hover:bg-panel/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span>
                        <span className="block font-semibold text-foreground group-hover:text-primary">{label}</span>
                        <span className="block text-sm text-on-surface-variant">{description}</span>
                      </span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>

            <section className="border-y border-hairline" aria-label="Scoring and architecture">
              <details className="group">
                <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 rounded-[6px] px-2 py-3 font-semibold text-foreground hover:bg-panel/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                  <ChevronRight className="h-4 w-4 text-primary group-open:rotate-90" aria-hidden />
                  Try the resume match score
                </summary>
                <AtsSandboxSection />
              </details>
              <details className="group border-t border-hairline">
                <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 rounded-[6px] px-2 py-3 font-semibold text-foreground hover:bg-panel/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                  <ChevronRight className="h-4 w-4 text-primary group-open:rotate-90" aria-hidden />
                  How ResumeForge is built
                </summary>
                <CompetitiveMatrixSection demoMode={demoMode} />
              </details>
            </section>
          </div>
        </div>
      </main>

      <LandingFooter />
      <Dialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <DialogContent
          className="max-w-sm border-outline bg-elevated p-5"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            cancelClearBtnRef.current?.focus();
          }}
        >
          <DialogHeader className="text-left">
            <DialogTitle className="text-base font-semibold text-foreground">
              Clear master resume?
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              This removes master status from the current resume. You can save a new master from the editor.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-2 gap-2 sm:justify-end">
            <button
              ref={cancelClearBtnRef}
              type="button"
              onClick={() => setShowClearConfirm(false)}
              className="rounded-[6px] border border-outline px-3 py-2 text-sm text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-elevated"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isClearingMaster}
              onClick={handleClearMaster}
              className="rounded-[6px] bg-status-danger px-3 py-2 text-sm font-semibold text-accent-ink hover:bg-status-danger/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-elevated disabled:opacity-50"
            >
              {isClearingMaster ? "Clearing…" : "Clear Master"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
