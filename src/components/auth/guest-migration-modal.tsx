"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CloudUpload, X, CheckCircle2, Loader2, FileText, AlertTriangle, RefreshCw, ShieldAlert } from "lucide-react";

export type ConflictStrategy = "IMPORT_AS_DRAFT" | "REPLACE_MASTER" | "DISCARD";

export interface StorageReadOnlyLike {
  getItem(key: string): string | null;
}

export interface StorageReadWriteLike extends StorageReadOnlyLike {
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function isCustomGuestDraftSource(source: string | null | undefined): boolean {
  if (!source || source.trim().length <= 30) return false;
  if (source.includes("// Starter Typst Resume")) return false;
  if (source.includes("// Synthetic sample. This is not a real person's resume or experience.")) {
    return false;
  }
  if (
    source.includes("alex.morgan@example.com") &&
    source.includes("TechCorp Systems") &&
    source.includes("WebScale Labs")
  ) {
    return false;
  }
  return true;
}

export function hasPendingGuestEvidence(rawEvidence: string | null | undefined): boolean {
  if (!rawEvidence) return false;
  try {
    const parsed: unknown = JSON.parse(rawEvidence);
    return Array.isArray(parsed) && parsed.length > 0;
  } catch {
    return false;
  }
}

export function hasPendingGuestDraftInStorage(storage: StorageReadOnlyLike | null | undefined): boolean {
  if (!storage) return false;
  const hasGuestDraftFlag = storage.getItem("resumeforge_has_guest_draft") === "true";
  const stored = storage.getItem("resumeforge_typst_source");
  const isCustomDraft = isCustomGuestDraftSource(stored);
  const hasEvidence = hasPendingGuestEvidence(storage.getItem("resumeforge_guest_evidence"));

  if (hasGuestDraftFlag && isCustomDraft) return true;
  if (hasEvidence) return true;
  return false;
}

export function evaluateGuestMigrationState(
  storage: StorageReadWriteLike | null | undefined,
  opts: { isAuthUser: boolean; isGuest: boolean; demoMode: boolean }
): {
  shouldPrompt: boolean;
  hasCustomResumeDraft: boolean;
  hasGuestEvidence: boolean;
  draftSource: string | null;
} {
  if (!storage || opts.demoMode) {
    return {
      shouldPrompt: false,
      hasCustomResumeDraft: false,
      hasGuestEvidence: false,
      draftSource: null,
    };
  }

  const stored = storage.getItem("resumeforge_typst_source");
  const isCustomDraft = isCustomGuestDraftSource(stored);
  const hasGuestEvidence = hasPendingGuestEvidence(storage.getItem("resumeforge_guest_evidence"));

  if (opts.isGuest) {
    if (isCustomDraft || hasGuestEvidence) {
      storage.setItem("resumeforge_has_guest_draft", "true");
      storage.removeItem("resumeforge_draft_migrated");
    }
    return {
      shouldPrompt: false,
      hasCustomResumeDraft: isCustomDraft,
      hasGuestEvidence,
      draftSource: null,
    };
  }

  if (!opts.isAuthUser) {
    return {
      shouldPrompt: false,
      hasCustomResumeDraft: false,
      hasGuestEvidence: false,
      draftSource: null,
    };
  }

  const isDismissed = storage.getItem("resumeforge_migration_dismissed") === "true";
  if (isDismissed) {
    return {
      shouldPrompt: false,
      hasCustomResumeDraft: false,
      hasGuestEvidence: false,
      draftSource: null,
    };
  }

  const hasGuestDraftFlag = storage.getItem("resumeforge_has_guest_draft") === "true";
  const hasPendingCustomDraft = hasGuestDraftFlag && isCustomDraft;

  if (hasPendingCustomDraft || hasGuestEvidence) {
    return {
      shouldPrompt: true,
      hasCustomResumeDraft: hasPendingCustomDraft,
      hasGuestEvidence,
      draftSource:
        stored && stored.trim().length > 0 && isCustomDraft
          ? stored
          : "// Imported Guest Workspace\n= Resume Draft\n",
    };
  }

  return {
    shouldPrompt: false,
    hasCustomResumeDraft: false,
    hasGuestEvidence: false,
    draftSource: null,
  };
}

export interface GuestMigrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  draftSource: string;
  hasExistingMaster?: boolean;
  onSuccess?: () => void;
}

