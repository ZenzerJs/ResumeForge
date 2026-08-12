import React from "react";
import { Bot, RotateCcw, Save, Sparkles, Wand2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const CODE_LINE_WIDTHS = [
  "w-[72%]",
  "w-[88%]",
  "w-[54%]",
  "w-[91%]",
  "w-[40%]",
  "w-[78%]",
  "w-[65%]",
  "w-[84%]",
  "w-[48%]",
  "w-[70%]",
  "w-[92%]",
  "w-[58%]",
  "w-[76%]",
  "w-[45%]",
];

function CodeLine({ width, indent = false }: { width: string; indent?: boolean }) {
  return (
    <div className={cn("flex items-center gap-3", indent && "pl-6")}>
      <Skeleton className={cn("h-2.5 rounded-sm bg-slate-700/70", width)} />
    </div>
  );
}

function PreviewBulletBlock() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-2.5 w-28 rounded-sm bg-slate-300" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-start gap-2 pl-1">
          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
          <Skeleton
            className={cn(
              "h-2 rounded-sm bg-slate-300",
              i === 0 ? "w-full" : i === 1 ? "w-[92%]" : "w-[78%]"
            )}
          />
        </div>
      ))}
    </div>
  );
}

/**
 * High-fidelity editor loading shell matching the 3-panel workspace
 * (Typst source | Live preview paper | AI assistant).
 */
