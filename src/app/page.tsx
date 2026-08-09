"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { AppShell } from "@/components/design-system/app-shell";
import { LandingHero } from "@/components/landing/landing-hero";
import { CapabilityMarquee } from "@/components/landing/capability-marquee";
import { WorkflowTimeline } from "@/components/landing/workflow-timeline";
import { CapabilityGrid } from "@/components/landing/capability-grid";
import { LandingFooter } from "@/components/landing/landing-footer";

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

export default function Home() {
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();
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
        // Guaranteed redirect to /editor with newly created draft
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
    <AppShell variant="landing">
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 md:px-8 py-8 flex flex-col gap-12 relative z-10">
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

        {/* 1. Landing Hero Section & Proof Preview Card */}
        <LandingHero
          isUploadingPdf={isUploadingPdf}
          isClearingMaster={isClearingMaster}
          hasMasterResume={stats?.hasMasterResume ?? false}
          onPdfUploadClick={() => pdfInputRef.current?.click()}
          onPdfFileChange={handlePdfUpload}
          onClearMaster={handleClearMaster}
          pdfInputRef={pdfInputRef}
          shouldReduceMotion={shouldReduceMotion ?? false}
        />

        {/* 2. Capability Marquee Ticker Strip */}
        <CapabilityMarquee />

        {/* 3. Editorial 5-Step Workflow Timeline */}
        <WorkflowTimeline />

        {/* 4. Mixed-Surface Chromatic Capability Grid */}
        <CapabilityGrid stats={stats} loading={loading} />
      </main>

      {/* 5. Editorial Landing Footer */}
      <LandingFooter />
    </AppShell>
  );
}
