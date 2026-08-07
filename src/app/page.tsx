"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  FileText,
  Database,
  Sparkles,
  Briefcase,
  Settings,
  ArrowRight,
  ShieldCheck,
  Zap,
  CheckCircle2,
  AlertCircle,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";

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
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("/api/stats");
        if (res.ok) {
          const json = await res.json();
          if (json.success) {
            setStats(json.data);
          }
        }
      } catch (err) {
        console.error("Failed to load dashboard stats", err);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
  };

  const workspaces = [
    {
      title: "Master Resume Editor",
      description: "Edit your core protected Typst master resume with WASM compilation & instant SVG/PDF live preview.",
      href: "/editor",
      icon: FileText,
      badge: stats?.hasMasterResume ? "Master Active" : "Requires Setup",
      badgeVariant: stats?.hasMasterResume ? "emerald" : "amber",
      statLabel: stats ? `${stats.hasMasterResume ? "1 Master Resume" : "No Master Resume"}` : "Typst Compiler Ready",
      primaryText: "Open Editor",
    },
    {
      title: "Verified Evidence Bank",
      description: "Central repository of career achievements, verified bullets, skills, and one-click JSON import.",
      href: "/library",
      icon: Database,
      badge: stats ? `${stats.verifiedEvidenceCount} Verified` : "Evidence Bank",
      badgeVariant: "emerald",
      statLabel: stats ? `${stats.evidenceCount} Total Items` : "Single-Resume Vault",
      primaryText: "Manage Evidence",
    },
    {
      title: "Tailor Engine & AI Gateway",
      description: "Parse Job Descriptions, generate evidence-grounded AI patches, and inspect 100-point ATS scores.",
      href: "/tailor",
      icon: Sparkles,
      badge: "BYOK AI",
      badgeVariant: "indigo",
      statLabel: stats ? `${stats.variantsCount} Variants Generated` : "Zero Hallucination",
      primaryText: "Tailor Resume",
    },
    {
      title: "Job Application Tracker",
      description: "Full lifecycle Kanban & list workspace tracking job status, applied dates, and interview notes.",
      href: "/tracker",
      icon: Briefcase,
      badge: stats ? `${stats.appliedJobsCount} Applied` : "Pipeline",
      badgeVariant: "sky",
      statLabel: stats ? `${stats.jobsCount} Total Tracked` : "Kanban Board",
      primaryText: "Open Tracker",
    },
    {
      title: "AI Security & Key Vault",
      description: "Configure local BYOK credentials (OpenAI, Anthropic, Gemini) with client-side scrubbing & zero key leaks.",
      href: "/settings",
      icon: Settings,
      badge: "Local-First",
      badgeVariant: "purple",
      statLabel: "Zero-Leak Redaction",
      primaryText: "Configure Keys",
    },
  ];

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100 flex flex-col relative overflow-hidden font-sans">
      {/* Subtle glowing ambient background gradient */}
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-tr from-indigo-600/15 via-sky-500/10 to-transparent blur-3xl pointer-events-none rounded-full" />
      <div className="absolute top-1/2 -right-40 w-[500px] h-[500px] bg-gradient-to-b from-indigo-900/10 to-transparent blur-3xl pointer-events-none rounded-full" />

      {/* Navigation Header */}
      <header className="h-14 border-b border-slate-800/80 bg-slate-900/80 backdrop-blur-md sticky top-0 z-50 flex items-center px-4 md:px-8 justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 font-bold text-white shadow-md shadow-indigo-600/30 group-hover:bg-indigo-500 transition-colors">
            R
          </div>
          <span className="font-semibold tracking-tight text-white text-base">
            Resume<span className="text-indigo-400">Forge</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
          <Link
            href="/editor"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors"
          >
            <FileText className="h-4 w-4 text-indigo-400" />
            Editor
          </Link>
          <Link
            href="/library"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors"
          >
            <Database className="h-4 w-4 text-emerald-400" />
            Evidence
          </Link>
          <Link
            href="/tailor"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors"
          >
            <Sparkles className="h-4 w-4 text-sky-400" />
            Tailor Engine
          </Link>
          <Link
            href="/tracker"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors"
          >
            <Briefcase className="h-4 w-4 text-amber-400" />
            Tracker
          </Link>
          <Link
            href="/settings"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors"
          >
            <Settings className="h-4 w-4 text-purple-400" />
            Settings
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <Link href="/editor">
            <Button size="sm" className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium gap-1.5 shadow-sm">
              <Zap className="h-3.5 w-3.5" />
              Launch Workspace
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 md:px-8 py-8 md:py-12 flex flex-col gap-10">
        {/* Hero Banner Section */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center flex flex-col items-center gap-4 max-w-3xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-mono font-medium">
            <ShieldCheck className="h-3.5 w-3.5 text-indigo-400" />
            Local-First • Evidence-Grounded • Zero-Hallucination AI
          </div>

          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white leading-tight">
            One Protected Master Resume. <br />
            <span className="bg-gradient-to-r from-indigo-400 via-sky-300 to-indigo-200 bg-clip-text text-transparent">
              Infinite Tailored Variants.
            </span>
          </h1>

          <p className="text-slate-400 text-sm md:text-base max-w-2xl leading-relaxed">
            ResumeForge is a local-first AI workspace. Maintain a single source of truth in your Evidence Bank, tailor job-specific variants using WASM Typst compilation, and track applications across their full lifecycle.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link href="/editor">
              <Button size="lg" className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold gap-2 shadow-lg shadow-indigo-600/25">
                <FileText className="h-4 w-4" />
                Open Typst Editor
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/library">
              <Button size="lg" variant="outline" className="border-slate-700 bg-slate-900/60 hover:bg-slate-800 text-slate-200 gap-2">
                <Upload className="h-4 w-4 text-emerald-400" />
                Import Evidence
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* Live Real Stats Bar */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm shadow-sm"
        >
          <div className="flex flex-col gap-1 p-2">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider font-mono">Master Resume</span>
            <div className="flex items-center gap-2">
              {loading ? (
                <div className="h-5 w-24 bg-slate-800 animate-pulse rounded" />
              ) : stats?.hasMasterResume ? (
                <span className="text-sm font-semibold text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Active
                </span>
              ) : (
                <span className="text-sm font-semibold text-amber-400 flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4 text-amber-400" /> Not Set Up
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1 p-2 border-l border-slate-800">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider font-mono">Verified Bullets</span>
            <div className="text-base font-bold text-white font-mono">
              {loading ? <div className="h-5 w-12 bg-slate-800 animate-pulse rounded" /> : (stats?.verifiedEvidenceCount ?? 0)}
            </div>
          </div>

          <div className="flex flex-col gap-1 p-2 border-l border-slate-800">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider font-mono">Tailored Variants</span>
            <div className="text-base font-bold text-white font-mono">
              {loading ? <div className="h-5 w-12 bg-slate-800 animate-pulse rounded" /> : (stats?.variantsCount ?? 0)}
            </div>
          </div>

          <div className="flex flex-col gap-1 p-2 border-l border-slate-800">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider font-mono">Jobs Tracked</span>
            <div className="text-base font-bold text-white font-mono">
              {loading ? <div className="h-5 w-12 bg-slate-800 animate-pulse rounded" /> : (stats?.jobsCount ?? 0)}
            </div>
          </div>
        </motion.div>

        {/* Workspaces Grid */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
              <Zap className="h-4 w-4 text-indigo-400" />
              Workspace Modules
            </h2>
            <span className="text-xs font-mono text-slate-500">ResumeForge Core Engine</span>
          </div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {workspaces.map((ws) => {
              const Icon = ws.icon;
              return (
                <motion.div key={ws.href} variants={itemVariants}>
                  <Link href={ws.href} className="group block h-full">
                    <div className="h-full p-5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-900 transition-all duration-200 flex flex-col justify-between gap-4 shadow-sm group-hover:shadow-indigo-500/5">
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-800 text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                            <Icon className="h-5 w-5" />
                          </div>
                          <span
                            className={`text-[11px] font-mono font-medium px-2 py-0.5 rounded-full border ${
                              ws.badgeVariant === "emerald"
                                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                                : ws.badgeVariant === "amber"
                                ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                                : ws.badgeVariant === "sky"
                                ? "bg-sky-500/10 border-sky-500/30 text-sky-400"
                                : ws.badgeVariant === "purple"
                                ? "bg-purple-500/10 border-purple-500/30 text-purple-400"
                                : "bg-indigo-500/10 border-indigo-500/30 text-indigo-400"
                            }`}
                          >
                            {ws.badge}
                          </span>
                        </div>

                        <div>
                          <h3 className="font-semibold text-base text-white group-hover:text-indigo-300 transition-colors">
                            {ws.title}
                          </h3>
                          <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                            {ws.description}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 text-xs">
                        <span className="text-slate-500 font-mono">{ws.statLabel}</span>
                        <span className="font-medium text-indigo-400 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                          {ws.primaryText}
                          <ArrowRight className="h-3.5 w-3.5" />
                        </span>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-6 text-center text-xs text-slate-500">
        <p>ResumeForge Local-First AI Engine • Confidential & Local Storage Only</p>
      </footer>
    </div>
  );
}
