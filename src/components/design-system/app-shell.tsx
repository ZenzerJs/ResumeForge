"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
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

function GuestBanner() {
  const [guest, setGuest] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/auth/me")
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled) setGuest(Boolean(json?.guest) || !json?.data);
      })
      .catch(() => {
        if (!cancelled) setGuest(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!guest) return null;

  return (
    <div
      className="border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-center text-sm text-amber-100"
      data-testid="guest-banner"
    >
      You’re using a guest session. Work stays in this browser until you{" "}
      <Link href="/login" className="font-semibold text-amber-300 underline-offset-2 hover:underline">
        sign in
      </Link>{" "}
      to save.
    </div>
  );
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

      <main
        id="main-content"
        className={cn(
          "relative flex min-h-0 flex-1 flex-col",
          !hideNav && "pt-[calc(4rem+env(safe-area-inset-top))]",
          variant === "editor" ? "overflow-hidden" : "overflow-y-auto",
          className
        )}
      >
        {!hideNav ? <GuestBanner /> : null}
        {children}
      </main>
    </div>
  );
}
