"use client";

import React, { useState, useEffect } from "react";
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
          migrationId,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        // Strict cleanup ONLY after successful 200 response
        if (typeof window !== "undefined") {
          localStorage.removeItem("resumeforge_typst_source");
          localStorage.removeItem("resumeforge_has_guest_draft");
          localStorage.removeItem("resumeforge_migration_id");
          localStorage.removeItem(lockKey);
          localStorage.setItem("resumeforge_draft_migrated", "true");
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
        className="max-w-lg bg-slate-900 border-slate-800 text-slate-100 shadow-2xl"
      >
        <DialogHeader>
          <div className="flex items-center gap-2 text-amber-400">
            <CloudUpload className="size-5 text-amber-400" />
            <DialogTitle className="text-base font-bold text-white">
              Unsaved Guest Draft Detected
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-slate-300">
            We found a resume draft in this browser from your unauthenticated session. Choose how to synchronize it with your account.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5 py-2 text-xs">
          {/* Draft Preview */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-slate-300 font-semibold">
              <FileText className="size-3.5 text-blue-400" />
              <span>Draft Preview ({draftSource.split("\n").length} lines)</span>
            </div>
            <div className="max-h-28 overflow-y-auto rounded-md border border-slate-800 bg-slate-950/80 p-2.5 font-mono text-[11px] text-slate-300 whitespace-pre-wrap leading-relaxed">
              {draftSource.slice(0, 400)}
              {draftSource.length > 400 ? "\n..." : ""}
            </div>
          </div>

          {/* Conflict Strategy Selector */}
          <div className="space-y-1.5" data-testid="conflict-strategy-selector">
            <span className="text-[11px] font-semibold text-amber-300">Select Sync Action:</span>
            <div className="space-y-1.5">
              <label
                className={`flex items-start gap-2.5 p-2.5 rounded-md border cursor-pointer transition-colors ${
                  strategy === "IMPORT_AS_DRAFT"
                    ? "border-amber-500/80 bg-amber-950/30"
                    : "border-slate-800 bg-slate-950/50 hover:border-slate-700"
                }`}
              >
                <input
                  type="radio"
                  name="conflictStrategy"
                  value="IMPORT_AS_DRAFT"
                  checked={strategy === "IMPORT_AS_DRAFT"}
                  onChange={() => setStrategy("IMPORT_AS_DRAFT")}
                  data-testid="strategy-import-draft"
                  className="mt-0.5 text-amber-500 focus:ring-0"
                />
                <div>
                  <span className="font-semibold text-slate-100 block text-xs">
                    Import as Draft Resume (Recommended)
                  </span>
                  <span className="text-[10px] text-slate-400 leading-tight block mt-0.5">
                    Saves draft safely without overwriting your existing Master Resume.
                  </span>
                </div>
              </label>

              <label
                className={`flex items-start gap-2.5 p-2.5 rounded-md border cursor-pointer transition-colors ${
                  strategy === "REPLACE_MASTER"
                    ? "border-amber-500/80 bg-amber-950/30"
                    : "border-slate-800 bg-slate-950/50 hover:border-slate-700"
                }`}
              >
                <input
                  type="radio"
                  name="conflictStrategy"
                  value="REPLACE_MASTER"
                  checked={strategy === "REPLACE_MASTER"}
                  onChange={() => setStrategy("REPLACE_MASTER")}
                  data-testid="strategy-replace-master"
                  className="mt-0.5 text-amber-500 focus:ring-0"
                />
                <div>
                  <span className="font-semibold text-slate-100 block text-xs">
                    Replace Account Master Resume
                  </span>
                  <span className="text-[10px] text-slate-400 leading-tight block mt-0.5">
                    Replaces your primary Master baseline with this guest draft.
                  </span>
                </div>
              </label>

              <label
                className={`flex items-start gap-2.5 p-2.5 rounded-md border cursor-pointer transition-colors ${
                  strategy === "DISCARD"
                    ? "border-amber-500/80 bg-amber-950/30"
                    : "border-slate-800 bg-slate-950/50 hover:border-slate-700"
                }`}
              >
                <input
                  type="radio"
                  name="conflictStrategy"
                  value="DISCARD"
                  checked={strategy === "DISCARD"}
                  onChange={() => setStrategy("DISCARD")}
                  data-testid="strategy-discard"
                  className="mt-0.5 text-amber-500 focus:ring-0"
                />
                <div>
                  <span className="font-semibold text-slate-100 block text-xs">
                    Discard Local Draft
                  </span>
                  <span className="text-[10px] text-slate-400 leading-tight block mt-0.5">
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
              className="p-2.5 rounded-md bg-amber-950/40 border border-amber-700/60 space-y-2 text-xs"
            >
              <div className="flex items-center gap-1.5 text-amber-300 font-semibold text-[11px]">
                <ShieldAlert className="size-4 text-amber-400 shrink-0" />
                <span>Critical: Master Overwrite Verification</span>
              </div>
              <p className="text-slate-300 text-[10px] leading-relaxed">
                This action creates an automated snapshot of your previous master and updates your primary baseline to this draft.
              </p>
              <label className="flex items-start gap-2 pt-0.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={confirmReplaceMaster}
                  onChange={(e) => setConfirmReplaceMaster(e.target.checked)}
                  data-testid="confirm-replace-master-checkbox"
                  className="mt-0.5 rounded border-amber-600 text-amber-500 focus:ring-0"
                />
                <span className="text-[10px] text-amber-200 font-medium leading-snug">
                  I understand this will archive my existing Master Resume and freeze this guest draft as the new canonical baseline.
                </span>
              </label>
            </div>
          )}

          {/* Error Message with Retry */}
          {error && (
            <div
              data-testid="migration-error-alert"
              className="p-2.5 rounded-md bg-red-950/70 border border-red-800 text-xs text-red-200 flex items-center justify-between gap-2"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <AlertTriangle className="size-4 text-red-400 shrink-0" />
                <span className="truncate">{error}</span>
              </div>
              <button
                type="button"
                onClick={handleMigrate}
                data-testid="retry-migrate-draft-btn"
                className="px-2 py-0.5 rounded bg-red-900 hover:bg-red-800 text-red-100 text-[10px] font-semibold shrink-0 flex items-center gap-1"
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
            className="text-slate-400 hover:text-slate-200 text-xs"
          >
            Not Now
          </Button>
          <Button
            type="button"
            onClick={handleMigrate}
            disabled={isConfirmDisabled}
            data-testid="confirm-migrate-draft-btn"
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs gap-1.5 shadow-lg shadow-amber-500/20 disabled:opacity-50"
          >
            {isMigrating ? <Loader2 className="size-3.5 animate-spin" /> : <CloudUpload className="size-3.5" />}
            {strategy === "DISCARD" ? "Discard Draft" : "Confirm Sync"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
