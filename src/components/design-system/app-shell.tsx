"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { TopNav } from "@/components/navigation/top-nav";
import { WorkspaceAtmosphere } from "@/components/design-system/workspace-atmosphere";
import {
  evaluateGuestMigrationState,
  GuestMigrationModal,
} from "@/components/auth/guest-migration-modal";
import { fetchDemoConfig, fetchSessionPayload } from "@/components/auth/session-user";
import { cn } from "@/lib/utils";
import { initializeDemoSamples } from "@/lib/demo-client";

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
  /** Page layouts scroll with the document; workspaces manage their own panes. */
  layout?: "page" | "workspace";
  /** @deprecated Unused — ambient glow removed for performance. */
  isCompiling?: boolean;
  className?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  /** Hide shared top navigation (rare). */
  hideNav?: boolean;
}

function GuestBanner({ inline = false }: { inline?: boolean }) {
  const [guest, setGuest] = useState(false);
  const [demoMode, setDemoMode] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchDemoConfig().then((config) => {
      if (!cancelled) setDemoMode(config.demoMode === true);
    });
    void fetchSessionPayload().then((json) => {
      if (!cancelled) setGuest(Boolean(json?.guest) || !json?.data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!guest) return null;

  if (inline) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded border border-outline/70 bg-elevated px-2 py-0.5 text-xs font-medium text-text-secondary whitespace-nowrap"
        data-testid="guest-banner"
      >
        {demoMode ? (
          <span>Demo (browser draft · BYOK)</span>
        ) : (
          <>
            <span>Guest draft</span>
            <span aria-hidden="true">·</span>
            <Link
              href="/login"
              className="font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
            >
              Sign in
            </Link>
          </>
        )}
      </span>
    );
  }

  return (
    <div
      className="border-b border-outline/70 bg-panel px-4 py-2 text-center text-sm text-text-secondary"
      data-testid="guest-banner"
    >
      {demoMode
        ? "Public demo: samples are fictional, your drafts stay in this browser, and AI uses your BYOK key. Public signup is disabled."
        : <>You’re using a guest session. Work stays in this browser until you{" "}<Link href="/login" className="font-semibold text-primary underline-offset-2 hover:underline">sign in</Link>{" "}to save.</>}
    </div>
  );
}

