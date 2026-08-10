"use client";

import React from "react";
import { TopNav } from "@/components/navigation/top-nav";
import { cn } from "@/lib/utils";
import { AmbientBackground, type AtmosphereVariant } from "./ambient-background";

interface AppShellProps {
  children: React.ReactNode;
  variant?: AtmosphereVariant;
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
  isCompiling = false,
  className = "",
  badge,
  actions,
  hideNav = false,
}: AppShellProps) {
  return (
    <div
      className="relative flex min-h-screen flex-col overflow-hidden bg-rf-bg text-rf-body"
      data-testid={`app-shell-${variant}`}
    >
      <AmbientBackground variant={variant} isCompiling={isCompiling} />

      {!hideNav ? <TopNav badge={badge} actions={actions} /> : null}

      <div className={cn("relative z-10 flex min-h-0 flex-1 flex-col", className)}>
        {children}
      </div>
    </div>
  );
}
