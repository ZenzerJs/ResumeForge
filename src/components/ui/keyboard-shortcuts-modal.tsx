"use client";

import React, { useEffect, useState, useId } from "react";
import { X, Command, Keyboard } from "lucide-react";
import { cn } from "@/lib/utils";

interface ShortcutItem {
  keys: string[];
  description: string;
  category: "Navigation" | "Editor" | "Tailor" | "Global";
}

const SHORTCUTS: ShortcutItem[] = [
  { keys: ["Ctrl", "S"], description: "Save & recompile Typst resume", category: "Editor" },
  { keys: ["Ctrl", "B"], description: "Toggle AI Assistant sidebar", category: "Editor" },
  { keys: ["Ctrl", "/"], description: "Open keyboard shortcuts guide", category: "Global" },
  { keys: ["?"], description: "Open shortcuts guide (when not in text input)", category: "Global" },
  { keys: ["Esc"], description: "Close active modal or flyout", category: "Global" },
  { keys: ["Alt", "E"], description: "Jump to Editor workspace", category: "Navigation" },
  { keys: ["Alt", "L"], description: "Jump to Evidence Bank (Library)", category: "Navigation" },
  { keys: ["Alt", "J"], description: "Jump to Jobs & Tracker", category: "Navigation" },
  { keys: ["Alt", "T"], description: "Jump to Tailor workspace", category: "Navigation" },
];

export function KeyboardShortcutsModal() {
  const [isOpen, setIsOpen] = useState(false);
  const titleId = useId();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput =
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement ||
        (document.activeElement as HTMLElement)?.isContentEditable;

      if ((e.ctrlKey || e.metaKey) && (e.key === "/" || e.key === "?")) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
        return;
      }

      if (e.key === "?" && !isInput && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setIsOpen(true);
        return;
      }

      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  const categories = ["Global", "Editor", "Navigation"] as const;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
      data-testid="keyboard-shortcuts-modal"
    >
      <div className="relative w-full max-w-lg rounded-xl border border-slate-700 bg-[#0b1326] p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
              <Keyboard className="h-4 w-4" />
            </div>
            <div>
              <h2 id={titleId} className="text-sm font-bold text-white">
                Keyboard Shortcuts
              </h2>
              <p className="text-[11px] text-slate-400">
                Speed up your workflow across ResumeForge
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsOpen(false)}
            data-testid="close-shortcuts-btn"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label="Close keyboard shortcuts"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 max-h-[60vh] space-y-4 overflow-y-auto pr-1">
          {categories.map((cat) => {
            const items = SHORTCUTS.filter((s) => s.category === cat);
            if (items.length === 0) return null;

            return (
              <div key={cat} className="space-y-2">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-amber-400">
                  {cat}
                </h3>
                <div className="rounded-lg border border-slate-800/80 bg-slate-900/60 divide-y divide-slate-800/60">
                  {items.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between px-3 py-2 text-xs"
                    >
                      <span className="text-slate-300">{item.description}</span>
                      <div className="flex items-center gap-1">
                        {item.keys.map((k, kIdx) => (
                          <kbd
                            key={kIdx}
                            className="rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-200 shadow-sm"
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

        <div className="mt-5 flex items-center justify-between border-t border-slate-800 pt-3 text-[11px] text-slate-500">
          <span>Press <kbd className="rounded border border-slate-700 bg-slate-800 px-1 py-0.5 font-mono text-[10px] text-slate-400">Esc</kbd> to close</span>
          <span className="flex items-center gap-1">
            <Command className="h-3 w-3" /> ResumeForge
          </span>
        </div>
      </div>
    </div>
  );
}
