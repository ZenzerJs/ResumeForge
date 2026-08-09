"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { AlertOctagon, RefreshCw, Home, Sparkles } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to client console for diagnostics
    console.error("Client Error Boundary Caught:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background Red/Amber Radial Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-red-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6 text-center relative z-10 backdrop-blur-md">
        {/* Error Icon Badge */}
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-red-950/60 border border-red-800/80 text-red-400 shadow-inner mx-auto">
          <AlertOctagon className="h-8 w-8" />
        </div>

        <div className="space-y-2">
          <span className="inline-block text-[11px] font-mono font-bold uppercase tracking-wider text-red-400 bg-red-950/60 border border-red-800/80 px-3 py-1 rounded-full">
            Application Error Boundary
          </span>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Something Went Wrong
          </h1>
          <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
            An unhandled runtime error occurred while rendering this workspace view.
          </p>
        </div>

        {/* Error Message Details Card */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-left space-y-1 font-mono text-xs">
          <span className="text-[10px] text-slate-500 uppercase font-semibold block">
            Error Details:
          </span>
          <p className="text-red-300 break-words text-[11px]">
            {error.message || "An unexpected application error occurred."}
          </p>
          {error.digest && (
            <span className="text-[10px] text-slate-600 block mt-1">
              Digest: {error.digest}
            </span>
          )}
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => reset()}
            className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </button>

          <Link
            href="/"
            className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl flex items-center justify-center gap-2 border border-slate-700 transition"
          >
            <Home className="h-4 w-4 text-slate-400" />
            Return to Home
          </Link>
        </div>

        <div className="border-t border-slate-800/80 pt-4 flex items-center justify-center gap-1.5 text-[11px] text-slate-500 font-mono">
          <Sparkles className="h-3.5 w-3.5 text-amber-500/60" />
          <span>ResumeForge Client Resilience</span>
        </div>
      </div>
    </div>
  );
}
