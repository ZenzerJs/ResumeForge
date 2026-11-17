import React from "react";
import Link from "next/link";
import { FileText, ArrowRight } from "lucide-react";

export function LandingFooter() {
  return (
    <footer
      data-testid="landing-footer"
      className="relative z-20 mt-auto w-full min-w-0 shrink-0 border-t border-outline/70 bg-panel py-10 px-4 md:px-8 text-muted-foreground"
    >
      <div className="mx-auto flex w-full max-w-5xl min-w-0 flex-col items-center gap-6 text-center sm:items-start sm:text-left">
        <div className="flex items-center justify-center sm:justify-start gap-2">
          <div className="h-6 w-6 rounded-[6px] bg-inset border border-primary/40 text-primary font-semibold font-mono flex items-center justify-center text-xs">
            RF
          </div>
          <span className="text-foreground font-bold tracking-tight text-sm">ResumeForge</span>
        </div>

        <nav
          aria-label="Footer"
          className="flex w-full min-w-0 flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-2 text-xs font-semibold"
        >
          <Link href="/editor" className="hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-[4px]">
            Editor
          </Link>
          <Link href="/tailor" className="hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-[4px]">
            Tailor Engine
          </Link>
          <Link href="/tracker" className="hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-[4px]">
            Tracker
          </Link>
          <Link href="/library" className="hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-[4px]">
            Evidence Bank
          </Link>
          <Link href="/settings" className="hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-[4px]">
            BYOK Settings
          </Link>
          <Link href="/privacy" className="hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-[4px]">
            Privacy Policy
          </Link>
        </nav>

        <Link
          href="/editor"
          className="inline-flex min-h-11 items-center gap-1.5 px-4 py-2 rounded-[6px] text-xs font-bold bg-primary text-primary-foreground hover:opacity-95 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
        >
          <FileText className="h-3.5 w-3.5" aria-hidden />
          Launch Workspace
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
    </footer>
  );
}
