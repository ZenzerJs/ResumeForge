import React from "react";
import Link from "next/link";
import { ShieldAlert, Home, FileCode } from "lucide-react";
import { WorkspaceAtmosphere } from "@/components/design-system/workspace-atmosphere";

export default function NotFound() {
  return (
    <div className="relative min-h-dvh bg-canvas text-foreground flex flex-col">
      <WorkspaceAtmosphere variant="quiet" />
      <main
        id="main-content"
        tabIndex={-1}
        className="relative z-10 flex flex-1 flex-col items-center justify-center p-6 outline-none"
      >
        <div className="w-full max-w-md surface-raised edge-glow rounded-[10px] p-8 space-y-6 text-center">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-[8px] bg-primary/10 border border-primary/30 text-primary mx-auto">
            <ShieldAlert className="h-6 w-6" aria-hidden />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-mono font-semibold text-primary">
              404 — Page Not Found
            </p>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">
              Page not found
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
              The workspace route or document you requested doesn&apos;t exist or may have moved.
            </p>
          </div>

          <div className="pt-2 flex flex-col gap-2.5">
            <Link
              href="/"
              className="w-full min-h-11 py-2.5 px-4 bg-primary hover:opacity-95 text-primary-foreground font-semibold text-xs rounded-[6px] flex items-center justify-center gap-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
            >
              <Home className="h-4 w-4" aria-hidden />
              Back to home
            </Link>

            <Link
              href="/editor"
              className="w-full min-h-11 py-2.5 px-4 bg-elevated hover:bg-muted text-foreground font-semibold text-xs rounded-[6px] flex items-center justify-center gap-2 border border-outline/70 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
            >
              <FileCode className="h-4 w-4 text-primary" aria-hidden />
              Open Resume Editor
            </Link>
          </div>

          <div className="border-t border-outline/70 pt-4 text-xs text-muted-foreground font-mono">
            ResumeForge Workspace
          </div>
        </div>
      </main>
    </div>
  );
}
