"use client";

import React, { useEffect, useRef, useState } from "react";
import { X, Command, Keyboard } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ShortcutItem {
  keys: string[];
  description: string;
  category: "Navigation" | "Editor" | "Tailor" | "Global";
}

const SHORTCUTS: ShortcutItem[] = [
  { keys: ["Ctrl / Cmd", "S"], description: "Save & recompile Typst resume", category: "Editor" },
  { keys: ["Ctrl / Cmd", "/"], description: "Open keyboard shortcuts guide", category: "Global" },
  { keys: ["?"], description: "Open shortcuts guide (when not in text input)", category: "Global" },
  { keys: ["Esc"], description: "Close active modal or flyout", category: "Global" },
];

export function KeyboardShortcutsModal() {
  const [isOpen, setIsOpen] = useState(false);
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const captureOpener = () => {
      openerRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput =
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement ||
        (document.activeElement as HTMLElement)?.isContentEditable;

      if ((e.ctrlKey || e.metaKey) && (e.key === "/" || e.key === "?")) {
        e.preventDefault();
        setIsOpen((prev) => {
          if (!prev) captureOpener();
          return !prev;
        });
        return;
      }

      if (e.key === "?" && !isInput && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        if (!isOpen) captureOpener();
        setIsOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const categories = ["Global", "Editor"] as const;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent
        hideCloseButton
        data-testid="keyboard-shortcuts-modal"
        className="max-w-lg max-h-[90dvh] overflow-y-auto overscroll-contain border-hairline bg-panel p-6"
        onCloseAutoFocus={(event) => {
          const opener = openerRef.current;
          openerRef.current = null;
          if (opener && opener.isConnected) {
            event.preventDefault();
            opener.focus();
          }
        }}
      >
        <div className="flex items-start justify-between gap-4 border-b border-hairline pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-[6px] bg-primary/15 text-primary">
              <Keyboard className="h-4 w-4" aria-hidden />
            </div>
            <DialogHeader className="text-left">
              <DialogTitle className="text-sm font-bold text-foreground">
                Keyboard Shortcuts
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Speed up your workflow across ResumeForge
              </DialogDescription>
            </DialogHeader>
          </div>

          <DialogClose asChild>
            <button
              type="button"
              data-testid="close-shortcuts-btn"
              className="rounded-[6px] p-1 text-muted-foreground hover:bg-elevated hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
              aria-label="Close keyboard shortcuts"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </DialogClose>
        </div>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto overscroll-contain pr-1">
          {categories.map((cat) => {
            const items = SHORTCUTS.filter((s) => s.category === cat);
            if (items.length === 0) return null;

            return (
              <div key={cat} className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-primary">
                  {cat}
                </h3>
                <div className="rounded-[6px] border border-hairline bg-inset divide-y divide-hairline">
                  {items.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between px-3 py-2 text-xs"
                    >
                      <span className="text-on-surface-variant">{item.description}</span>
                      <div className="flex items-center gap-1">
                        {item.keys.map((k, kIdx) => (
                          <kbd
                            key={kIdx}
                            className="rounded border border-control/60 bg-elevated px-1.5 py-0.5 font-mono text-xs font-semibold text-foreground"
                          >
                            {k}
                          </kbd>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between border-t border-hairline pt-3 text-xs text-muted-foreground">
          <span>Press <kbd className="rounded border border-control/60 bg-elevated px-1 py-0.5 font-mono text-xs text-on-surface-variant">Esc</kbd> to close</span>
          <span className="flex items-center gap-1">
            <Command className="h-3 w-3" aria-hidden /> ResumeForge
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
