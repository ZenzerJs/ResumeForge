import React from "react";
import Link from "next/link";
import { FileText, ArrowRight } from "lucide-react";

export function LandingFooter() {
  return (
    <footer
      data-testid="landing-footer"
      className="relative z-20 mt-auto w-full min-w-0 shrink-0 border-t border-slate-800/80 bg-slate-950 py-10 px-4 md:px-8 text-slate-400"
    >
      <div className="mx-auto flex w-full max-w-5xl min-w-0 flex-col items-center gap-6 text-center sm:items-start sm:text-left">
        <div className="space-y-1">
          <div className="flex items-center justify-center sm:justify-start gap-2">
            <div className="h-6 w-6 rounded-lg bg-amber-950 border border-amber-500/40 text-amber-400 font-bold font-mono flex items-center justify-center text-xs">
              RF
            </div>
            <span className="text-white font-bold tracking-tight text-sm">ResumeForge</span>
          </div>
          <p className="text-xs text-slate-500 font-mono">
            Guest-ready workspace · WASM Typst · BYOK in this browser
          </p>
        </div>

        <nav
          aria-label="Footer"
          className="flex w-full min-w-0 flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-2 text-xs font-medium"
        >
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
          <Link href="/privacy" className="hover:text-slate-200 transition-colors">
            Privacy Policy
          </Link>
        </nav>

        <Link
          href="/editor"
          className="flex min-h-11 items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-white text-slate-950 hover:bg-slate-100 transition-all shadow-md"
        >
          <FileText className="h-3.5 w-3.5" />
          Launch Workspace
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </footer>
  );
}
