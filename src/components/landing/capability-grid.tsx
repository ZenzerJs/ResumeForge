"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { FileText, Database, Sparkles, Briefcase, Settings, ArrowRight, Cpu, Lock, History } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cardHoverProps, blurSlideUpVariants, staggerContainerVariants } from "@/lib/theme/animations";

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

interface CapabilityGridProps {
  stats: DashboardStats | null;
  loading: boolean;
}

export function CapabilityGrid({ stats, loading }: CapabilityGridProps) {
  return (
    <section className="py-12 px-margin-mobile md:px-margin-desktop max-w-7xl mx-auto w-full z-10" data-testid="capability-grid-section">
      <div className="text-center mb-12">
        <h2 className="font-page-title text-page-title-mobile md:text-page-title text-on-surface font-bold tracking-[-0.05em]">
          Workspace Capability Modules
        </h2>
      </div>

      <motion.div
        variants={staggerContainerVariants}
        initial="initial"
        whileInView="animate"
        viewport={{ once: true, amount: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        data-testid="capability-cards-grid"
      >
        {/* Card 1: Master Resume Editor */}
        <motion.div variants={blurSlideUpVariants} {...cardHoverProps} className="glass-panel rounded-xl p-panel-padding flex flex-col justify-between min-h-[280px] glow-effect transition-all duration-300 group">
          <div>
            <div className="w-10 h-10 rounded-lg bg-surface-container-high border border-outline-variant flex items-center justify-center mb-6 group-hover:border-primary/50 transition-colors">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <h3 className="font-body-regular text-lg font-bold text-on-surface mb-2 tracking-[-0.05em]">Master Resume Editor</h3>
            <p className="text-on-surface-variant font-body-dense text-body-dense leading-[1.6]">
              Edit your protected Typst master resume with WASM compilation and instant live preview.
            </p>
          </div>
          <div className="mt-6 pt-4 border-t border-outline-variant/30 flex items-center justify-between">
            <span className="font-mono-data text-[11px] uppercase tracking-wider px-2 py-1 rounded bg-surface-container-high border border-outline-variant text-secondary">
              {loading ? <Skeleton className="h-3 w-20" /> : stats?.hasMasterResume ? "1 Master Resume" : "No Master Resume"}
            </span>
            <Link className="text-primary font-mono-data text-mono-data flex items-center gap-1 hover:text-primary-fixed transition-colors" href="/editor">
              Open <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </motion.div>

        {/* Card 2: Verified Evidence Bank */}
        <motion.div variants={blurSlideUpVariants} {...cardHoverProps} className="glass-panel rounded-xl p-panel-padding flex flex-col justify-between min-h-[280px] glow-secondary transition-all duration-300 group">
          <div>
            <div className="w-10 h-10 rounded-lg bg-surface-container-high border border-outline-variant flex items-center justify-center mb-6 group-hover:border-secondary/50 transition-colors">
              <Database className="h-5 w-5 text-secondary" />
            </div>
            <h3 className="font-body-regular text-lg font-bold text-on-surface mb-2 tracking-[-0.05em]">Verified Evidence Bank</h3>
            <p className="text-on-surface-variant font-body-dense text-body-dense leading-[1.6]">
              Central repository of career achievements, verified bullets, and skill inventory.
            </p>
          </div>
          <div className="mt-6 pt-4 border-t border-outline-variant/30 flex items-center justify-between">
            <span className="font-mono-data text-[11px] uppercase tracking-wider px-2 py-1 rounded bg-secondary/10 border border-secondary/30 text-secondary">
              {loading ? <Skeleton className="h-3 w-20" /> : `${stats?.evidenceCount || 0} Total Items`}
            </span>
            <Link className="text-secondary font-mono-data text-mono-data flex items-center gap-1 hover:text-secondary-fixed transition-colors" href="/library">
              Open <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </motion.div>

        {/* Card 3: Tailor Engine & AI Gateway */}
        <motion.div variants={blurSlideUpVariants} {...cardHoverProps} className="glass-panel rounded-xl p-panel-padding flex flex-col justify-between min-h-[280px] glow-effect transition-all duration-300 group lg:col-span-1 md:col-span-2 lg:row-span-2 relative overflow-hidden">
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-primary/5 rounded-full blur-3xl pointer-events-none"></div>
          <div>
            <div className="w-12 h-12 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center mb-6 shadow-[0_0_15px_rgba(255,140,0,0.15)]">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-page-title-mobile text-2xl text-on-surface mb-3 tracking-[-0.05em] font-bold">Tailor Engine &amp; AI Gateway</h3>
            <p className="text-on-surface-variant font-body-regular text-body-regular leading-[1.6] mb-6">
              Intelligently map evidence to job descriptions. Generate tailored variants while maintaining absolute ground truth. Local processing ensures your data never leaves your machine.
            </p>
            <div className="bg-surface-container-lowest border border-outline-variant rounded p-3 font-mono-data text-xs text-on-surface-variant mb-4">
              <div className="flex justify-between items-center mb-2 border-b border-surface-variant pb-2">
                <span>Variant Generation</span>
                <span className="text-secondary">Ready</span>
              </div>
              <div className="w-full bg-surface-variant h-1 rounded-full overflow-hidden">
                <div className="bg-primary h-full w-[70%] rounded-full shadow-[0_0_8px_rgba(255,140,0,0.8)]"></div>
              </div>
            </div>
          </div>
          <div className="mt-auto pt-4 border-t border-outline-variant/30 flex items-center justify-between z-10">
            <span className="font-mono-data text-[11px] uppercase tracking-wider px-2 py-1 rounded bg-surface-container-high border border-outline-variant text-secondary">
              {loading ? <Skeleton className="h-3 w-24" /> : `${stats?.variantsCount || 0} Variants Generated`}
            </span>
            <Link className="bg-primary text-on-primary font-bold px-4 py-1.5 rounded flex items-center gap-2 hover:bg-primary-fixed transition-colors text-sm" href="/tailor">
              Tailor Now
            </Link>
          </div>
        </motion.div>

        {/* Card 4: AI Key Vault & Settings */}
        <motion.div variants={blurSlideUpVariants} {...cardHoverProps} className="glass-panel rounded-xl p-panel-padding flex flex-col justify-between min-h-[280px] glow-secondary transition-all duration-300 group">
          <div>
            <div className="w-10 h-10 rounded-lg bg-surface-container-high border border-outline-variant flex items-center justify-center mb-6 group-hover:border-secondary/50 transition-colors">
              <Settings className="h-5 w-5 text-secondary" />
            </div>
            <h3 className="font-body-regular text-lg font-bold text-on-surface mb-2 tracking-[-0.05em]">AI Key Vault &amp; Settings</h3>
            <p className="text-on-surface-variant font-body-dense text-body-dense leading-[1.6]">
              Configure BYOK credentials (OpenAI, Anthropic, Gemini) with local client-side key scrubbing.
            </p>
          </div>
          <div className="mt-6 pt-4 border-t border-outline-variant/30 flex items-center justify-between">
            <span className="font-mono-data text-[11px] uppercase tracking-wider px-2 py-1 rounded bg-secondary/10 border border-secondary/30 text-secondary">
              Zero-Leak Redaction
            </span>
            <Link className="text-secondary font-mono-data text-mono-data flex items-center gap-1 hover:text-secondary-fixed transition-colors" href="/settings">
              Open <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </motion.div>

        {/* Card 5: Job Application Tracker */}
        <motion.div variants={blurSlideUpVariants} {...cardHoverProps} className="glass-panel rounded-xl p-panel-padding flex flex-col justify-between min-h-[280px] glow-effect transition-all duration-300 group">
          <div>
            <div className="w-10 h-10 rounded-lg bg-surface-container-high border border-outline-variant flex items-center justify-center mb-6 group-hover:border-primary/50 transition-colors">
              <Briefcase className="h-5 w-5 text-primary" />
            </div>
            <h3 className="font-body-regular text-lg font-bold text-on-surface mb-2 tracking-[-0.05em]">Job Application Tracker</h3>
            <p className="text-on-surface-variant font-body-dense text-body-dense leading-[1.6]">
              Kanban &amp; list pipeline for tracking applications, interview notes, and status history.
            </p>
          </div>
          <div className="mt-6 pt-4 border-t border-outline-variant/30 flex items-center justify-between">
            <span className="font-mono-data text-[11px] uppercase tracking-wider px-2 py-1 rounded bg-surface-container-high border border-outline-variant text-secondary">
              {loading ? <Skeleton className="h-3 w-20" /> : `${stats?.jobsCount || 0} Jobs Tracked`}
            </span>
            <Link className="text-primary font-mono-data text-mono-data flex items-center gap-1 hover:text-primary-fixed transition-colors" href="/tracker">
              Open <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}
