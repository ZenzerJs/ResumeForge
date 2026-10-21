"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  KeyRound,
  ArrowRight,
  Upload,
  FileText,
  FolderOpen,
  Settings,
  Briefcase,
  Send,
  ShieldCheck,
  Anchor,
  Sparkles,
  X,
} from "lucide-react";
import { blurSlideUpVariants, cardHoverProps } from "@/lib/theme/animations";
import { StaggeredText } from "@/components/ui/staggered-text";
import { TopNav } from "@/components/navigation/top-nav";
import { LandingAtmosphere } from "@/components/landing/landing-atmosphere";
import { ProductProofCard } from "@/components/landing/product-proof-card";
import { CapabilityMarquee } from "@/components/landing/capability-marquee";
import { LandingFooter } from "@/components/landing/landing-footer";
import { AtsSandboxSection } from "@/components/landing/ats-sandbox-section";
import { CompetitiveMatrixSection } from "@/components/landing/competitive-matrix-section";
import { resolveClientProviderConfig } from "@/lib/byok-vault";
import type { DashboardStats } from "@/lib/db/stats";

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
  const [reduceMotion, setReduceMotion] = useState(false);
  const [hasAiKey, setHasAiKey] = useState(false);
  const [hasLocalResume, setHasLocalResume] = useState(false);
  const [hasLocalEvidence, setHasLocalEvidence] = useState(false);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);

  const pdfInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mq.matches);
    const onChange = () => setReduceMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

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
    void resolveClientProviderConfig().then((cfg) => {
      setHasAiKey(Boolean(cfg));
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

      const json = await res.json();
      if (res.ok && json.success && json.data?.id) {
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

  return (
    <div className="bg-[#0b1326] text-slate-100 font-body-regular min-h-dvh min-w-0 flex flex-col overflow-x-hidden antialiased selection:bg-[#ff8c00]/30 selection:text-[#ff8c00] leading-[1.6] relative">
      <LandingAtmosphere shouldReduceMotion={reduceMotion} />

      <TopNav />

      <main id="main-content" className="flex-grow min-w-0 pt-[calc(6rem+env(safe-area-inset-top))] pb-16 flex flex-col relative z-10 overflow-visible">
        {/* Notification Toast */}
        <AnimatePresence>
          {notification && (
            <motion.div
              role="status"
              aria-live="polite"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`p-3.5 rounded-lg border flex items-center justify-between text-xs font-medium max-w-xl mx-auto w-full shadow-lg z-20 ${
                notification.type === "success"
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                  : "bg-red-500/10 border-red-500/30 text-red-400"
              }`}
            >
              <div className="flex items-center gap-2">
                {notification.type === "success" ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
                )}
                <span>{notification.message}</span>
              </div>
              <button
                type="button"
                aria-label="Dismiss notification"
                onClick={() => setNotification(null)}
                className="text-slate-400 hover:text-white transition-colors ml-4 min-h-11 min-w-11 inline-flex items-center justify-center focus-visible:ring-2 focus-visible:ring-amber-500/60"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hero Section with Staggered Reveal */}
        <section className="relative min-h-[680px] flex items-center px-6 md:px-12 max-w-7xl mx-auto w-full z-10 py-12">
          <div className="grid md:grid-cols-2 gap-12 items-center relative z-10 w-full">
            {/* Hero Text Left Column */}
            <div className="flex flex-col gap-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[#ff8c00]/30 bg-[#ff8c00]/10 w-fit">
                <KeyRound className="h-4 w-4 text-[#ff8c00]" />
                <span className="font-mono text-xs uppercase tracking-wider text-[#ff8c00]">PRIVATE RESUME WORKSPACE</span>
              </div>

              <h1 className="text-4xl md:text-5xl lg:text-6xl text-white leading-tight font-extrabold tracking-[-0.04em] text-pretty">
                <StaggeredText
                  text="Make every application feel intentional."
                  highlightWord="intentional."
                  highlightClassName="text-[#ff8c00] font-extrabold"
                  staggerDelay={0.05}
                />
              </h1>

              <p className="text-slate-300 text-base md:text-lg max-w-xl leading-relaxed">
                Craft evidence-grounded, job-tailored resume variants from one protected master resume. Zero hallucination. WASM compilation with BYOK keys stored in this browser.
              </p>

              <div className="flex items-center gap-4 pt-2 flex-wrap">
                <Link
                  href="/tailor"
                  className="bg-[#ff8c00] text-black font-bold px-6 py-3 rounded inline-flex items-center gap-2 hover:bg-[#ffa024] transition-colors min-h-11"
                >
                  <ArrowRight className="h-4 w-4 text-black" aria-hidden />
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
                <motion.button
                  type="button"
                  disabled={isUploadingPdf}
                  onClick={() => pdfInputRef.current?.click()}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  data-testid="upload-pdf-hero-btn"
                  className="bg-slate-800/70 border border-slate-700 text-white font-semibold px-5 py-3 rounded flex items-center gap-2 hover:bg-slate-700/70 transition-colors"
                >
                  {isUploadingPdf ? (
                    <Loader2 className="h-4 w-4 animate-spin text-[#ff8c00]" />
                  ) : (
                    <Upload className="h-4 w-4 text-[#ff8c00]" />
                  )}
                  {isUploadingPdf ? "Converting PDF…" : "Upload PDF Resume"}
                </motion.button>

                {stats?.hasMasterResume && (
                  <button
                    type="button"
                    disabled={isClearingMaster}
                    onClick={() => setShowClearConfirm(true)}
                    data-testid="clear-master-btn"
                    className="text-slate-400 hover:text-red-400 text-xs font-mono px-3 py-2 rounded border border-transparent hover:border-red-500/30 transition-colors flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-amber-500/60"
                  >
                    Clear Master
                  </button>
                )}
              </div>
            </div>

            <ProductProofCard shouldReduceMotion={reduceMotion} />
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
              const step3Done = Boolean(hasAiKey);
              const step4Done = Boolean(stats.variantsCount > 0 || stats.jobsCount > 0);
              const completedCount = [step1Done, step2Done, step3Done, step4Done].filter(Boolean).length;
              const progressPct = Math.round((completedCount / 4) * 100);

              return (
                <div className="rounded-xl border border-slate-800 bg-[#121929]/95 p-6 shadow-xl backdrop-blur-md">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800/80">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <span className="rounded-full bg-[#ff8c00]/15 border border-[#ff8c00]/40 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[#ff8c00]">
                          Quick Start Guide
                        </span>
                        <span
                          data-testid="onboarding-progress-badge"
                          className="font-mono text-xs text-slate-400"
                        >
                          {completedCount} of 4 steps completed ({progressPct}%)
                        </span>
                      </div>
                      <h2 className="mt-1.5 text-lg md:text-xl font-bold text-white tracking-tight">
                        Set up your workspace in under 3 minutes
                      </h2>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-32 bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-[#ff8c00] h-full rounded-full transition-all duration-300"
                          style={{ width: `${Math.max(8, progressPct)}%` }}
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
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-5">
                    {/* Step 1: Master Resume */}
                    <div
                      data-testid="onboarding-step-1"
                      className={`rounded-lg border p-4 flex flex-col justify-between gap-3 transition ${
                        step1Done
                          ? "border-emerald-500/30 bg-emerald-950/15"
                          : "border-[#ff8c00]/40 bg-[#0b1326]/90"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-slate-400">
                            Step 1
                          </span>
                          {step1Done ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                          ) : (
                            <span className="h-2 w-2 rounded-full bg-[#ff8c00]" />
                          )}
                        </div>
                        <h3 className="text-sm font-bold text-white mb-1">
                          Create or Import Resume
                        </h3>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          Upload an existing PDF or use the Guided Visual Builder—no code required.
                        </p>
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => pdfInputRef.current?.click()}
                          className="text-xs font-mono font-semibold px-2.5 py-1.5 rounded bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700 transition"
                        >
                          Upload PDF
                        </button>
                        <Link
                          href="/editor?mode=visual"
                          data-testid="onboarding-open-visual-editor"
                          className="text-xs font-mono font-semibold text-[#ff8c00] hover:underline flex items-center gap-1"
                        >
                          Visual Builder <ArrowRight className="h-3 w-3" />
                        </Link>
                      </div>
                    </div>

                    {/* Step 2: Evidence Bank */}
                    <div
                      data-testid="onboarding-step-2"
                      className={`rounded-lg border p-4 flex flex-col justify-between gap-3 transition ${
                        step2Done
                          ? "border-emerald-500/30 bg-emerald-950/15"
                          : "border-slate-800 bg-[#0b1326]/90"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-slate-400">
                            Step 2
                          </span>
                          {step2Done ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                          ) : (
                            <span className="h-2 w-2 rounded-full bg-slate-600" />
                          )}
                        </div>
                        <h3 className="text-sm font-bold text-white mb-1">
                          Verify Evidence Bank
                        </h3>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          Store your real project &amp; work bullets so AI tailoring never hallucinates.
                        </p>
                      </div>
                      <Link
                        href="/library"
                        className="text-xs font-mono font-semibold text-[#ff8c00] hover:underline flex items-center gap-1 pt-1"
                      >
                        {step2Done ? `View ${stats.evidenceCount || "Saved"} Items` : "Add Achievements"}{" "}
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>

                    {/* Step 3: Connect AI Key */}
                    <div
                      data-testid="onboarding-step-3"
                      className={`rounded-lg border p-4 flex flex-col justify-between gap-3 transition ${
                        step3Done
                          ? "border-emerald-500/30 bg-emerald-950/15"
                          : "border-slate-800 bg-[#0b1326]/90"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-slate-400">
                            Step 3
                          </span>
                          {step3Done ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                          ) : (
                            <span className="h-2 w-2 rounded-full bg-slate-600" />
                          )}
                        </div>
                        <h3 className="text-sm font-bold text-white mb-1">
                          Connect AI Key (BYOK)
                        </h3>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          Add a Gemini, OpenAI, Anthropic, or local Ollama key encrypted in this browser.
                        </p>
                      </div>
                      <Link
                        href="/settings"
                        className="text-xs font-mono font-semibold text-[#ff8c00] hover:underline flex items-center gap-1 pt-1"
                      >
                        {step3Done ? "AI Connected · Manage" : "Connect Key"}{" "}
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>

                    {/* Step 4: Tailor to a Job */}
                    <div
                      data-testid="onboarding-step-4"
                      className={`rounded-lg border p-4 flex flex-col justify-between gap-3 transition ${
                        step4Done
                          ? "border-emerald-500/30 bg-emerald-950/15"
                          : "border-slate-800 bg-[#0b1326]/90"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-slate-400">
                            Step 4
                          </span>
                          {step4Done ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                          ) : (
                            <span className="h-2 w-2 rounded-full bg-slate-600" />
                          )}
                        </div>
                        <h3 className="text-sm font-bold text-white mb-1">
                          Tailor to Target Job
                        </h3>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          Paste a job posting to score ATS fit, apply verified patches, and export PDF.
                        </p>
                      </div>
                      <Link
                        href="/tailor"
                        className="text-xs font-mono font-semibold text-[#ff8c00] hover:underline flex items-center gap-1 pt-1"
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
          className="w-full bg-[#0d152a] border-y border-slate-800/60 py-16 px-6 md:px-12 z-10 relative"
          data-testid="workflow-section"
        >
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-2xl md:text-3xl text-white font-bold tracking-[-0.03em] mb-2">How ResumeForge Operates</h2>
              <p className="text-slate-300 font-mono text-xs md:text-sm">Guest-ready workspace. Evidence-grounded output.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6" data-testid="workflow-active-panel">
              <div className="flex flex-col items-center text-center p-4">
                <div className="w-12 h-12 rounded-xl bg-[#162035] flex items-center justify-center border border-slate-700/60 mb-4">
                  <Upload className="h-5 w-5 text-[#ff8c00]" />
                </div>
                <h3 className="font-mono text-xs md:text-sm uppercase tracking-wider text-white font-bold mb-1.5">1. IMPORT</h3>
                <p className="text-slate-300 text-xs md:text-sm leading-relaxed">Load your master CV.</p>
              </div>

              <div className="flex flex-col items-center text-center p-4 relative">
                <div className="hidden md:block absolute top-10 left-[-50%] w-full h-[1px] bg-slate-800 z-0"></div>
                <div className="w-12 h-12 rounded-xl bg-[#162035] flex items-center justify-center border border-slate-700/60 mb-4 relative z-10">
                  <Anchor className="h-5 w-5 text-[#ff8c00]" />
                </div>
                <h3 className="font-mono text-xs md:text-sm uppercase tracking-wider text-white font-bold mb-1.5">2. GROUND</h3>
                <p className="text-slate-300 text-xs md:text-sm leading-relaxed">Extract verified facts.</p>
              </div>

              <div className="flex flex-col items-center text-center p-4 relative">
                <div className="hidden md:block absolute top-10 left-[-50%] w-full h-[1px] bg-slate-800 z-0"></div>
                <div className="w-12 h-12 rounded-xl bg-[#ff8c00]/20 flex items-center justify-center border border-[#ff8c00]/60 mb-4 relative z-10">
                  <Sparkles className="h-5 w-5 text-[#ff8c00]" />
                </div>
                <h3 className="font-mono text-xs md:text-sm uppercase tracking-wider text-white font-bold mb-1.5">3. TAILOR</h3>
                <p className="text-slate-300 text-xs md:text-sm leading-relaxed">Align to Job Description.</p>
              </div>

              <div className="flex flex-col items-center text-center p-4 relative">
                <div className="hidden md:block absolute top-10 left-[-50%] w-full h-[1px] bg-slate-800 z-0"></div>
                <div className="w-12 h-12 rounded-xl bg-[#162035] flex items-center justify-center border border-slate-700/60 mb-4 relative z-10">
                  <ShieldCheck className="h-5 w-5 text-slate-300" />
                </div>
                <h3 className="font-mono text-xs md:text-sm uppercase tracking-wider text-white font-bold mb-1.5">4. VERIFY</h3>
                <p className="text-slate-300 text-xs md:text-sm leading-relaxed">Audit against evidence.</p>
              </div>

              <div className="flex flex-col items-center text-center p-4 relative">
                <div className="hidden md:block absolute top-10 left-[-50%] w-full h-[1px] bg-slate-800 z-0"></div>
                <div className="w-12 h-12 rounded-xl bg-[#162035] flex items-center justify-center border border-slate-700/60 mb-4 relative z-10">
                  <Send className="h-5 w-5 text-[#ff8c00]" />
                </div>
                <h3 className="font-mono text-xs md:text-sm uppercase tracking-wider text-white font-bold mb-1.5">5. APPLY</h3>
                <p className="text-slate-300 text-xs md:text-sm leading-relaxed">Export tailored PDF.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Workspace Capability Modules Bento Grid matching 3cdbdb78-e8bb-42f8-a268-f74c4bedd482.jpg */}
        <section
          className="py-20 px-6 md:px-12 max-w-7xl mx-auto w-full z-10"
          data-testid="capability-grid-section"
        >
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-extrabold text-white tracking-[-0.04em]">Workspace Capability Modules</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="capability-cards-grid">
            {/* Card 1: Master Resume Editor */}
            <motion.div variants={blurSlideUpVariants} {...cardHoverProps} className="bg-[#121929]/90 backdrop-blur-md border border-slate-800 rounded-xl p-6 flex flex-col justify-between min-h-[270px] hover:border-slate-700 transition-colors duration-200 group">
              <div>
                <div className="w-10 h-10 rounded-lg bg-[#1a2338] border border-slate-700 flex items-center justify-center mb-6">
                  <FileText className="h-5 w-5 text-[#ff8c00]" />
                </div>
                <h3 className="text-lg md:text-xl font-bold text-white mb-2 tracking-tight">Master Resume Editor</h3>
                <p className="text-slate-300 text-sm leading-relaxed">
                  Edit your protected Typst master resume with WASM compilation and instant live preview.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between">
                <span className="font-mono text-xs uppercase tracking-wider px-3 py-1 rounded bg-[#172033] border border-slate-700 text-slate-300">
                  {`${stats.hasMasterResume ? 1 : 0} MASTER RESUME`}
                </span>
                <Link className="text-[#ff8c00] font-mono text-xs md:text-sm flex items-center gap-1 hover:underline" href="/editor">
                  Open <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </motion.div>

            {/* Card 2: Verified Evidence Bank */}
            <motion.div variants={blurSlideUpVariants} {...cardHoverProps} className="bg-[#121929]/90 backdrop-blur-md border border-slate-800 rounded-xl p-6 flex flex-col justify-between min-h-[270px] hover:border-slate-700 transition-colors duration-200 group">
              <div>
                <div className="w-10 h-10 rounded-lg bg-[#1a2338] border border-slate-700 flex items-center justify-center mb-6">
                  <FolderOpen className="h-5 w-5 text-slate-300" />
                </div>
                <h3 className="text-lg md:text-xl font-bold text-white mb-2 tracking-tight">Verified Evidence Bank</h3>
                <p className="text-slate-300 text-sm leading-relaxed">
                  Central repository of career achievements, verified bullets, and skill inventory.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between">
                <span className="font-mono text-xs uppercase tracking-wider px-3 py-1 rounded bg-[#172033] border border-slate-700 text-slate-300">
                  {`${stats.evidenceCount} TOTAL ITEMS`}
                </span>
                <Link className="text-slate-400 hover:text-white font-mono text-xs md:text-sm flex items-center gap-1 transition-colors" href="/library">
                  Open <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </motion.div>

            {/* Card 3: Tailor Engine & AI Gateway (Large 2-row span) */}
            <motion.div variants={blurSlideUpVariants} {...cardHoverProps} className="bg-[#121929]/90 backdrop-blur-md border border-slate-800 rounded-xl p-6 flex flex-col justify-between min-h-[270px] lg:col-span-1 md:col-span-2 lg:row-span-2 relative overflow-hidden">
              <div>
                <div className="w-10 h-10 rounded-lg bg-[#ff8c00]/15 border border-[#ff8c00]/40 flex items-center justify-center mb-6">
                  <Settings className="h-5 w-5 text-[#ff8c00]" />
                </div>
                <h3 className="text-xl md:text-2xl font-bold text-white mb-3 tracking-tight">Tailor Engine &amp; AI Gateway</h3>
                <p className="text-slate-300 text-sm leading-relaxed mb-6">
                  Intelligently map evidence to job descriptions. Generate tailored variants while maintaining absolute ground truth. BYOK keys stay in this browser; resume data lives in your hosted database.
                </p>
                <div className="bg-[#0b111e] border border-slate-800 rounded-lg p-3.5 font-mono text-xs text-slate-300 mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-slate-300 font-medium">Variant Generation</span>
                    <span className="text-slate-400 text-xs">Processing...</span>
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-[#ff8c00] h-full w-[70%] rounded-full"></div>
                  </div>
                </div>
              </div>
              <div className="mt-auto pt-4 border-t border-slate-800/80 flex items-center justify-between">
                <span className="font-mono text-xs uppercase tracking-wider px-3 py-1 rounded bg-[#172033] border border-slate-700 text-slate-300">
                  {`${stats.variantsCount} VARIANTS GENERATED`}
                </span>
                <Link className="bg-[#ff8c00] text-black font-bold px-4 py-2 rounded flex items-center gap-1.5 hover:bg-[#ffa024] transition-colors text-xs md:text-sm" href="/tailor">
                  Tailor Now
                </Link>
              </div>
            </motion.div>

            {/* Card 4: AI Key Vault & Settings */}
            <motion.div variants={blurSlideUpVariants} {...cardHoverProps} className="bg-[#121929]/90 backdrop-blur-md border border-slate-800 rounded-xl p-6 flex flex-col justify-between min-h-[270px] hover:border-slate-700 transition-colors duration-200 group">
              <div>
                <div className="w-10 h-10 rounded-lg bg-[#1a2338] border border-slate-700 flex items-center justify-center mb-6">
                  <KeyRound className="h-5 w-5 text-slate-300" />
                </div>
                <h3 className="text-lg md:text-xl font-bold text-white mb-2 tracking-tight">AI Key Vault &amp; Settings</h3>
                <p className="text-slate-300 text-sm leading-relaxed">
                  Configure BYOK credentials (OpenAI, Anthropic, Gemini) with local client-side key scrubbing.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between">
                <span className="font-mono text-xs uppercase tracking-wider px-3 py-1 rounded bg-[#172033] border border-slate-700 text-slate-300">ZERO-LEAK REDACTION</span>
                <Link className="text-slate-400 hover:text-white font-mono text-xs md:text-sm flex items-center gap-1 transition-colors" href="/settings">
                  Open <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </motion.div>

            {/* Card 5: Job Application Tracker */}
            <motion.div variants={blurSlideUpVariants} {...cardHoverProps} className="bg-[#121929]/90 backdrop-blur-md border border-slate-800 rounded-xl p-6 flex flex-col justify-between min-h-[270px] hover:border-slate-700 transition-colors duration-200 group">
              <div>
                <div className="w-10 h-10 rounded-lg bg-[#1a2338] border border-slate-700 flex items-center justify-center mb-6">
                  <Briefcase className="h-5 w-5 text-[#ff8c00]" />
                </div>
                <h3 className="text-lg md:text-xl font-bold text-white mb-2 tracking-tight">Job Application Tracker</h3>
                <p className="text-slate-300 text-sm leading-relaxed">
                  Kanban &amp; list pipeline for tracking applications, interview notes, and status history.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between">
                <span className="font-mono text-xs uppercase tracking-wider px-3 py-1 rounded bg-[#172033] border border-slate-700 text-slate-300">
                  {`${stats.jobsCount} JOBS TRACKED`}
                </span>
                <Link className="text-[#ff8c00] font-mono text-xs md:text-sm flex items-center gap-1 hover:underline" href="/tracker">
                  Open <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Phase: Instant ATS Sandbox Interactive Playground */}
        <AtsSandboxSection />

        {/* Phase: The Engineering Wedge Competitive Matrix */}
        <CompetitiveMatrixSection />
      </main>

      <LandingFooter />
      {showClearConfirm ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="clear-master-title"
        >
          <div className="w-full max-w-sm rounded-xl border border-slate-700 bg-[#121929] p-5 shadow-2xl">
            <h2 id="clear-master-title" className="text-base font-semibold text-white">
              Clear master resume?
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              This removes master status from the current resume. You can save a new master from the editor.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-amber-500/60"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isClearingMaster}
                onClick={handleClearMaster}
                className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-500 focus-visible:ring-2 focus-visible:ring-amber-500/60 disabled:opacity-50"
              >
                {isClearingMaster ? "Clearing…" : "Clear Master"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