export function EditorWorkspaceSkeleton({
  className,
  showNav = true,
}: {
  className?: string;
  /** When false, omit the top nav chrome (for overlays inside AppShell). */
  showNav?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden bg-[#0B0F17] text-slate-100",
        showNav ? "h-screen max-h-screen" : "h-full",
        className
      )}
      data-testid="editor-workspace-skeleton"
      aria-busy="true"
      aria-label="Loading editor workspace"
    >
      {showNav ? (
        <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-slate-800/90 bg-[#0B0F17]/95 px-4 backdrop-blur-md sm:px-5">
          <div className="flex min-w-0 items-center gap-6">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-500 text-sm font-black text-slate-950">
                R
              </div>
              <span className="hidden text-sm font-semibold tracking-tight text-white sm:inline">
                ResumeForge
              </span>
            </div>
            <nav className="hidden items-center gap-1 md:flex" aria-hidden>
              {["Master Resume DB", "Editor", "Evidence Bank", "Jobs", "Tailor", "Settings"].map(
                (label) => (
                  <span
                    key={label}
                    className={cn(
                      "rounded-md px-2.5 py-1.5 text-[11px] font-medium",
                      label === "Editor"
                        ? "bg-slate-800/80 text-white"
                        : "text-slate-500"
                    )}
                  >
                    {label}
                  </span>
                )
              )}
            </nav>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-700 px-2.5 text-[11px] font-medium text-slate-400">
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Revert to Master</span>
            </span>
            <span className="inline-flex h-8 items-center gap-1.5 rounded-md bg-amber-500 px-2.5 text-[11px] font-semibold text-slate-950">
              <Save className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Save as Master Resume</span>
            </span>
          </div>
        </header>
      ) : null}

      <main className="flex min-h-0 flex-1 gap-1.5 overflow-hidden p-2 md:p-3">
        {/* Panel 1 — Typst Source Editor */}
        <section className="flex min-w-0 flex-[1.15] flex-col overflow-hidden rounded-md border border-slate-800 bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-4 py-2.5">
            <span className="flex items-center gap-2 text-xs font-medium text-slate-400">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              Typst Source Editor
            </span>
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-16 rounded-md bg-slate-800" />
              <Skeleton className="h-6 w-20 rounded-md bg-slate-800" />
            </div>
          </div>
          <div className="relative flex-1 overflow-hidden bg-[#0f1419] p-3 font-mono">
            <div className="flex gap-3">
              <div className="flex w-5 shrink-0 flex-col gap-[13px] pt-0.5 text-right text-[10px] leading-none text-slate-600 select-none">
                {Array.from({ length: CODE_LINE_WIDTHS.length }).map((_, i) => (
                  <span key={i}>{i + 1}</span>
                ))}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-[13px] pt-0.5">
                {CODE_LINE_WIDTHS.map((width, i) => (
                  <CodeLine key={i} width={width} indent={i % 4 === 2 || i % 5 === 3} />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Resize handle cue */}
        <div className="hidden w-1.5 shrink-0 items-center justify-center self-stretch lg:flex" aria-hidden>
          <div className="h-8 w-1 rounded-full bg-slate-700/80" />
        </div>

        {/* Panel 2 — Live Document Preview */}
        <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-md border border-slate-200 bg-slate-100 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2.5">
            <span className="flex items-center gap-2 text-xs font-medium text-slate-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Live Document Preview
            </span>
            <div className="flex items-center gap-1.5">
              <Skeleton className="h-6 w-14 rounded-md bg-slate-200" />
              <Skeleton className="h-6 w-14 rounded-md bg-slate-200" />
              <Skeleton className="h-6 w-16 rounded-md bg-violet-500/80" />
              <Skeleton className="h-6 w-12 rounded-md bg-slate-200" />
            </div>
          </div>
          <div className="flex flex-1 items-start justify-center overflow-hidden bg-slate-200/70 p-4 md:p-6">
            <div className="h-full w-full max-w-[420px] overflow-hidden rounded-sm bg-white p-6 shadow-md ring-1 ring-slate-300/60 sm:p-8">
              <div className="mx-auto mb-5 space-y-2 text-center">
                <Skeleton className="mx-auto h-4 w-40 rounded-sm bg-slate-300" />
                <Skeleton className="mx-auto h-2 w-56 rounded-sm bg-slate-200" />
              </div>
              <div className="space-y-5">
                <div className="space-y-2">
                  <Skeleton className="h-2.5 w-24 rounded-sm bg-slate-300" />
                  <Skeleton className="h-2 w-full rounded-sm bg-slate-200" />
                  <Skeleton className="h-2 w-[90%] rounded-sm bg-slate-200" />
                  <Skeleton className="h-2 w-[75%] rounded-sm bg-slate-200" />
                </div>
                <PreviewBulletBlock />
                <PreviewBulletBlock />
                <div className="space-y-2">
                  <Skeleton className="h-2.5 w-20 rounded-sm bg-slate-300" />
                  <Skeleton className="h-2 w-full rounded-sm bg-slate-200" />
                  <Skeleton className="h-2 w-[85%] rounded-sm bg-slate-200" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Resize handle cue */}
        <div className="hidden w-1.5 shrink-0 items-center justify-center self-stretch lg:flex" aria-hidden>
          <div className="h-8 w-1 rounded-full bg-slate-700/80" />
        </div>

        {/* Panel 3 — AI Tailoring Assistant */}
        <section className="hidden min-w-0 flex-[0.85] flex-col overflow-hidden rounded-md border border-slate-800 bg-slate-900 shadow-sm lg:flex">
          <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-4 py-2.5">
            <span className="flex items-center gap-2 text-xs font-medium text-slate-400">
              <Wand2 className="h-3.5 w-3.5 text-amber-400" />
              AI Tailoring Assistant
            </span>
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-12 rounded-md bg-slate-800" />
              <Skeleton className="h-6 w-12 rounded-md bg-slate-800" />
            </div>
          </div>
          <div className="flex flex-1 flex-col gap-3 overflow-hidden p-3">
            <div className="space-y-2.5 rounded-lg border border-slate-800 bg-slate-950/60 p-3">
              <Skeleton className="h-3 w-3/4 rounded-sm bg-slate-700/80" />
              <Skeleton className="h-3 w-full rounded-sm bg-slate-700/60" />
              <Skeleton className="h-3 w-5/6 rounded-sm bg-slate-700/60" />
              <Skeleton className="h-3 w-2/3 rounded-sm bg-slate-700/50" />
            </div>

            <div className="flex items-center gap-2 rounded-md border border-slate-800 bg-slate-950/40 px-3 py-2">
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-amber-500/70" />
              <Skeleton className="h-2.5 flex-1 rounded-sm bg-slate-700/70" />
              <Skeleton className="h-6 w-14 rounded-md bg-slate-800" />
            </div>

            <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-slate-800/80 bg-slate-950/30 px-4 py-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-slate-500">
                <Bot className="h-6 w-6" />
              </div>
              <Skeleton className="h-2.5 w-40 rounded-sm bg-slate-700/70" />
              <Skeleton className="h-2.5 w-48 rounded-sm bg-slate-700/60" />
              <Skeleton className="h-2.5 w-36 rounded-sm bg-slate-700/50" />
              <Skeleton className="h-2.5 w-28 rounded-sm bg-slate-700/40" />
              <Skeleton className="h-2.5 w-20 rounded-sm bg-slate-700/30" />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
