import React from "react";
import { Loader2, Sparkles } from "lucide-react";

export default function Loading() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Amber Ambient Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-3xl pointer-events-none animate-pulse" />

      <div className="w-full max-w-sm bg-slate-900/80 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-5 text-center relative z-10 backdrop-blur-md">
        {/* Brand Pulse Mark */}
        <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-amber-950/60 border border-amber-500/40 text-amber-400 shadow-inner mx-auto relative">
          <Loader2 className="h-7 w-7 animate-spin text-amber-400" />
        </div>

        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-white tracking-wide">
            Loading Workspace Route…
          </h2>
          <p className="text-xs text-slate-400">
            Initializing local state and compiling WASM document assets
          </p>
        </div>

        {/* Skeleton pulse bar */}
        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-amber-500 to-amber-300 w-1/2 rounded-full animate-pulse" />
        </div>

        <div className="pt-2 flex items-center justify-center gap-1.5 text-[11px] text-slate-500 font-mono">
          <Sparkles className="h-3.5 w-3.5 text-amber-500/70 animate-bounce" />
          <span>ResumeForge Engine</span>
        </div>
      </div>
    </div>
  );
}
