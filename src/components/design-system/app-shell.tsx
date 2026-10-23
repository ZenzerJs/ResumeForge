"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { TopNav } from "@/components/navigation/top-nav";
import { GuestMigrationModal } from "@/components/auth/guest-migration-modal";
import { fetchSessionPayload } from "@/components/auth/session-user";
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
    void fetchSessionPayload().then((json) => {
      if (!cancelled) setGuest(Boolean(json?.guest) || !json?.data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!guest) return null;

  return (
    <div
      className="border-b border-slate-800 bg-slate-900/80 px-4 py-2 text-center text-sm text-slate-300"
      data-testid="guest-banner"
    >
      You’re using a guest session. Work stays in this browser until you{" "}
      <Link href="/login" className="font-semibold text-amber-400 underline-offset-2 hover:underline">
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
  const lockViewport = variant === "editor" || variant === "tracker";
  /** Editor actions are too wide for the global header; give them their own bar. */
  const useToolbar = variant === "editor" && Boolean(actions || badge);
  const [showMigrationModal, setShowMigrationModal] = useState(false);
  const [guestDraft, setGuestDraft] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const isDismissed = localStorage.getItem("resumeforge_migration_dismissed") === "true";
    const isMigrated = localStorage.getItem("resumeforge_draft_migrated") === "true";
    if (isDismissed || isMigrated) return;

    fetchSessionPayload()
      .then(async (json) => {
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
        "relative flex flex-col bg-rf-bg bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(255,140,0,0.06),transparent)] text-rf-body",
        lockViewport ? "h-dvh max-h-dvh overflow-hidden" : "min-h-screen overflow-x-hidden"
      )}
      data-testid={`app-shell-${variant}`}
    >
      {!hideNav ? (
        <TopNav
          badge={useToolbar ? undefined : badge}
          actions={useToolbar ? undefined : actions}
        />
      ) : null}

      <main
        id="main-content"
        className={cn(
          "relative flex min-h-0 flex-1 flex-col",
          !hideNav && "pt-[calc(4rem+env(safe-area-inset-top))]",
          lockViewport ? "overflow-hidden" : "overflow-y-auto",
          className
        )}
      >
        {!hideNav ? <GuestBanner /> : null}
        {!hideNav && useToolbar ? (
          <div
            className="relative z-40 flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-slate-800/80 bg-rf-bg px-4 py-2 md:px-8"
            data-testid="workspace-toolbar"
          >
            <div className="flex min-w-0 items-center gap-3">{badge}</div>
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
