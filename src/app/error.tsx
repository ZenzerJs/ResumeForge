"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { AlertOctagon, RefreshCw, Home } from "lucide-react";

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
    <div className="min-h-screen bg-canvas text-foreground flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md bg-panel border border-outline/70 rounded-[10px] p-8 shadow-lg space-y-6 text-center">
        <div className="inline-flex items-center justify-center h-12 w-12 rounded-[8px] bg-status-danger/10 border border-status-danger/40 text-status-danger mx-auto">
          <AlertOctagon className="h-6 w-6" aria-hidden />
        </div>

        <div className="space-y-2">
          <p className="text-xs font-mono font-semibold text-status-danger">
            Application Error
          </p>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Something Went Wrong
          </h1>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-sm mx-auto">
            An unhandled runtime error occurred while rendering this workspace view.
          </p>
        </div>

        <div className="bg-inset border border-outline/70 rounded-[6px] p-3.5 text-left space-y-1 font-mono text-xs">
          <span className="text-xs text-muted-foreground uppercase font-semibold block">
            Error Details
          </span>
          <p className="text-status-danger break-words text-xs">
            {error.message || "An unexpected application error occurred."}
          </p>
          {error.digest && (
            <span className="text-xs text-muted-foreground block mt-1 tabular-nums">
              Digest: {error.digest}
            </span>
          )}
        </div>

        <div className="pt-2 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => reset()}
            className="w-full min-h-11 py-2.5 px-4 bg-primary hover:opacity-95 text-primary-foreground font-semibold text-xs rounded-[6px] flex items-center justify-center gap-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            Try Again
          </button>

          <Link
            href="/"
            className="w-full min-h-11 py-2.5 px-4 bg-elevated hover:bg-muted text-foreground font-semibold text-xs rounded-[6px] flex items-center justify-center gap-2 border border-outline/70 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
          >
            <Home className="h-4 w-4 text-muted-foreground" aria-hidden />
            Return to Home
          </Link>
        </div>

        <div className="border-t border-outline/70 pt-4 text-xs text-muted-foreground font-mono">
          ResumeForge Workspace
        </div>
      </div>
    </div>
  );
}
