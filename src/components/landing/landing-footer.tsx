import React from "react";
import Link from "next/link";
import { Sparkles, ShieldCheck, FileText, ArrowRight } from "lucide-react";

export function LandingFooter() {
  return (
    <footer className="w-full border-t border-slate-800/80 bg-slate-950/90 py-10 px-4 md:px-8 text-slate-400">
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        {/* Brand & Mission Statement */}
        <div className="space-y-1 text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-2">
            <div className="h-6 w-6 rounded-lg bg-amber-950 border border-amber-500/40 text-amber-400 font-bold font-mono flex items-center justify-center text-xs">
              RF
            </div>
            <span className="text-white font-bold tracking-tight text-sm">ResumeForge</span>
          </div>
          <p className="text-xs text-slate-500 font-mono">
            Local-First · WASM Typst Engine · Confidential Storage
          </p>
        </div>

        {/* Action Links */}
        <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-medium">
          <Link href="/editor" className="hover:text-amber-400 transition-colors">
            Editor
          </Link>
          <Link href="/tailor" className="hover:text-purple-400 transition-colors">
            Tailor Engine
          </Link>
          <Link href="/tracker" className="hover:text-blue-400 transition-colors">
            Tracker
          </Link>
          <Link href="/library" className="hover:text-emerald-400 transition-colors">
            Evidence Bank
          </Link>
          <Link href="/settings" className="hover:text-cyan-400 transition-colors">
            BYOK Settings
          </Link>
        </div>

        {/* Launch Editor CTA */}
        <Link href="/editor">
          <button
            type="button"
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-white text-slate-950 hover:bg-slate-100 transition-all shadow-md"
          >
            <FileText className="h-3.5 w-3.5" />
            Launch Workspace
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </Link>
      </div>
    </footer>
  );
}
