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
      <Skeleton className={cn("h-2.5 rounded-sm bg-elevated", width)} />
    </div>
  );
}

function PreviewBulletBlock() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-2.5 w-28 rounded-sm bg-[#d8d0c5]" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-start gap-2 pl-1">
          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#d8d0c5]" />
          <Skeleton
            className={cn(
              "h-2 rounded-sm bg-[#d8d0c5]",
              i === 0 ? "w-full" : i === 1 ? "w-[92%]" : "w-[78%]"
            )}
          />
        </div>
      ))}
    </div>
  );
}

/**
 * High-fidelity editor loading shell matching the <1024px tabbed workspace,
 * the 1024-1279px 2-panel workspace, and the >=1280px 3-panel workspace
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
        "flex flex-col overflow-hidden bg-background text-foreground",
        showNav ? "h-dvh max-h-dvh" : "h-full",
        className
      )}
      data-testid="editor-workspace-skeleton"
      aria-busy="true"
      aria-label="Loading editor workspace"
    >
      {showNav ? (
        <>
          <header className="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-border bg-rf-bg/90 px-4 backdrop-blur-xl md:px-6">
            <div className="flex min-w-0 items-center gap-6">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-[6px] bg-primary text-base font-bold text-primary-foreground">
                  R
                </div>
                <span className="hidden text-sm font-semibold tracking-tight text-foreground sm:inline">
                  ResumeForge
                </span>
              </div>
              <nav className="hidden items-center gap-1 lg:flex" aria-hidden>
                {["Editor", "Evidence Bank", "Jobs", "Tailor", "Practice", "Settings"].map(
                  (label) => (
                    <span
                      key={label}
                      className={cn(
                        "rounded-[6px] px-2.5 py-1 text-xs font-semibold",
                        label === "Editor"
                          ? "bg-elevated text-foreground"
                          : "text-muted-foreground"
                      )}
                    >
                      {label}
                    </span>
                  )
                )}
              </nav>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Skeleton className="h-9 w-9 rounded-[6px] bg-elevated lg:hidden" />
              <Skeleton className="h-7 w-16 rounded bg-elevated" />
            </div>
          </header>
          <div className="flex min-h-10 shrink-0 items-center justify-between gap-3 border-b border-outline/70 bg-panel px-4 py-1 lg:h-10 lg:px-6">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-28 rounded bg-elevated" />
              <Skeleton className="h-5 w-24 rounded bg-elevated" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-flex h-7 items-center gap-1.5 rounded border border-outline/70 px-2.5 text-xs text-text-secondary">
                <RotateCcw className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Revert to Master</span>
              </span>
              <span className="inline-flex h-7 items-center gap-1.5 rounded bg-primary px-3 text-xs font-semibold text-primary-foreground">
                <Save className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Save as Master Resume</span>
              </span>
            </div>
          </div>
        </>
      ) : null}

      {/* Mobile / tablet panel selector bar (<1024px) */}
      <div className="flex shrink-0 items-center border-b border-outline/70 bg-panel px-2 py-1.5 lg:hidden" aria-hidden>
        <div className="grid w-full grid-cols-3 gap-1 rounded-[6px] border border-outline/70 bg-inset p-0.5 sm:inline-flex sm:w-auto">
          <Skeleton className="h-9 rounded-[4px] bg-primary/75 sm:w-20" />
          <Skeleton className="h-9 rounded-[4px] bg-elevated sm:w-20" />
          <Skeleton className="h-9 rounded-[4px] bg-elevated sm:w-16" />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-1.5 overflow-hidden bg-canvas px-1.5 pb-1.5 pt-0">
        {/* Panel 1 — Typst Source Editor */}
        <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-b-[6px] border-x border-b border-outline/70 bg-panel lg:flex-1 xl:flex-[1.15]">
          <div className="flex h-8 shrink-0 items-center justify-between border-b border-outline/70 bg-panel px-2.5">
            <span className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <span className="h-2 w-2 rounded-full bg-primary" />
              Typst Source
            </span>
            <div className="flex items-center gap-1.5">
              <Skeleton className="h-5 w-14 rounded bg-elevated" />
              <Skeleton className="h-5 w-16 rounded bg-elevated" />
            </div>
          </div>
          <div className="relative flex-1 overflow-hidden bg-inset p-3 font-mono">
            <div className="flex gap-3">
              <div className="flex w-5 shrink-0 flex-col gap-[13px] pt-0.5 text-right text-xs leading-none text-text-muted select-none">
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

        {/* Resize handle cue (visible in 2-pane >=1024px and 3-pane >=1280px) */}
        <div className="hidden w-1.5 shrink-0 items-center justify-center self-stretch lg:flex" aria-hidden>
          <div className="h-8 w-1 rounded-full bg-outline/70" />
        </div>

        {/* Panel 2 — Live Document Preview */}
        <section className="hidden min-w-0 flex-1 flex-col overflow-hidden rounded-b-[6px] border-x border-b border-outline/70 bg-inset lg:flex">
          <div className="flex h-8 shrink-0 items-center justify-between border-b border-outline/70 bg-panel px-2.5">
            <span className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <span className="h-2 w-2 rounded-full bg-status-success" />
              Preview
            </span>
            <div className="flex items-center gap-1.5">
              <Skeleton className="h-5 w-10 rounded bg-elevated" />
              <Skeleton className="h-5 w-14 rounded bg-elevated" />
              <Skeleton className="h-5 w-16 rounded bg-primary/70" />
            </div>
          </div>
          <div className="flex flex-1 items-start justify-center overflow-hidden bg-inset px-4 pb-6 pt-2">
            <div className="h-full w-full max-w-[420px] overflow-hidden rounded-[2px] border border-[#d8dce0] bg-paper p-6 shadow-[0_4px_16px_rgba(0,0,0,0.45)] sm:p-8">
              <div className="mx-auto mb-5 space-y-2 text-center">
                <Skeleton className="mx-auto h-4 w-40 rounded-sm bg-[#d8d0c5]" />
                <Skeleton className="mx-auto h-2 w-56 rounded-sm bg-[#e6dfd6]" />
              </div>
              <div className="space-y-5">
                <div className="space-y-2">
                  <Skeleton className="h-2.5 w-24 rounded-sm bg-[#d8d0c5]" />
                  <Skeleton className="h-2 w-full rounded-sm bg-[#e6dfd6]" />
                  <Skeleton className="h-2 w-[90%] rounded-sm bg-[#e6dfd6]" />
                  <Skeleton className="h-2 w-[75%] rounded-sm bg-[#e6dfd6]" />
                </div>
                <PreviewBulletBlock />
                <PreviewBulletBlock />
                <div className="space-y-2">
                  <Skeleton className="h-2.5 w-20 rounded-sm bg-[#d8d0c5]" />
                  <Skeleton className="h-2 w-full rounded-sm bg-[#e6dfd6]" />
                  <Skeleton className="h-2 w-[85%] rounded-sm bg-[#e6dfd6]" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Resize handle cue */}
        <div className="hidden w-1.5 shrink-0 items-center justify-center self-stretch xl:flex" aria-hidden>
          <div className="h-8 w-1 rounded-full bg-outline/70" />
        </div>

        {/* Panel 3 — AI Tailoring Assistant */}
        <section className="hidden min-w-0 flex-[0.85] flex-col overflow-hidden rounded-b-[6px] border-x border-b border-outline/70 bg-panel xl:flex">
          <div className="flex h-8 shrink-0 items-center justify-between border-b border-outline/70 bg-panel px-2.5">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Wand2 className="h-3.5 w-3.5 text-primary" />
              AI Assistant
            </span>
            <div className="flex items-center gap-1.5">
              <Skeleton className="h-5 w-12 rounded bg-elevated" />
              <Skeleton className="h-5 w-12 rounded bg-elevated" />
            </div>
          </div>
          <div className="flex flex-1 flex-col gap-3 overflow-hidden p-3">
            <div className="space-y-2.5 rounded-[10px] border border-outline/70 bg-inset p-3">
              <Skeleton className="h-3 w-3/4 rounded-sm bg-elevated" />
              <Skeleton className="h-3 w-full rounded-sm bg-elevated/80" />
              <Skeleton className="h-3 w-5/6 rounded-sm bg-elevated/80" />
              <Skeleton className="h-3 w-2/3 rounded-sm bg-elevated/60" />
            </div>

            <div className="flex items-center gap-2 rounded border border-outline/70 bg-inset px-3 py-2">
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary/70" />
              <Skeleton className="h-2.5 flex-1 rounded-sm bg-elevated" />
              <Skeleton className="h-6 w-14 rounded bg-elevated" />
            </div>

            <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-[10px] border border-dashed border-outline/70 bg-inset/60 px-4 py-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-outline/70 bg-elevated text-text-muted">
                <Bot className="h-6 w-6" />
              </div>
              <Skeleton className="h-2.5 w-40 rounded-sm bg-elevated" />
              <Skeleton className="h-2.5 w-48 rounded-sm bg-elevated/80" />
              <Skeleton className="h-2.5 w-36 rounded-sm bg-elevated/70" />
              <Skeleton className="h-2.5 w-28 rounded-sm bg-elevated/60" />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
