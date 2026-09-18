import React from "react";
import Link from "next/link";
import { ShieldAlert, ArrowLeft, Home, FileCode, Sparkles } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background Amber Radial Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6 text-center relative z-10 backdrop-blur-md">
        {/* Brand Icon Badge */}
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-amber-950/50 border border-amber-500/40 text-amber-400 shadow-inner mx-auto">
          <ShieldAlert className="h-8 w-8" />
        </div>

        <div className="space-y-2">
          <span className="inline-block text-[11px] font-mono font-bold uppercase tracking-wider text-amber-400 bg-amber-950/60 border border-amber-800/80 px-3 py-1 rounded-full">
            404 — Page Not Found
          </span>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Document Node Missing
          </h1>
          <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
            The workspace route or document node you requested doesn&apos;t exist or may have been relocated in the file tree.
          </p>
        </div>

        {/* Quick Action Navigation Grid */}
        <div className="pt-2 flex flex-col gap-2.5">
          <Link
            href="/"
            className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition"
          >
            <Home className="h-4 w-4" />
            Return to Dashboard
          </Link>

          <Link
            href="/editor"
            className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl flex items-center justify-center gap-2 border border-slate-700 transition"
          >
            <FileCode className="h-4 w-4 text-amber-400" />
            Open Resume Editor
          </Link>
        </div>

        <div className="border-t border-slate-800/80 pt-4 flex items-center justify-center gap-1.5 text-[11px] text-slate-500 font-mono">
          <Sparkles className="h-3.5 w-3.5 text-amber-500/60" />
          <span>ResumeForge Local-First Engine</span>
        </div>
      </div>
    </div>
  );
}
