"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Database,
  Sparkles,
  Briefcase,
  Settings,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Zap,
  Flame,
  Upload,
  Loader2,
  Trash2,
  FileCheck,
} from "lucide-react";
import { TopNav } from "@/components/navigation/top-nav";
import { Skeleton } from "@/components/ui/skeleton";

interface DashboardStats {
  hasMasterResume: boolean;
  masterResumeTitle: string | null;
  evidenceCount: number;
  verifiedEvidenceCount: number;
  jobsCount: number;
  appliedJobsCount: number;
  variantsCount: number;
  coverLettersCount: number;
}

const workspaces = [
  {
    title: "Master Resume Editor",
    description:
      "Edit your protected Typst master resume with WASM compilation and instant live preview.",
    href: "/editor",
    icon: FileText,
    iconBg: "bg-amber-500/10 border-amber-500/20",
    iconColor: "text-amber-400",
    activeBorder: "group-hover:border-amber-500/30",
    activeGlow: "group-hover:shadow-amber-500/6",
    badge: (stats: DashboardStats | null) =>
      stats?.hasMasterResume ? "Master Active" : "Requires Setup",
    badgeStyle: (stats: DashboardStats | null) =>
      stats?.hasMasterResume
        ? "bg-amber-500/10 border-amber-500/25 text-amber-400"
        : "bg-slate-800 border-slate-700 text-slate-400",
    stat: (stats: DashboardStats | null) =>
      stats ? (stats.hasMasterResume ? "1 Master Resume" : "No Master Resume") : "—",
  },
  {
    title: "Verified Evidence Bank",
    description:
      "Central repository of career achievements, verified bullets, and skill inventory.",
    href: "/library",
    icon: Database,
    iconBg: "bg-emerald-500/10 border-emerald-500/20",
    iconColor: "text-emerald-400",
    activeBorder: "group-hover:border-emerald-500/30",
    activeGlow: "group-hover:shadow-emerald-500/6",
    badge: (stats: DashboardStats | null) =>
      stats ? `${stats.verifiedEvidenceCount} Verified` : "Evidence Bank",
    badgeStyle: () => "bg-emerald-500/10 border-emerald-500/25 text-emerald-400",
    stat: (stats: DashboardStats | null) =>
      stats ? `${stats.evidenceCount} Total Items` : "—",
  },
  {
    title: "Tailor Engine & AI Gateway",
    description:
      "Parse job descriptions, generate evidence-grounded patches, and inspect 100-point ATS scores.",
    href: "/tailor",
    icon: Sparkles,
    iconBg: "bg-amber-500/10 border-amber-500/20",
    iconColor: "text-amber-400",
    activeBorder: "group-hover:border-amber-500/30",
    activeGlow: "group-hover:shadow-amber-500/6",
    badge: () => "BYOK AI",
    badgeStyle: () => "bg-amber-500/10 border-amber-500/25 text-amber-400",
    stat: (stats: DashboardStats | null) =>
      stats ? `${stats.variantsCount} Variants Generated` : "—",
  },
  {
    title: "Job Application Tracker",
    description:
      "Kanban & list pipeline for tracking applications, interview notes, and status history.",
    href: "/tracker",
    icon: Briefcase,
    iconBg: "bg-amber-500/10 border-amber-500/20",
    iconColor: "text-amber-400",
    activeBorder: "group-hover:border-amber-500/30",
    activeGlow: "group-hover:shadow-amber-500/6",
    badge: (stats: DashboardStats | null) =>
      stats ? `${stats.appliedJobsCount} Applied` : "Pipeline",
    badgeStyle: () => "bg-amber-500/10 border-amber-500/25 text-amber-400",
    stat: (stats: DashboardStats | null) =>
      stats ? `${stats.jobsCount} Jobs Tracked` : "—",
  },
  {
    title: "AI Key Vault & Settings",
    description:
      "Configure BYOK credentials (OpenAI, Anthropic, Gemini) with local client-side key scrubbing.",
    href: "/settings",
    icon: Settings,
    iconBg: "bg-amber-500/10 border-amber-500/20",
    iconColor: "text-amber-400",
    activeBorder: "group-hover:border-amber-500/30",
    activeGlow: "group-hover:shadow-amber-500/6",
    badge: () => "Local-First",
    badgeStyle: () => "bg-amber-500/10 border-amber-500/25 text-amber-400",
    stat: () => "Zero-Leak Redaction",
  },
];