export function GuestMigrationModal({
  isOpen,
  onClose,
  draftSource,
  hasExistingMaster = true,
  onSuccess,
}: GuestMigrationModalProps) {
  const [strategy, setStrategy] = useState<ConflictStrategy>("IMPORT_AS_DRAFT");
  const [confirmReplaceMaster, setConfirmReplaceMaster] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [migrationId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      let storedId = localStorage.getItem("resumeforge_migration_id");
      if (!storedId) {
        storedId =
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
        localStorage.setItem("resumeforge_migration_id", storedId);
      }
      return storedId;
    }
    return "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
  });

  const [guestEvidenceItems] = useState<
    Array<{
      title: string;
      organization?: string;
      category?: string;
      tags?: string[];
      bullets?: string[];
    }>
  >(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem("resumeforge_guest_evidence");
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      const isRecord = (v: unknown): v is Record<string, unknown> =>
        typeof v === "object" && v !== null;
      return parsed
        .filter(
          (item): item is Record<string, unknown> & { title: string } =>
            isRecord(item) && typeof item.title === "string" && item.title.trim().length > 0
        )
        .slice(0, 50)
        .map((item) => ({
          title: item.title.trim(),
          organization: typeof item.organization === "string" ? item.organization : undefined,
          category: typeof item.type === "string" ? item.type.toUpperCase() : "PROJECT",
          tags: Array.isArray(item.tags)
            ? item.tags.filter((t): t is string => typeof t === "string")
            : [],
          bullets: Array.isArray(item.bullets)
            ? item.bullets
                .map((b) =>
                  typeof b === "string"
                    ? b
                    : isRecord(b) && typeof b.text === "string"
                      ? b.text
                      : ""
                )
                .filter((t) => t.trim().length > 0)
            : typeof item.verifiedSummary === "string" && item.verifiedSummary.trim()
            ? [item.verifiedSummary.trim()]
            : [],
        }));
    } catch {
      return [];
    }
  });

  if (!isOpen) return null;

  const handleMigrate = async () => {
    if (strategy === "REPLACE_MASTER" && !confirmReplaceMaster) {
      setError("Explicit confirmation is required to replace your active Master Resume.");
      return;
    }

    const lockKey = "resumeforge_migration_lock";

    try {
      setIsMigrating(true);
      setError(null);

      // Cross-tab concurrency lock (15s TTL)
      if (typeof window !== "undefined") {
        const now = Date.now();
        const existingLock = localStorage.getItem(lockKey);
        if (existingLock && now - parseInt(existingLock, 10) < 15000) {
          setError("A migration is already in progress in another tab. Please wait a moment.");
          setIsMigrating(false);
          return;
        }
        localStorage.setItem(lockKey, String(now));
      }

      const res = await fetch("/api/auth/migrate-guest-drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Imported Guest Resume",
          typstSource: draftSource,
          conflictStrategy: strategy,
          confirmReplaceMaster: strategy === "REPLACE_MASTER" ? confirmReplaceMaster : undefined,
          evidenceItems: guestEvidenceItems.length > 0 ? guestEvidenceItems : undefined,
          migrationId,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        // Strict cleanup ONLY after successful 200 response
        if (typeof window !== "undefined") {
          localStorage.removeItem("resumeforge_typst_source");
          localStorage.removeItem("resumeforge_has_guest_draft");
          localStorage.removeItem("resumeforge_guest_evidence");
          localStorage.removeItem("resumeforge_migration_id");
          localStorage.removeItem("resumeforge_migration_dismissed");
          localStorage.removeItem(lockKey);
          localStorage.setItem("resumeforge_draft_migrated", "true");
          window.dispatchEvent(
            new CustomEvent("resumeforge:guest-draft-migrated", { detail: { strategy } })
          );
        }
        onSuccess?.();
        onClose();
      } else {
        setError(json.message || json.error || "Failed to import guest draft to account.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error during draft import.");
    } finally {
      if (typeof window !== "undefined") {
        localStorage.removeItem(lockKey);
      }
      setIsMigrating(false);
    }
  };

  const handleDismiss = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("resumeforge_migration_dismissed", "true");
    }
    onClose();
  };

  const isConfirmDisabled = isMigrating || (strategy === "REPLACE_MASTER" && !confirmReplaceMaster);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleDismiss()}>
      <DialogContent
        data-testid="guest-migration-modal"
        className="max-w-lg bg-elevated border-hairline text-foreground shadow-2xl"
      >
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary">
            <CloudUpload className="size-5 text-primary" />
            <DialogTitle className="text-base font-bold text-foreground">
              Unsaved Guest Draft Detected
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm text-text-secondary">
            We found a resume draft in this browser from your unauthenticated session. Choose how to synchronize it with your account.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5 py-2 text-xs">
          {/* Draft Preview */}
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2 text-text-secondary font-semibold">
              <div className="flex items-center gap-2">
                <FileText className="size-3.5 text-signal" />
                <span>Draft Preview ({draftSource.split("\n").length} lines)</span>
              </div>
              {guestEvidenceItems.length > 0 && (
                <span
                  data-testid="guest-evidence-migration-badge"
                  className="rounded-full bg-status-success/15 border border-status-success/30 px-2 py-0.5 font-mono text-xs text-status-success"
                >
                  +{guestEvidenceItems.length} Evidence Item{guestEvidenceItems.length === 1 ? "" : "s"}
                </span>
              )}
            </div>
            <div className="max-h-28 overflow-y-auto rounded-md border border-hairline bg-inset p-2.5 font-mono text-xs text-text-secondary whitespace-pre-wrap leading-relaxed">
              {draftSource.slice(0, 400)}
              {draftSource.length > 400 ? "\n..." : ""}
            </div>
          </div>

          {/* Conflict Strategy Selector */}
          <div className="space-y-1.5" data-testid="conflict-strategy-selector">
            <span className="text-xs font-semibold text-primary">Select Sync Action:</span>
            <div className="space-y-1.5">
              <label
                className={`flex items-start gap-2.5 p-2.5 rounded-md border cursor-pointer transition-colors ${
                  strategy === "IMPORT_AS_DRAFT"
                    ? "border-primary/80 bg-primary/10"
                    : "border-hairline bg-inset hover:border-control"
                }`}
              >
                <input
                  type="radio"
                  name="conflictStrategy"
                  value="IMPORT_AS_DRAFT"
                  checked={strategy === "IMPORT_AS_DRAFT"}
                  onChange={() => setStrategy("IMPORT_AS_DRAFT")}
                  data-testid="strategy-import-draft"
                  className="mt-0.5 text-primary focus:ring-0"
                />
                <div>
                  <span className="font-semibold text-foreground block text-xs">
                    Import as Draft Resume (Recommended)
                  </span>
                  <span className="text-xs text-text-muted leading-tight block mt-0.5">
                    Saves draft safely without overwriting your existing Master Resume.
                  </span>
                </div>
              </label>

              <label
                className={`flex items-start gap-2.5 p-2.5 rounded-md border cursor-pointer transition-colors ${
                  strategy === "REPLACE_MASTER"
                    ? "border-primary/80 bg-primary/10"
                    : "border-hairline bg-inset hover:border-control"
                }`}
              >
                <input
                  type="radio"
                  name="conflictStrategy"
                  value="REPLACE_MASTER"
                  checked={strategy === "REPLACE_MASTER"}
                  onChange={() => setStrategy("REPLACE_MASTER")}
                  data-testid="strategy-replace-master"
                  className="mt-0.5 text-primary focus:ring-0"
                />
                <div>
                  <span className="font-semibold text-foreground block text-xs">
                    Replace Account Master Resume
                  </span>
                  <span className="text-xs text-text-muted leading-tight block mt-0.5">
                    Replaces your primary Master baseline with this guest draft.
                  </span>
                </div>
              </label>

              <label
                className={`flex items-start gap-2.5 p-2.5 rounded-md border cursor-pointer transition-colors ${
                  strategy === "DISCARD"
                    ? "border-primary/80 bg-primary/10"
                    : "border-hairline bg-inset hover:border-control"
                }`}
              >
                <input
                  type="radio"
                  name="conflictStrategy"
                  value="DISCARD"
                  checked={strategy === "DISCARD"}
                  onChange={() => setStrategy("DISCARD")}
                  data-testid="strategy-discard"
                  className="mt-0.5 text-primary focus:ring-0"
                />
                <div>
                  <span className="font-semibold text-foreground block text-xs">
                    Discard Local Draft
                  </span>
                  <span className="text-xs text-text-muted leading-tight block mt-0.5">
                    Clear this local draft without importing to your account.
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Secondary Confirmation for REPLACE_MASTER */}
          {strategy === "REPLACE_MASTER" && (
            <div
              data-testid="replace-master-confirmation-box"
              className="p-2.5 rounded-md bg-primary/10 border border-primary/50 space-y-2 text-xs"
            >
              <div className="flex items-center gap-1.5 text-primary font-semibold text-xs">
                <ShieldAlert className="size-4 text-primary shrink-0" />
                <span>Critical: Master Overwrite Verification</span>
              </div>
              <p className="text-text-secondary text-sm leading-relaxed">
                This action creates an automated snapshot of your previous master and updates your primary baseline to this draft.
              </p>
              <label className="flex items-start gap-2 pt-0.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={confirmReplaceMaster}
                  onChange={(e) => setConfirmReplaceMaster(e.target.checked)}
                  data-testid="confirm-replace-master-checkbox"
                  className="mt-0.5 rounded border-primary text-primary focus:ring-0"
                />
                <span className="text-xs text-foreground font-medium leading-snug">
                  I understand this will archive my existing Master Resume and freeze this guest draft as the new canonical baseline.
                </span>
              </label>
            </div>
          )}

          {/* Error Message with Retry */}
          {error && (
            <div
              data-testid="migration-error-alert"
              className="p-2.5 rounded-md bg-status-danger/15 border border-status-danger/50 text-xs text-status-danger flex items-center justify-between gap-2"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <AlertTriangle className="size-4 text-status-danger shrink-0" />
                <span className="truncate">{error}</span>
              </div>
              <button
                type="button"
                onClick={handleMigrate}
                data-testid="retry-migrate-draft-btn"
                className="px-2 py-0.5 rounded bg-status-danger/20 hover:bg-status-danger/30 text-foreground text-xs font-semibold shrink-0 flex items-center gap-1"
              >
                <RefreshCw className="size-3" />
                <span>Retry</span>
              </button>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={handleDismiss}
            data-testid="dismiss-migration-btn"
            className="text-text-muted hover:text-foreground text-xs"
          >
            Not Now
          </Button>
          <Button
            type="button"
            onClick={handleMigrate}
            disabled={isConfirmDisabled}
            data-testid="confirm-migrate-draft-btn"
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs gap-1.5 shadow-lg shadow-primary/20 disabled:opacity-50"
          >
            {isMigrating ? <Loader2 className="size-3.5 animate-spin" /> : <CloudUpload className="size-3.5" />}
            {strategy === "DISCARD" ? "Discard Draft" : "Confirm Sync"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
