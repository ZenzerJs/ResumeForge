"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { TopNav } from "@/components/navigation/top-nav";
import { GuestMigrationModal } from "@/components/auth/guest-migration-modal";
import { fetchSessionPayload } from "@/components/auth/session-user";
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
    void fetch("/api/demo-config")
      .then((res) => res.json())
      .then((config) => { if (!cancelled) setDemoMode(config?.demoMode === true); })
      .catch(() => {});
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
        className="inline-flex items-center gap-1.5 rounded border border-outline/70 bg-elevated px-2 py-0.5 text-[11px] font-medium text-text-secondary whitespace-nowrap"
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

  useEffect(() => {
    if (typeof window === "undefined") return;

    void fetch("/api/demo-config")
      .then((res) => res.json())
      .then((config) => {
        if (config?.demoMode !== true) return;
        initializeDemoSamples();
      })
      .catch(() => {});

    const isDismissed = localStorage.getItem("resumeforge_migration_dismissed") === "true";
    const isMigrated = localStorage.getItem("resumeforge_draft_migrated") === "true";
    if (isDismissed || isMigrated) return;

    fetchSessionPayload()
      .then(async (json) => {
        const demoConfig = await (await fetch("/api/demo-config")).json().catch(() => ({}));
        if (demoConfig?.demoMode) return;
        const isAuthUser = json?.data && !json.guest;
        if (isAuthUser) {
          const hasGuestDraft = localStorage.getItem("resumeforge_has_guest_draft") === "true";
          const stored = localStorage.getItem("resumeforge_typst_source");
          const storedEvidenceRaw = localStorage.getItem("resumeforge_guest_evidence");
          let hasGuestEvidence = false;
          try {
            const parsedEvidence = storedEvidenceRaw ? JSON.parse(storedEvidenceRaw) : [];
            hasGuestEvidence = Array.isArray(parsedEvidence) && parsedEvidence.length > 0;
          } catch {
            hasGuestEvidence = false;
          }

          const hasCustomResumeDraft =
            hasGuestDraft &&
            Boolean(stored) &&
            stored!.trim().length > 30 &&
            !stored!.includes("// Starter Typst Resume");

          if (hasCustomResumeDraft || hasGuestEvidence) {
            try {
              const res = await fetch("/api/resumes");
              const resJson = await res.json();
              if (
                hasCustomResumeDraft &&
                !hasGuestEvidence &&
                resJson.success &&
                Array.isArray(resJson.data)
              ) {
                const alreadyExists = resJson.data.some(
                  (r: { typstSource: string }) => r.typstSource?.trim() === stored!.trim()
                );
                if (alreadyExists) {
                  localStorage.removeItem("resumeforge_has_guest_draft");
                  localStorage.setItem("resumeforge_draft_migrated", "true");
                  return;
                }
              }
            } catch {
              // ignore
            }
            setGuestDraft(
              stored && stored.trim().length > 0
                ? stored
                : `// Imported Guest Workspace\n= Resume Draft\n`
            );
            setShowMigrationModal(true);
          }
        } else if (json?.guest) {
          const stored = localStorage.getItem("resumeforge_typst_source");
          if (
            stored &&
            stored.trim().length > 30 &&
            !stored.includes("// Starter Typst Resume")
          ) {
            localStorage.setItem("resumeforge_has_guest_draft", "true");
          }
        }
      })
      .catch(() => {
        // ignore
      });
  }, []);

  return (
    <div
      className={cn(
        "relative flex flex-col bg-rf-bg text-rf-body",
        lockViewport ? "h-dvh max-h-dvh overflow-hidden" : "min-h-screen overflow-x-hidden"
      )}
      data-workspace-theme={variant === "landing" ? undefined : ""}
      data-testid={`app-shell-${variant}`}
    >
      {!hideNav ? (
        <TopNav
          compact={variant === "editor"}
          badge={useToolbar ? undefined : badge}
          actions={useToolbar ? undefined : actions}
        />
      ) : null}
      <main
        id="main-content"
        className={cn(
          "relative flex min-h-0 flex-1 flex-col",
          !hideNav &&
            (variant === "editor"
              ? "pt-[calc(3rem+env(safe-area-inset-top))]"
              : "pt-[calc(4rem+env(safe-area-inset-top))]"),
          lockViewport ? "overflow-hidden" : "overflow-y-auto",
          className
        )}
      >
        {!hideNav && !(variant === "editor" && useToolbar) ? <GuestBanner /> : null}
        {!hideNav && useToolbar ? (
          <div
            className="relative z-40 flex min-h-10 shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-b border-outline/70 bg-panel px-4 py-1 lg:h-10 lg:flex-nowrap lg:px-6"
            data-testid="workspace-toolbar"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              {badge}
              <GuestBanner inline />
            </div>
            <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">{actions}</div>
          </div>
        ) : null}
        {children}
      </main>

      {showMigrationModal && guestDraft && (
        <GuestMigrationModal
          isOpen={showMigrationModal}
          onClose={() => setShowMigrationModal(false)}
          draftSource={guestDraft}
          onSuccess={() => setShowMigrationModal(false)}
        />
      )}
    </div>
  );
}