export default function Home() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  // PDF Upload & Reset state
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const [isClearingMaster, setIsClearingMaster] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const pdfInputRef = useRef<HTMLInputElement>(null);

  const fetchStats = () => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setStats(j.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchStats();
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

      // Pass BYOK AI settings from localStorage if configured
      try {
        const savedSettings = localStorage.getItem("resumeforge_ai_settings");
        if (savedSettings) {
          formData.append("providerConfig", savedSettings);
        }
      } catch {
        // localStorage unreadable
      }

      const res = await fetch("/api/resumes/upload-pdf", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (res.ok && json.success && json.data?.id) {
        // Guaranteed redirect to /editor with the newly created draft
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
        setNotification({
          type: "success",
          message: "Master Resume status cleared for this session.",
        });
        fetchStats();
      }
    } catch (err) {
      setNotification({
        type: "error",
        message: "Failed to clear master resume",
      });
    } finally {
      setIsClearingMaster(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: "#0A0E17" }}
    >
      <TopNav />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 md:px-8 py-10 md:py-14 flex flex-col gap-12">
        {/* Notification Toast */}
        <AnimatePresence>
          {notification && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`p-3.5 rounded-lg border flex items-center justify-between text-xs font-medium max-w-xl mx-auto w-full shadow-lg ${
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
                onClick={() => setNotification(null)}
                className="text-slate-400 hover:text-white transition-colors ml-4"
              >
                ✕
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hero Section */}
        <motion.section
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="flex flex-col items-center text-center gap-5 max-w-3xl mx-auto"
        >
          <div
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-mono font-medium"
            style={{
              background: "rgba(245, 158, 11, 0.07)",
              borderColor: "rgba(245, 158, 11, 0.2)",
              color: "#FCD34D",
            }}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Local-First · Evidence-Grounded · Zero-Hallucination AI
          </div>

          {/* Fire / Forge Theme Hero Header */}
          <div className="flex flex-col items-center gap-2">
            <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-normal text-white flex items-center justify-center gap-1.5 pb-1">
              <Flame className="h-9 w-9 text-orange-500 animate-pulse drop-shadow-[0_0_16px_rgba(245,158,11,0.6)] shrink-0" />
              Resume
              <span className="bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 bg-clip-text text-transparent drop-shadow-[0_0_25px_rgba(245,158,11,0.45)] inline-block pb-2 pr-1">
                Forge
              </span>
            </h1>
            <p className="text-base md:text-xl font-medium tracking-tight text-slate-200 mt-1">
              One Protected Master Resume. Infinite Tailored Variants.
            </p>
          </div>

          <p className="text-sm md:text-base leading-relaxed max-w-xl" style={{ color: "#6B7A99" }}>
            Maintain a single source of truth in your Evidence Bank. Upload your resume PDF or edit in WASM Typst compilation with a local BYOK AI gateway.
          </p>

          {/* Action CTAs: Upload PDF + Open Editor */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {/* Hidden PDF File Input */}
            <input
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
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 shadow-lg"
              style={{
                background: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)",
                color: "#0A0E17",
                boxShadow: "0 0 24px rgba(245, 158, 11, 0.3)",
              }}
              data-testid="upload-pdf-hero-btn"
            >
              {isUploadingPdf ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {isUploadingPdf ? "Converting your resume with AI..." : "Upload PDF Resume"}
            </button>

            <Link href="/editor">
              <button
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 border"
                style={{
                  background: "rgba(17, 22, 34, 0.85)",
                  borderColor: "#1E2536",
                  color: "#E2E8F0",
                }}
              >
                <FileText className="h-4 w-4 text-amber-400" />
                Open Typst Editor
                <ArrowRight className="h-4 w-4" />
              </button>
            </Link>

            {stats?.hasMasterResume && (
              <button
                type="button"
                disabled={isClearingMaster}
                onClick={handleClearMaster}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-mono text-slate-500 hover:text-red-400 transition-colors border border-transparent hover:border-red-950/60"
                title="Clear current Master Resume status for this session"
                data-testid="clear-master-btn"
              >
                {isClearingMaster ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                Clear Master
              </button>
            )}
          </div>
        </motion.section>

        {/* Live Stats Bar */}
        <motion.section
          initial={{ opacity: 0, scale: 0.99 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-px rounded-xl overflow-hidden border"
          style={{ borderColor: "#1E2536", background: "#1E2536" }}
        >
          {[
            {
              label: "Master Resume",
              value: loading ? null : (
                stats?.hasMasterResume ? (
                  <span className="flex items-center gap-1.5 text-amber-400 font-medium">
                    <FileCheck className="h-3.5 w-3.5" /> Active
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-slate-500 font-medium">
                    <AlertCircle className="h-3.5 w-3.5" /> Not Uploaded
                  </span>
                )
              ),
            },
            {
              label: "Verified Bullets",
              value: loading ? null : (
                <span className="text-white font-mono font-bold text-lg">
                  {stats?.verifiedEvidenceCount ?? 0}
                </span>
              ),
            },
            {
              label: "Variants",
              value: loading ? null : (
                <span className="text-white font-mono font-bold text-lg">
                  {stats?.variantsCount ?? 0}
                </span>
              ),
            },
            {
              label: "Jobs Tracked",
              value: loading ? null : (
                <span className="text-white font-mono font-bold text-lg">
                  {stats?.jobsCount ?? 0}
                </span>
              ),
            },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="flex flex-col gap-1.5 px-5 py-4"
              style={{ backgroundColor: "#111622" }}
            >
              <span
                className="text-[10px] font-mono font-medium uppercase tracking-wider"
                style={{ color: "#4B5A7A" }}
              >
                {label}
              </span>
              {value ?? (
                <Skeleton className="h-5 w-20 mt-0.5" />
              )}
            </div>
          ))}
        </motion.section>

        {/* Workspace Module Grid */}
        <section className="flex flex-col gap-5">
          {/* Animated Module Header Row */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="flex items-center justify-between"
          >
            <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-400" />
              Workspace Modules
            </h2>
            <span className="text-[10px] font-mono" style={{ color: "#3D4F6E" }}>
              5 modules · local-only
            </span>
          </motion.div>

          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3"
            initial="hidden"
            animate="visible"
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.07 } },
            }}
          >
            {workspaces.map((ws) => {
              const Icon = ws.icon;
              const badge = ws.badge(stats);
              const badgeStyle = ws.badgeStyle(stats);
              const stat = ws.stat(stats);

              return (
                <motion.div
                  key={ws.href}
                  variants={{
                    hidden: { opacity: 0, y: 12 },
                    visible: { opacity: 1, y: 0, transition: { duration: 0.35 } },
                  }}
                >
                  <Link href={ws.href} className="group block h-full">
                    <div
                      className={`h-full p-5 rounded-xl border flex flex-col justify-between gap-4 transition-all duration-200 hover-spotlight ${ws.activeBorder} ${ws.activeGlow}`}
                      style={{ backgroundColor: "#111622", borderColor: "#1E2536" }}
                    >
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <div
                            className={`flex h-9 w-9 items-center justify-center rounded-lg border ${ws.iconBg} transition-transform duration-200 group-hover:scale-105`}
                          >
                            <Icon className={`h-4.5 w-4.5 ${ws.iconColor}`} />
                          </div>
                          <span
                            className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded-full border ${badgeStyle}`}
                          >
                            {badge}
                          </span>
                        </div>

                        <div>
                          <h3 className="font-semibold text-sm text-white/90 group-hover:text-white transition-colors">
                            {ws.title}
                          </h3>
                          <p className="text-xs mt-1.5 leading-relaxed" style={{ color: "#6B7A99" }}>
                            {ws.description}
                          </p>
                        </div>
                      </div>

                      <div
                        className="flex items-center justify-between pt-3 border-t text-xs"
                        style={{ borderColor: "#1E2536" }}
                      >
                        <span className="font-mono" style={{ color: "#3D4F6E" }}>
                          {loading ? <Skeleton className="h-3 w-24" /> : stat}
                        </span>
                        <span
                          className={`flex items-center gap-1 font-medium transition-transform duration-150 group-hover:translate-x-0.5 ${ws.iconColor}`}
                        >
                          Open
                          <ArrowRight className="h-3.5 w-3.5" />
                        </span>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </motion.div>
        </section>
      </main>

      <footer
        className="py-5 text-center text-[11px] font-mono border-t"
        style={{ borderColor: "#1E2536", color: "#3D4F6E" }}
      >
        ResumeForge · Local-First · Confidential Storage Only
      </footer>
    </div>
  );
}
