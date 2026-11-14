"use client";

import React, { useEffect, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "destructive";
  isConfirming?: boolean;
  onConfirm: () => void | Promise<void>;
  dialogTestId?: string;
  confirmTestId?: string;
  cancelTestId?: string;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  isConfirming = false,
  onConfirm,
  dialogTestId,
  confirmTestId,
  cancelTestId,
}: ConfirmDialogProps) {
  const cancelBtnRef = useRef<HTMLButtonElement | null>(null);
  const submittingRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [open]);

  const busy = isConfirming || submitting;

  const handleConfirmClick = async () => {
    if (busy || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await onConfirm();
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (busy && !nextOpen) return;
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent
        hideCloseButton
        data-testid={dialogTestId}
        className="max-w-md border-hairline bg-panel p-6 text-foreground shadow-2xl"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          cancelBtnRef.current?.focus();
        }}
      >
        <div className="flex items-start gap-3">
          {tone === "destructive" ? (
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[6px] border border-status-danger/30 bg-status-danger/10 text-status-danger">
              <AlertTriangle className="h-4 w-4" aria-hidden />
            </div>
          ) : null}
          <DialogHeader className="text-left">
            <DialogTitle className="text-base font-bold text-foreground">
              {title}
            </DialogTitle>
            <DialogDescription className="text-xs leading-relaxed text-muted-foreground">
              {description}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            ref={cancelBtnRef}
            type="button"
            disabled={busy}
            data-testid={cancelTestId}
            onClick={() => onOpenChange(false)}
            className="rounded-[6px] border border-control/70 bg-inset px-3.5 py-2 text-xs font-medium text-foreground transition hover:bg-elevated disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            data-testid={confirmTestId}
            onClick={() => {
              void handleConfirmClick();
            }}
            className={cn(
              "rounded-[6px] px-3.5 py-2 text-xs font-semibold transition disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-panel",
              tone === "destructive"
                ? "border border-status-danger/40 bg-status-danger/20 text-status-danger hover:bg-status-danger/30"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            )}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
