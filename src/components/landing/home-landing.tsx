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
  Upload,
  FileText,
  FolderOpen,
  Wand2,
  Briefcase,
  Send,
  ShieldCheck,
  Anchor,
  Sparkles,
  X,
} from "lucide-react";
import { TopNav } from "@/components/navigation/top-nav";
import { LandingAtmosphere } from "@/components/landing/landing-atmosphere";
import { AmbientColorBlobs } from "@/components/design-system/workspace-atmosphere";
import { ProductProofCard } from "@/components/landing/product-proof-card";
import { CapabilityMarquee } from "@/components/landing/capability-marquee";
import { LandingFooter } from "@/components/landing/landing-footer";
import { AtsSandboxSection } from "@/components/landing/ats-sandbox-section";
import { CompetitiveMatrixSection } from "@/components/landing/competitive-matrix-section";
import { getActiveConfig, resolveClientProviderConfig } from "@/lib/byok-vault";
import type { DashboardStats } from "@/lib/db/stats";
import { clearDemoSamplesForPersonalResume } from "@/lib/demo-client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface HomeLandingProps {
  initialStats: DashboardStats;
}

export function HomeLanding({ initialStats }: HomeLandingProps) {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats>(initialStats);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const [isClearingMaster, setIsClearingMaster] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [hasAiKey, setHasAiKey] = useState(false);
  const [aiKeyless, setAiKeyless] = useState(false);
  const [hasLocalResume, setHasLocalResume] = useState(false);
  const [hasLocalEvidence, setHasLocalEvidence] = useState(false);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);

  const pdfInputRef = useRef<HTMLInputElement>(null);
  const cancelClearBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem("rf_onboarding_dismissed") === "true") {
      setOnboardingDismissed(true);
    }
    const storedResume = localStorage.getItem("resumeforge_typst_source");
    if (storedResume && storedResume.trim().length > 30 && !storedResume.includes("// Starter Typst Resume")) {
      setHasLocalResume(true);
    }
    try {
      const storedEvidence = localStorage.getItem("resumeforge_guest_evidence");
      const parsed = storedEvidence ? JSON.parse(storedEvidence) : [];
      if (Array.isArray(parsed) && parsed.length > 0) {
        setHasLocalEvidence(true);
      }
    } catch {}
    void getActiveConfig().then((cfg) => {
      setHasAiKey(cfg.hasKey);
      setAiKeyless(cfg.keyless);
    });
  }, []);

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
        router.push("/editor?mode=visual");
      } else if (res.ok && json.success && json.data?.id) {
        router.push(`/editor?resumeId=${json.data.id}&mode=visual`);
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
                ? "bg-status-success/10 border-status-success/30 text-status-success"
                : "bg-status-danger/10 border-status-danger/30 text-status-danger"
            }`}
          >
            <div className="flex items-center gap-2">
              {notification.type === "success" ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-status-success" />
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
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-hairline bg-inset/80 w-fit">
                <span className="h-2 w-2 rounded-full bg-signal shadow-[0_0_0_3px_rgb(var(--accent-contrast)/0.2)]" aria-hidden />
                <KeyRound className="h-3.5 w-3.5 text-primary" aria-hidden />
                <span className="font-mono text-xs text-text-secondary">Guest drafts stay in your browser · BYOK</span>
              </div>

              <h1 className="text-4xl md:text-5xl lg:text-6xl text-foreground leading-tight font-bold tracking-[-0.04em] text-pretty">
                Tailor your resume. <span className="text-ember-gradient">Keep every claim true.</span>
              </h1>

              <p className="text-on-surface-variant text-base md:text-lg max-w-xl leading-relaxed">
                Built for internship and early-career applicants. Tailor a protected master resume to each role, review every proposed edit before it applies, and use your own AI key.
              </p>

              <div className="flex items-center gap-4 pt-2 flex-wrap">
                <Link
                  href="/tailor"
                  className="bg-primary text-primary-foreground btn-glow font-bold px-6 py-3 rounded-[6px] inline-flex items-center gap-2 hover:opacity-95 transition-opacity min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                >
                  <ArrowRight className="h-4 w-4" aria-hidden />
                  Start Tailoring
                </Link>

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
            </div>

            <ProductProofCard />
          </div>
        </section>

        {/* Consumer First-Run Getting Started Checklist */}
        {!onboardingDismissed && (
          <section
            data-testid="consumer-onboarding-checklist"
            className="max-w-7xl mx-auto w-full px-6 md:px-12 pb-12 z-10"
          >
            {(() => {
              const step1Done = Boolean(stats.hasMasterResume || hasLocalResume);
              const step2Done = Boolean(stats.evidenceCount > 0 || hasLocalEvidence);
              const step3Done = Boolean(hasAiKey) && !aiKeyless;
              const step4Done = Boolean(stats.variantsCount > 0 || stats.jobsCount > 0);
              const completedCount = [step1Done, step2Done, step3Done, step4Done].filter(Boolean).length;
              const progressPct = Math.round((completedCount / 4) * 100);

              return (
                <div className="rounded-[10px] surface-raised edge-glow p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-outline/70">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <span className="rounded-[4px] bg-primary/10 border border-primary/30 px-2.5 py-0.5 font-mono text-xs font-semibold uppercase tracking-wider text-primary">
                          Quick Start Guide
                        </span>
                        <span
                          data-testid="onboarding-progress-badge"
                          className="font-mono text-xs text-muted-foreground tabular-nums"
                        >
                          {completedCount} of 4 steps completed ({progressPct}%)
                        </span>
                      </div>
                      <h2 className="mt-1.5 text-lg md:text-xl font-bold text-foreground tracking-tight">
                        Set up your workspace in under 3 minutes
                      </h2>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-32 bg-inset h-2 rounded-full overflow-hidden">
                        <div
                          className="ombre-bar h-full rounded-full transition-all duration-300"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setOnboardingDismissed(true);
                          if (typeof window !== "undefined") {
                            localStorage.setItem("rf_onboarding_dismissed", "true");
                          }
                        }}
                        data-testid="dismiss-onboarding-btn"
                        aria-label="Dismiss quick start guide"
                        className="rounded-[6px] p-1.5 text-muted-foreground hover:bg-elevated hover:text-foreground transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-5">
                    {/* Step 1: Master Resume */}
                    <div
                      data-testid="onboarding-step-1"
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
                            <CheckCircle2 className="h-4 w-4 text-status-success" />
                          ) : (
                            <span className="h-2 w-2 rounded-full bg-primary" />
                          )}
                        </div>
                        <h3 className="text-sm font-bold text-foreground mb-1">
                          Create or Import Resume
                        </h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          Upload an existing PDF or use the Guided Visual Builder—no code required.
                        </p>
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => pdfInputRef.current?.click()}
                          className="text-xs font-mono font-semibold px-2.5 py-1.5 rounded-[6px] bg-elevated border border-outline text-foreground hover:bg-muted transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          Upload PDF
                        </button>
                        <Link
                          href="/editor?mode=visual"
                          data-testid="onboarding-open-visual-editor"
                          className="text-xs font-mono font-semibold text-primary hover:underline flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-[4px]"
                        >
                          Visual Builder <ArrowRight className="h-3 w-3" />
                        </Link>
                      </div>
                    </div>

                    {/* Step 2: Evidence Bank */}
                    <div
                      data-testid="onboarding-step-2"
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
                            <CheckCircle2 className="h-4 w-4 text-status-success" />
                          ) : (
                            <span className="h-2 w-2 rounded-full bg-text-muted" />
                          )}
                        </div>
                        <h3 className="text-sm font-bold text-foreground mb-1">
                          Verify Evidence Bank
                        </h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          Store your real project &amp; work bullets so AI tailoring never hallucinates.
                        </p>
                      </div>
                      <Link
                        href="/library"
                        className="text-xs font-mono font-semibold text-primary hover:underline flex items-center gap-1 pt-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-[4px]"
                      >
                        {step2Done ? `View ${stats.evidenceCount || "Saved"} Items` : "Add Achievements"}{" "}
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>

                    {/* Step 3: Connect AI Key */}
                    <div
                      data-testid="onboarding-step-3"
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
                            <CheckCircle2 className="h-4 w-4 text-status-success" />
                          ) : (
                            <span className="h-2 w-2 rounded-full bg-text-muted" />
                          )}
                        </div>
                        <h3 className="text-sm font-bold text-foreground mb-1">
                          Connect AI Key (BYOK)
                        </h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          Add a Gemini, OpenAI, Anthropic, or local Ollama key encrypted in this browser.
                        </p>
                      </div>
                      <Link
                        href="/settings"
                        className="text-xs font-mono font-semibold text-primary hover:underline flex items-center gap-1 pt-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-[4px]"
                      >
                        {aiKeyless ? "Local AI · not verified" : step3Done ? "AI Connected · Manage" : "Connect Key"}{" "}
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>

                    {/* Step 4: Tailor to a Job */}
                    <div
                      data-testid="onboarding-step-4"
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
                            <CheckCircle2 className="h-4 w-4 text-status-success" />
                          ) : (
                            <span className="h-2 w-2 rounded-full bg-text-muted" />
                          )}
                        </div>
                        <h3 className="text-sm font-bold text-foreground mb-1">
                          Tailor to Target Job
                        </h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          Paste a job posting to score ATS fit, apply verified patches, and export PDF.
                        </p>
                      </div>
                      <Link
                        href="/tailor"
                        className="text-xs font-mono font-semibold text-primary hover:underline flex items-center gap-1 pt-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-[4px]"
                      >
                        {step4Done ? "Open Tailor Workspace" : "Tailor First Job"}{" "}
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })()}
          </section>
        )}

        <CapabilityMarquee />

        {/* How ResumeForge Operates Pipeline Section */}
        <section
          className="w-full bg-panel py-16 px-6 md:px-12 z-10 relative"
          data-testid="workflow-section"
        >
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-px ombre-divider" />
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-px ombre-divider" />
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-2xl md:text-3xl text-foreground font-bold tracking-[-0.03em] mb-2">How ResumeForge Operates</h2>
              <p className="text-muted-foreground font-mono text-sm">Five steps from master resume to tailored PDF.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6" data-testid="workflow-active-panel">
              <div className="flex flex-col items-center text-center p-4">
                <div className="w-12 h-12 rounded-[8px] bg-inset flex items-center justify-center border border-outline/70 mb-4">
                  <Upload className="h-5 w-5 text-primary" aria-hidden />
                </div>
                <h3 className="font-mono text-xs md:text-sm uppercase tracking-wider text-foreground font-semibold mb-1.5">1. IMPORT</h3>
                <p className="text-on-surface-variant text-sm leading-relaxed">Load your master CV.</p>
              </div>

              <div className="flex flex-col items-center text-center p-4 relative">
                <div className="hidden md:block absolute top-10 left-[-50%] w-full h-px ombre-divider opacity-70 z-0"></div>
                <div className="w-12 h-12 rounded-[8px] bg-inset flex items-center justify-center border border-outline/70 mb-4 relative z-10">
                  <Anchor className="h-5 w-5 text-primary" aria-hidden />
                </div>
                <h3 className="font-mono text-xs md:text-sm uppercase tracking-wider text-foreground font-semibold mb-1.5">2. GROUND</h3>
                <p className="text-on-surface-variant text-sm leading-relaxed">Extract verified facts.</p>
              </div>

              <div className="flex flex-col items-center text-center p-4 relative">
                <div className="hidden md:block absolute top-10 left-[-50%] w-full h-px ombre-divider opacity-70 z-0"></div>
                <div className="w-12 h-12 rounded-[8px] bg-primary/15 flex items-center justify-center border border-primary/50 mb-4 relative z-10">
                  <Sparkles className="h-5 w-5 text-primary" aria-hidden />
                </div>
                <h3 className="font-mono text-xs md:text-sm uppercase tracking-wider text-foreground font-semibold mb-1.5">3. TAILOR</h3>
                <p className="text-on-surface-variant text-sm leading-relaxed">Align to Job Description.</p>
              </div>

              <div className="flex flex-col items-center text-center p-4 relative">
                <div className="hidden md:block absolute top-10 left-[-50%] w-full h-px ombre-divider opacity-70 z-0"></div>
                <div className="w-12 h-12 rounded-[8px] bg-inset flex items-center justify-center border border-outline/70 mb-4 relative z-10">
                  <ShieldCheck className="h-5 w-5 text-on-surface-variant" aria-hidden />
                </div>
                <h3 className="font-mono text-xs md:text-sm uppercase tracking-wider text-foreground font-semibold mb-1.5">4. VERIFY</h3>
                <p className="text-on-surface-variant text-sm leading-relaxed">Audit against evidence.</p>
              </div>

              <div className="flex flex-col items-center text-center p-4 relative">
                <div className="hidden md:block absolute top-10 left-[-50%] w-full h-px ombre-divider opacity-70 z-0"></div>
                <div className="w-12 h-12 rounded-[8px] bg-inset flex items-center justify-center border border-outline/70 mb-4 relative z-10">
                  <Send className="h-5 w-5 text-primary" aria-hidden />
                </div>
                <h3 className="font-mono text-xs md:text-sm uppercase tracking-wider text-foreground font-semibold mb-1.5">5. APPLY</h3>
                <p className="text-on-surface-variant text-sm leading-relaxed">Export tailored PDF.</p>
              </div>
            </div>
          </div>
        </section>

        <div className="relative overflow-hidden" data-testid="landing-lower-atmosphere-stage">
          <AmbientColorBlobs testId="landing-lower-blobs" variant="landing-lower" />
          <div className="relative z-10">
            {/* Workspace Capability Modules Grid */}
            <section
              className="py-20 px-6 md:px-12 max-w-7xl mx-auto w-full z-10"
              data-testid="capability-grid-section"
            >
              <div className="text-center mb-14">
                <h2 className="text-3xl md:text-4xl font-bold text-foreground tracking-[-0.03em]">Workspace tools</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="capability-cards-grid">
                {/* Card 1: Master Resume Editor */}
                <div className="surface-raised card-lift edge-glow rounded-[10px] p-6 flex flex-col justify-between min-h-[260px]">
                  <div>
                    <div className="w-10 h-10 rounded-[6px] bg-inset border border-outline/70 flex items-center justify-center mb-6">
                      <FileText className="h-5 w-5 text-primary" aria-hidden />
                    </div>
                    <h3 className="text-lg md:text-xl font-bold text-foreground mb-2 tracking-tight">Master Resume Editor</h3>
                    <p className="text-on-surface-variant text-sm leading-relaxed">
                      Edit your protected Typst master resume with WASM compilation and instant live preview.
                    </p>
                  </div>
                  <div className="mt-6 pt-4 border-t border-outline/70 flex items-center justify-between">
                    {stats.hasMasterResume ? (
                      <span className="font-mono text-xs uppercase tracking-wider px-2.5 py-1 rounded-[4px] bg-inset border border-outline/70 text-on-surface-variant tabular-nums">
                        1 MASTER RESUME
                      </span>
                    ) : null}
                    <Link className="ml-auto text-primary font-mono text-xs md:text-sm flex items-center gap-1 hover:underline" href="/editor">
                      Open <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                    </Link>
                  </div>
                </div>

                {/* Card 2: Verified Evidence Bank */}
                <div className="surface-raised card-lift edge-glow rounded-[10px] p-6 flex flex-col justify-between min-h-[260px]">
                  <div>
                    <div className="w-10 h-10 rounded-[6px] bg-inset border border-outline/70 flex items-center justify-center mb-6">
                      <FolderOpen className="h-5 w-5 text-on-surface-variant" aria-hidden />
                    </div>
                    <h3 className="text-lg md:text-xl font-bold text-foreground mb-2 tracking-tight">Verified Evidence Bank</h3>
                    <p className="text-on-surface-variant text-sm leading-relaxed">
                      Central repository of career achievements, verified bullets, and skill inventory.
                    </p>
                  </div>
                  <div className="mt-6 pt-4 border-t border-outline/70 flex items-center justify-between">
                    {stats.evidenceCount > 0 ? (
                      <span className="font-mono text-xs uppercase tracking-wider px-2.5 py-1 rounded-[4px] bg-inset border border-outline/70 text-on-surface-variant tabular-nums">
                        {`${stats.evidenceCount} TOTAL ITEMS`}
                      </span>
                    ) : null}
                    <Link className="ml-auto text-on-surface-variant hover:text-foreground font-mono text-xs md:text-sm flex items-center gap-1 transition-colors" href="/library">
                      Open <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                    </Link>
                  </div>
                </div>

                {/* Card 3: Tailor Engine & AI Gateway (Large 2-row span) */}
                <div className="surface-raised card-lift edge-glow rounded-[10px] p-6 flex flex-col justify-between min-h-[260px] lg:col-span-1 md:col-span-2 lg:row-span-2">
                  <div>
                    <div className="w-10 h-10 rounded-[6px] bg-primary/10 border border-primary/30 flex items-center justify-center mb-6">
                      <Wand2 className="h-5 w-5 text-primary" aria-hidden />
                    </div>
                    <h3 className="text-xl md:text-2xl font-bold text-foreground mb-3 tracking-tight">Tailor Engine &amp; AI Gateway</h3>
                    <p className="text-on-surface-variant text-sm leading-relaxed mb-6">
                      Map verified evidence to job descriptions and inspect atomic diffs before applying changes.
                    </p>
                    <div className="bg-inset border border-outline/70 rounded-[6px] p-3.5 font-mono text-xs text-on-surface-variant space-y-1.5 mb-4">
                      <div className="flex justify-between items-center">
                        <span className="text-foreground font-semibold">Evidence-linked edits</span>
                        <span className="text-primary text-xs">Evidence-Cited</span>
                      </div>
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        Every proposed edit cites an `evidenceId` or surfaces an explicit Gap item.
                      </p>
                    </div>
                  </div>
                  <div className="mt-auto pt-4 border-t border-outline/70 flex items-center justify-between">
                    {stats.variantsCount > 0 ? (
                      <span className="font-mono text-xs uppercase tracking-wider px-2.5 py-1 rounded-[4px] bg-inset border border-outline/70 text-on-surface-variant tabular-nums">
                        {`${stats.variantsCount} VARIANTS GENERATED`}
                      </span>
                    ) : null}
                    <Link className="ml-auto bg-primary text-primary-foreground font-bold px-4 py-2 rounded-[6px] flex items-center gap-1.5 hover:opacity-95 transition-opacity text-xs md:text-sm" href="/tailor">
                      Tailor Now
                    </Link>
                  </div>
                </div>

                {/* Card 4: AI Key Vault & Settings */}
                <div className="surface-raised card-lift edge-glow rounded-[10px] p-6 flex flex-col justify-between min-h-[260px]">
                  <div>
                    <div className="w-10 h-10 rounded-[6px] bg-inset border border-outline/70 flex items-center justify-center mb-6">
                      <KeyRound className="h-5 w-5 text-on-surface-variant" aria-hidden />
                    </div>
                    <h3 className="text-lg md:text-xl font-bold text-foreground mb-2 tracking-tight">AI Key Vault &amp; Settings</h3>
                    <p className="text-on-surface-variant text-sm leading-relaxed">
                      Configure BYOK credentials (OpenAI, Anthropic, Gemini) encrypted in IndexedDB and relayed strictly on AI actions.
                    </p>
                  </div>
                  <div className="mt-6 pt-4 border-t border-outline/70 flex items-center justify-between">
                    <span className="font-mono text-xs uppercase tracking-wider px-2.5 py-1 rounded-[4px] bg-inset border border-outline/70 text-on-surface-variant">INDEXEDDB VAULT</span>
                    <Link className="text-on-surface-variant hover:text-foreground font-mono text-xs md:text-sm flex items-center gap-1 transition-colors" href="/settings">
                      Open <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                    </Link>
                  </div>
                </div>

                {/* Card 5: Job Application Tracker */}
                <div className="surface-raised card-lift edge-glow rounded-[10px] p-6 flex flex-col justify-between min-h-[260px]">
                  <div>
                    <div className="w-10 h-10 rounded-[6px] bg-inset border border-outline/70 flex items-center justify-center mb-6">
                      <Briefcase className="h-5 w-5 text-primary" aria-hidden />
                    </div>
                    <h3 className="text-lg md:text-xl font-bold text-foreground mb-2 tracking-tight">Job Application Tracker</h3>
                    <p className="text-on-surface-variant text-sm leading-relaxed">
                      Kanban &amp; list pipeline for tracking applications, interview notes, and status history.
                    </p>
                  </div>
                  <div className="mt-6 pt-4 border-t border-outline/70 flex items-center justify-between">
                    {stats.jobsCount > 0 ? (
                      <span className="font-mono text-xs uppercase tracking-wider px-2.5 py-1 rounded-[4px] bg-inset border border-outline/70 text-on-surface-variant tabular-nums">
                        {`${stats.jobsCount} JOBS TRACKED`}
                      </span>
                    ) : null}
                    <Link className="ml-auto text-primary font-mono text-xs md:text-sm flex items-center gap-1 hover:underline" href="/tracker">
                      Open <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                    </Link>
                  </div>
                </div>
              </div>
              <div className="mt-8 flex items-center justify-center">
                <Link
                  href="/practice"
                  data-testid="landing-practice-link"
                  className="inline-flex items-center gap-2 rounded-[6px] border border-outline/70 bg-panel px-4 py-2.5 text-xs md:text-sm font-mono font-semibold text-foreground hover:bg-elevated hover:border-primary/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span>Prepare for interviews in Practice</span>
                  <ArrowRight className="h-3.5 w-3.5 text-primary" aria-hidden />
                </Link>
              </div>
            </section>

            {/* Phase: Instant ATS Sandbox Interactive Playground */}
            <AtsSandboxSection />

            {/* Phase: The Engineering Wedge Competitive Matrix */}
            <CompetitiveMatrixSection />
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