export function AppShell({
  children,
  variant = "quiet",
  layout,
  className = "",
  badge,
  actions,
  hideNav = false,
}: AppShellProps) {
  const lockViewport = layout ? layout === "workspace" : variant === "editor" || variant === "tracker";
  /** Editor actions are too wide for the global header; give them their own bar. */
  const useToolbar = variant === "editor" && Boolean(actions || badge);

  const [showMigrationModal, setShowMigrationModal] = useState(false);
  const [guestDraft, setGuestDraft] = useState<string | null>(null);
  const [hasExistingMaster, setHasExistingMaster] = useState<boolean>(true);
  const [isDesktopLg, setIsDesktopLg] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    setIsDesktopLg(mediaQuery.matches);
    const listener = (event: MediaQueryListEvent) => setIsDesktopLg(event.matches);
    mediaQuery.addEventListener("change", listener);
    return () => mediaQuery.removeEventListener("change", listener);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;

    const demoPromise = fetchDemoConfig().then((config) => {
      if (!cancelled && config.demoMode === true) {
        initializeDemoSamples();
      }
      return config;
    });

    const checkGuestMigration = () => {
      Promise.all([fetchSessionPayload(), demoPromise])
        .then(async ([json, demoConfig]) => {
          if (cancelled) return;
          const isAuthUser = Boolean(json?.data && !json.guest);
          const isGuest = Boolean(json?.guest);
          const evaluation = evaluateGuestMigrationState(localStorage, {
            isAuthUser,
            isGuest,
            demoMode: Boolean(demoConfig.demoMode),
          });
          if (!evaluation.shouldPrompt || !evaluation.draftSource) return;

          let existingMaster = false;
          try {
            const res = await fetch("/api/resumes");
            const resJson = await res.json();
            if (cancelled) return;
            if (resJson.success && Array.isArray(resJson.data)) {
              existingMaster = resJson.data.some((r: { isMaster?: boolean }) => Boolean(r.isMaster));
              const stored = localStorage.getItem("resumeforge_typst_source");
              if (evaluation.hasCustomResumeDraft && !evaluation.hasGuestEvidence && stored) {
                const alreadyExists = resJson.data.some(
                  (r: { typstSource: string }) => r.typstSource?.trim() === stored.trim()
                );
                if (alreadyExists) {
                  localStorage.removeItem("resumeforge_has_guest_draft");
                  localStorage.setItem("resumeforge_draft_migrated", "true");
                  return;
                }
              }
            }
          } catch {
            // Keep modal usable even if /api/resumes check fails
            existingMaster = true;
          }

          if (cancelled) return;
          setHasExistingMaster(existingMaster);
          setGuestDraft(evaluation.draftSource);
          setShowMigrationModal(true);
        })
        .catch(() => {
          // ignore
        });
    };

    checkGuestMigration();
    window.addEventListener("resumeforge:session-updated", checkGuestMigration);
    return () => {
      cancelled = true;
      window.removeEventListener("resumeforge:session-updated", checkGuestMigration);
    };
  }, []);

  const showCompactActionsRow = !hideNav && !useToolbar && Boolean(actions) && !isDesktopLg;

  return (
    <div
      className={cn(
        "relative flex flex-col bg-rf-bg text-rf-body",
        lockViewport ? "h-dvh max-h-dvh overflow-hidden" : "min-h-dvh overflow-x-hidden"
      )}
      data-workspace-theme={variant === "landing" ? undefined : ""}
      data-testid={`app-shell-${variant}`}
    >
      {variant !== "landing" && variant !== "editor" ? (
        <WorkspaceAtmosphere variant={variant} />
      ) : null}
      {!hideNav ? (
        <TopNav
          compact={variant === "editor"}
          badge={useToolbar ? undefined : badge}
          actions={!useToolbar && isDesktopLg ? actions : undefined}
        />
      ) : null}
      <main
        id="main-content"
        className={cn(
          "relative z-10 flex min-h-0 flex-1 flex-col",
          !hideNav &&
            (variant === "editor"
              ? "pt-[calc(3rem+env(safe-area-inset-top))]"
              : "pt-[calc(4rem+env(safe-area-inset-top))]"),
          lockViewport ? "overflow-hidden" : "overflow-y-auto",
          className
        )}
      >
        {showCompactActionsRow ? (
          <div
            className="lg:hidden relative z-30 flex min-w-0 max-w-full shrink-0 flex-wrap items-center justify-start gap-2 border-b border-outline/70 glass-bar px-4 py-2 sm:justify-end"
            data-testid="compact-page-actions"
          >
            {actions}
          </div>
        ) : null}
        {!hideNav && !(variant === "editor" && useToolbar) ? <GuestBanner /> : null}
        {!hideNav && useToolbar ? (
          <div
            className="relative z-40 flex min-h-10 shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-b border-outline/70 glass-bar px-4 py-1 xl:h-10 xl:flex-nowrap xl:px-6"
            data-testid="workspace-toolbar"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              {badge}
              <GuestBanner inline />
            </div>
            <div className="flex min-w-0 max-w-full flex-wrap items-center justify-start gap-2 xl:justify-end">{actions}</div>
          </div>
        ) : null}
        {children}
      </main>

      {showMigrationModal && guestDraft && (
        <GuestMigrationModal
          isOpen={showMigrationModal}
          onClose={() => setShowMigrationModal(false)}
          draftSource={guestDraft}
          hasExistingMaster={hasExistingMaster}
          onSuccess={() => setShowMigrationModal(false)}
        />
      )}
    </div>
  );
}
