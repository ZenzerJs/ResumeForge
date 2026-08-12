"use client";

import React from "react";
import { TopNav } from "@/components/navigation/top-nav";
import { cn } from "@/lib/utils";

/** Kept for layout/testid affinity; no longer drives decorative atmosphere. */
export type AtmosphereVariant =
  | "landing"
  | "editor"
  | "tracker"
  | "tailor"
  | "library"
  | "discover"
  | "settings"
  | "quiet";

interface AppShellProps {
  children: React.ReactNode;
  variant?: AtmosphereVariant;
  /** @deprecated Unused — ambient glow removed for performance. */
  isCompiling?: boolean;
  className?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  /** Hide shared top navigation (rare). */
  hideNav?: boolean;
}

export function AppShell({
  children,
  variant = "quiet",
  className = "",
  badge,
  actions,
  hideNav = false,
}: AppShellProps) {
  return (
    <div
      className={cn(
        "relative flex flex-col overflow-hidden bg-rf-bg text-rf-body",
        variant === "editor" ? "h-screen max-h-screen" : "min-h-screen"
      )}
      data-testid={`app-shell-${variant}`}
    >
      {!hideNav ? <TopNav badge={badge} actions={actions} /> : null}

      <div className={cn("relative z-10 flex min-h-0 flex-1 flex-col", !hideNav && "pt-16", className)}>
        {children}
      </div>
    </div>
  );
}
