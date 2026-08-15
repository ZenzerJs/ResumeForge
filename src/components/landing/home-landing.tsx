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

  const pdfInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mq.matches);
    const onChange = () => setReduceMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
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
        const savedSettings = localStorage.getItem("resumeforge_ai_settings");
        if (savedSettings) formData.append("providerConfig", savedSettings);
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
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full border border-[#ff8c00]/30 bg-[#ff8c00]/10 w-fit">
                <KeyRound className="h-3.5 w-3.5 text-[#ff8c00]" />
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#ff8c00]">PRIVATE RESUME WORKSPACE</span>
              </div>

              <h1 className="text-4xl md:text-5xl lg:text-6xl text-white leading-tight font-extrabold tracking-[-0.04em] text-pretty">
                <StaggeredText
                  text="Make every application feel intentional."
                  highlightWord="intentional."
                  highlightClassName="text-[#ff8c00] font-extrabold"
                  staggerDelay={0.05}
                />
              </h1>

              <p className="text-slate-400 text-base md:text-lg max-w-xl leading-relaxed">
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

        <CapabilityMarquee />

        {/* How ResumeForge Operates Pipeline Section */}
        <section
          className="w-full bg-[#0d152a] border-y border-slate-800/60 py-16 px-6 md:px-12 z-10 relative"
          data-testid="workflow-section"
        >
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-2xl md:text-3xl text-white font-bold tracking-[-0.03em] mb-2">How ResumeForge Operates</h2>
              <p className="text-slate-400 font-mono text-xs">Guest-ready workspace. Evidence-grounded output.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6" data-testid="workflow-active-panel">
              <div className="flex flex-col items-center text-center p-4">
                <div className="w-12 h-12 rounded-xl bg-[#162035] flex items-center justify-center border border-slate-700/60 mb-4">
                  <Upload className="h-5 w-5 text-[#ff8c00]" />
                </div>
                <h3 className="font-mono text-xs uppercase tracking-[0.15em] text-white font-bold mb-1">1. IMPORT</h3>
                <p className="text-slate-400 text-xs leading-relaxed">Load your master CV.</p>
              </div>

              <div className="flex flex-col items-center text-center p-4 relative">
                <div className="hidden md:block absolute top-10 left-[-50%] w-full h-[1px] bg-slate-800 z-0"></div>
                <div className="w-12 h-12 rounded-xl bg-[#162035] flex items-center justify-center border border-slate-700/60 mb-4 relative z-10">
                  <Anchor className="h-5 w-5 text-[#ff8c00]" />
                </div>
                <h3 className="font-mono text-xs uppercase tracking-[0.15em] text-white font-bold mb-1">2. GROUND</h3>
                <p className="text-slate-400 text-xs leading-relaxed">Extract verified facts.</p>
              </div>

              <div className="flex flex-col items-center text-center p-4 relative">
                <div className="hidden md:block absolute top-10 left-[-50%] w-full h-[1px] bg-slate-800 z-0"></div>
                <div className="w-12 h-12 rounded-xl bg-[#ff8c00]/20 flex items-center justify-center border border-[#ff8c00]/60 mb-4 relative z-10">
                  <Sparkles className="h-5 w-5 text-[#ff8c00]" />
                </div>
                <h3 className="font-mono text-xs uppercase tracking-[0.15em] text-white font-bold mb-1">3. TAILOR</h3>
                <p className="text-slate-400 text-xs leading-relaxed">Align to Job Description.</p>
              </div>

              <div className="flex flex-col items-center text-center p-4 relative">
                <div className="hidden md:block absolute top-10 left-[-50%] w-full h-[1px] bg-slate-800 z-0"></div>
                <div className="w-12 h-12 rounded-xl bg-[#162035] flex items-center justify-center border border-slate-700/60 mb-4 relative z-10">
                  <ShieldCheck className="h-5 w-5 text-slate-300" />
                </div>
                <h3 className="font-mono text-xs uppercase tracking-[0.15em] text-white font-bold mb-1">4. VERIFY</h3>
                <p className="text-slate-400 text-xs leading-relaxed">Audit against evidence.</p>
              </div>

              <div className="flex flex-col items-center text-center p-4 relative">
                <div className="hidden md:block absolute top-10 left-[-50%] w-full h-[1px] bg-slate-800 z-0"></div>
                <div className="w-12 h-12 rounded-xl bg-[#162035] flex items-center justify-center border border-slate-700/60 mb-4 relative z-10">
                  <Send className="h-5 w-5 text-[#ff8c00]" />
                </div>
                <h3 className="font-mono text-xs uppercase tracking-[0.15em] text-white font-bold mb-1">5. APPLY</h3>
                <p className="text-slate-400 text-xs leading-relaxed">Export tailored PDF.</p>
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
            <h2 className="text-3xl font-extrabold text-white tracking-[-0.04em]">Workspace Capability Modules</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="capability-cards-grid">
            {/* Card 1: Master Resume Editor */}
            <motion.div variants={blurSlideUpVariants} {...cardHoverProps} className="bg-[#121929]/90 backdrop-blur-md border border-slate-800 rounded-xl p-6 flex flex-col justify-between min-h-[270px] hover:border-slate-700 transition-colors duration-200 group">
              <div>
                <div className="w-10 h-10 rounded-lg bg-[#1a2338] border border-slate-700 flex items-center justify-center mb-6">
                  <FileText className="h-5 w-5 text-[#ff8c00]" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2 tracking-tight">Master Resume Editor</h3>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Edit your protected Typst master resume with WASM compilation and instant live preview.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between">
                <span className="font-mono text-[11px] uppercase tracking-wider px-2.5 py-1 rounded bg-[#172033] border border-slate-700 text-slate-300">
                  {`${stats.hasMasterResume ? 1 : 0} MASTER RESUME`}
                </span>
                <Link className="text-[#ff8c00] font-mono text-xs flex items-center gap-1 hover:underline" href="/editor">
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
                <h3 className="text-lg font-bold text-white mb-2 tracking-tight">Verified Evidence Bank</h3>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Central repository of career achievements, verified bullets, and skill inventory.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between">
                <span className="font-mono text-[11px] uppercase tracking-wider px-2.5 py-1 rounded bg-[#172033] border border-slate-700 text-slate-300">
                  {`${stats.evidenceCount} TOTAL ITEMS`}
                </span>
                <Link className="text-slate-400 hover:text-white font-mono text-xs flex items-center gap-1 transition-colors" href="/library">
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
                <h3 className="text-xl font-bold text-white mb-3 tracking-tight">Tailor Engine &amp; AI Gateway</h3>
                <p className="text-slate-400 text-xs leading-relaxed mb-6">
                  Intelligently map evidence to job descriptions. Generate tailored variants while maintaining absolute ground truth. BYOK keys stay in this browser; resume data lives in your hosted database.
                </p>
                <div className="bg-[#0b111e] border border-slate-800 rounded-lg p-3.5 font-mono text-xs text-slate-300 mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-slate-300 font-medium">Variant Generation</span>
                    <span className="text-slate-400 text-[11px]">Processing...</span>
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-[#ff8c00] h-full w-[70%] rounded-full"></div>
                  </div>
                </div>
              </div>
              <div className="mt-auto pt-4 border-t border-slate-800/80 flex items-center justify-between">
                <span className="font-mono text-[11px] uppercase tracking-wider px-2.5 py-1 rounded bg-[#172033] border border-slate-700 text-slate-300">
                  {`${stats.variantsCount} VARIANTS GENERATED`}
                </span>
                <Link className="bg-[#ff8c00] text-black font-bold px-4 py-1.5 rounded flex items-center gap-1.5 hover:bg-[#ffa024] transition-colors text-xs" href="/tailor">
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
                <h3 className="text-lg font-bold text-white mb-2 tracking-tight">AI Key Vault &amp; Settings</h3>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Configure BYOK credentials (OpenAI, Anthropic, Gemini) with local client-side key scrubbing.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between">
                <span className="font-mono text-[11px] uppercase tracking-wider px-2.5 py-1 rounded bg-[#172033] border border-slate-700 text-slate-300">ZERO-LEAK REDACTION</span>
                <Link className="text-slate-400 hover:text-white font-mono text-xs flex items-center gap-1 transition-colors" href="/settings">
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
                <h3 className="text-lg font-bold text-white mb-2 tracking-tight">Job Application Tracker</h3>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Kanban &amp; list pipeline for tracking applications, interview notes, and status history.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between">
                <span className="font-mono text-[11px] uppercase tracking-wider px-2.5 py-1 rounded bg-[#172033] border border-slate-700 text-slate-300">
                  {`${stats.jobsCount} JOBS TRACKED`}
                </span>
                <Link className="text-[#ff8c00] font-mono text-xs flex items-center gap-1 hover:underline" href="/tracker">
                  Open <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </motion.div>
          </div>
        </section>
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
