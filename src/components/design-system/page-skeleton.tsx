import React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { EditorWorkspaceSkeleton } from "@/components/editor/editor-workspace-skeleton";
import { WorkspaceAtmosphere } from "@/components/design-system/workspace-atmosphere";
import type { AtmosphereVariant } from "@/components/design-system/app-shell";

export type PageSkeletonVariant =
  | "default"
  | "editor"
  | "tailor"
  | "library"
  | "tracker"
  | "settings"
  | "discover"
  | "outcomes"
  | "practice";

interface PageSkeletonProps {
  variant?: PageSkeletonVariant;
  className?: string;
}

function toAtmosphereVariant(variant: PageSkeletonVariant): AtmosphereVariant {
  switch (variant) {
    case "default":
    case "practice":
      return "quiet";
    case "outcomes":
      return "tracker";
    default:
      return variant;
  }
}

function BannerHeaderSkeleton({ withAction = true }: { withAction?: boolean }) {
  return (
    <div className="flex flex-col gap-4 rounded-xl surface-raised edge-glow p-5 sm:p-6 md:flex-row md:items-center md:justify-between">
      <div className="space-y-2 border-l-2 border-primary pl-3 sm:pl-4">
        <Skeleton className="h-4 w-24 rounded-full" />
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-3.5 w-80 max-w-full" />
      </div>
      {withAction ? (
        <div className="flex shrink-0 items-center gap-2.5">
          <Skeleton className="h-9 w-28 rounded-md" />
          <Skeleton className="h-9 w-32 rounded-md" />
        </div>
      ) : null}
    </div>
  );
}

function TrackerSubNavSkeleton() {
  return (
    <div className="sticky top-0 z-20 shrink-0 border-b glass-bar">
      <div className="flex h-11 items-center justify-between gap-2 px-4">
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden sm:gap-3">
          <div className="flex shrink-0 items-center gap-1.5 border-r border-hairline pr-3">
            <Skeleton className="h-3.5 w-3.5 rounded" />
            <Skeleton className="h-3.5 w-8" />
          </div>
          <Skeleton className="h-7 w-28 shrink-0 rounded-lg" />
          <Skeleton className="h-7 w-28 shrink-0 rounded-lg" />
          <Skeleton className="h-7 w-16 shrink-0 rounded-lg" />
          <Skeleton className="h-7 w-16 shrink-0 rounded-lg" />
          <Skeleton className="h-7 w-20 shrink-0 rounded-lg" />
        </div>
        <Skeleton className="h-7 w-24 shrink-0 rounded-md" />
      </div>
    </div>
  );
}

function ShellFrame({
  children,
  className,
  variant = "default",
}: {
  children: React.ReactNode;
  className?: string;
  variant?: PageSkeletonVariant;
}) {
  return (
    <div
      className={cn(
        "relative min-h-screen overflow-x-hidden bg-rf-bg text-rf-body",
        className
      )}
      data-testid="page-skeleton"
      aria-busy="true"
      aria-label="Loading page"
    >
      {variant !== "editor" ? (
        <WorkspaceAtmosphere variant={toAtmosphereVariant(variant)} />
      ) : null}

      <div className="relative z-10 flex min-h-screen flex-col">
        {/* Nav bar placeholder */}
        <div className="fixed inset-x-0 top-0 z-40 h-16 border-b border-border bg-rf-bg/90 backdrop-blur-xl">
          <div aria-hidden="true" className="ombre-bar pointer-events-none absolute inset-x-0 top-0 h-[2px]" />
          <div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
            <div className="flex items-center gap-2.5">
              <Skeleton className="h-8 w-8 rounded-[8px]" />
              <Skeleton className="h-5 w-28" />
            </div>
            <div className="hidden flex-1 items-center justify-center gap-4 md:flex">
              <Skeleton className="h-3.5 w-14 rounded-full" />
              <Skeleton className="h-3.5 w-20 rounded-full" />
              <Skeleton className="h-3.5 w-12 rounded-full" />
              <Skeleton className="h-3.5 w-14 rounded-full" />
              <Skeleton className="h-3.5 w-16 rounded-full" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-20 rounded-[7px]" />
              <Skeleton className="h-8 w-20 rounded-[7px]" />
            </div>
          </div>
          <div aria-hidden="true" className="ombre-divider pointer-events-none absolute inset-x-0 bottom-0 h-px" />
        </div>
        <main
          className={cn(
            "flex-1 pt-16",
            variant === "tracker" && "flex min-h-0 flex-col lg:h-screen lg:overflow-hidden"
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

function TailorSkeleton() {
  return (
    <ShellFrame variant="tailor">
      <div className="mx-auto w-full max-w-[1280px] space-y-6 px-4 pt-8 pb-12 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-4 w-96 max-w-full" />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Skeleton className="h-11 w-48 rounded-md" />
            <Skeleton className="h-11 w-44 rounded-md" />
          </div>
        </div>

        {/* Active job context card matching tailor-workspace.tsx */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl surface-raised edge-glow px-5 py-4">
          <div className="min-w-0 space-y-2">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-6 w-56 max-w-full" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-6 w-24 rounded-md" />
            <Skeleton className="h-6 w-24 rounded-md" />
          </div>
        </div>

        {/* 5-tab segmented control pill strip matching tailor-workspace.tsx */}
        <div className="inline-flex max-w-full flex-wrap items-center gap-1 rounded-xl border p-1 glass-bar">
          <Skeleton className="h-8 w-24 rounded-lg" />
          <Skeleton className="h-8 w-24 rounded-lg" />
          <Skeleton className="h-8 w-20 rounded-lg" />
          <Skeleton className="h-8 w-28 rounded-lg" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>

        {/* 2-column workbench matching initial job-info layout */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
          <div className="min-w-0 space-y-4 rounded-xl surface-raised edge-glow p-5">
            <div className="flex items-center justify-between border-b border-hairline pb-3">
              <Skeleton className="h-5 w-44" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-11 w-full rounded-lg" />
            <div className="flex gap-2 rounded-lg bg-inset p-1">
              <Skeleton className="h-9 w-28 rounded-md" />
              <Skeleton className="h-9 w-28 rounded-md" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
            <Skeleton className="h-52 w-full rounded-lg" />
          </div>

          <div className="space-y-4">
            <div className="space-y-3 rounded-xl surface-raised edge-glow p-5">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-36" />
                <Skeleton className="h-9 w-9 rounded-full shrink-0" />
              </div>
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-5/6" />
              <div className="flex flex-wrap gap-1.5 pt-2">
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-14 rounded-full" />
                <Skeleton className="h-6 w-24 rounded-full" />
              </div>
            </div>
            <div className="space-y-3 rounded-xl surface-raised edge-glow p-5">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-24 w-full rounded-lg" />
              <Skeleton className="h-9 w-full rounded-md" />
            </div>
          </div>
        </div>
      </div>
    </ShellFrame>
  );
}

function LibrarySkeleton() {
  return (
    <ShellFrame variant="library">
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 pt-8 pb-16">
        <div className="space-y-6">
          <BannerHeaderSkeleton withAction={false} />
          <div className="rounded-xl surface-raised p-5">
            <div className="flex flex-col items-center justify-center gap-2 py-3">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <Skeleton className="h-4 w-64 max-w-full" />
              <Skeleton className="h-3 w-48 max-w-full" />
            </div>
          </div>
        </div>

        {/* Tab strip */}
        <div className="flex gap-4 border-b border-hairline pb-2">
          <Skeleton className="h-6 w-20 rounded" />
          <Skeleton className="h-6 w-28 rounded" />
        </div>

        {/* Search input (max-w-md) + filter/status controls */}
        <div className="flex flex-col items-center justify-between gap-4 rounded-xl border glass-bar px-4 py-3 sm:flex-row">
          <Skeleton className="h-11 w-full max-w-md rounded-[6px]" />
          <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
            <Skeleton className="h-8 w-36 rounded-[6px]" />
            <Skeleton className="h-4 w-14" />
          </div>
        </div>

        {/* Stacked 1-column evidence cards */}
        <div className="grid gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-4 rounded-xl surface-raised edge-glow p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-4 w-52 max-w-full" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
                <Skeleton className="h-5 w-20 shrink-0 rounded-md" />
              </div>
              <div className="space-y-2 pl-12">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-11/12" />
                <Skeleton className="h-3 w-3/4" />
              </div>
              <div className="flex flex-wrap gap-1.5 pl-12">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-5 w-14 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </ShellFrame>
  );
}

function TrackerSkeleton() {
  return (
    <ShellFrame variant="tracker">
      <TrackerSubNavSkeleton />

      {/* Sticky filter subheader strip */}
      <div className="sticky top-11 z-10 flex shrink-0 flex-wrap items-center gap-2 border-b glass-bar px-4 py-2.5">
        <Skeleton className="h-9 min-w-[180px] flex-1 rounded-md sm:max-w-xs" />
        <Skeleton className="h-9 min-w-[140px] flex-1 rounded-md sm:max-w-[180px]" />
        <Skeleton className="h-9 w-28 rounded-md" />
        <Skeleton className="h-9 w-28 rounded-md" />
        <div className="hidden items-center gap-1.5 md:flex">
          <Skeleton className="h-7 w-16 rounded-full" />
          <Skeleton className="h-7 w-20 rounded-full" />
          <Skeleton className="h-7 w-20 rounded-full" />
        </div>
      </div>

      {/* Split-pane master-detail */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Left scrollable list pane */}
        <div className="flex min-h-0 w-full flex-col border-r border-hairline lg:w-[400px] lg:shrink-0">
          <div className="min-h-0 flex-1 overflow-hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="flex gap-3 surface-raised border-x-0 border-t-0 border-b border-hairline px-4 py-3.5"
              >
                <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-44 max-w-full" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                    <Skeleton className="h-5 w-20 shrink-0 rounded-full" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Skeleton className="h-7 w-24 rounded-[6px]" />
                    <Skeleton className="h-7 w-7 rounded-[6px]" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right detail pane */}
        <div className="hidden min-h-0 min-w-0 flex-1 flex-col gap-5 overflow-hidden p-6 lg:flex">
          <div className="flex items-start justify-between gap-4 border-b border-hairline pb-4">
            <div className="space-y-2">
              <Skeleton className="h-6 w-64" />
              <Skeleton className="h-4 w-44" />
            </div>
            <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-9 w-28 rounded-md" />
            <Skeleton className="h-9 w-32 rounded-md" />
            <Skeleton className="h-9 w-24 rounded-md" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          <div className="space-y-3 rounded-xl surface-raised edge-glow p-5">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-11/12" />
            <Skeleton className="h-3 w-5/6" />
            <Skeleton className="h-32 w-full rounded-lg" />
          </div>
        </div>
      </div>
    </ShellFrame>
  );
}

function DiscoverSkeleton() {
  return (
    <ShellFrame variant="discover">
      <TrackerSubNavSkeleton />
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 md:p-8">
        <BannerHeaderSkeleton />

        {/* Curated company quick-filter chips */}
        <div className="flex flex-wrap items-center gap-2 rounded-xl border glass-bar px-4 py-2.5">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>

        {/* Search + filter toolbar */}
        <div className="flex flex-col gap-3 rounded-xl surface-raised p-4">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-11 w-full rounded-md" />
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-10 w-32 rounded-md" />
            <Skeleton className="h-10 w-32 rounded-md" />
            <Skeleton className="h-10 w-28 rounded-md" />
            <Skeleton className="h-10 w-28 rounded-md" />
            <Skeleton className="h-10 w-28 rounded-md" />
          </div>
        </div>

        {/* 6-card 2-column grid matching discover-feed.tsx */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex flex-col justify-between gap-4 rounded-xl surface-raised edge-glow p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-4 w-40 max-w-full" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                </div>
                <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-4/5" />
              </div>
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-5 w-20 rounded-md" />
                <Skeleton className="h-5 w-24 rounded-md" />
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-hairline pt-3">
                <div className="flex gap-1.5">
                  <Skeleton className="h-5 w-14 rounded-md" />
                  <Skeleton className="h-5 w-16 rounded-md" />
                </div>
                <Skeleton className="h-9 w-24 shrink-0 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </ShellFrame>
  );
}

function OutcomesSkeleton() {
  return (
    <ShellFrame variant="outcomes">
      <TrackerSubNavSkeleton />
      <div className="mx-auto w-full max-w-4xl space-y-6 p-4 sm:p-6">
        <BannerHeaderSkeleton withAction={false} />

        {/* KPI summary tiles row */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-2 rounded-xl surface-raised edge-glow p-3.5">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-7 w-12" />
            </div>
          ))}
        </div>

        {/* Funnel chart card */}
        <div className="space-y-3 rounded-xl surface-raised edge-glow p-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="grid grid-cols-[8rem_1fr_2rem] items-center gap-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-2 w-full rounded" />
              <Skeleton className="h-3 w-6 justify-self-end" />
            </div>
          ))}
          <Skeleton className="mt-2 h-3 w-56" />
        </div>

        {/* Variant breakdown table card */}
        <div className="space-y-3 rounded-xl surface-raised edge-glow p-4">
          <div className="grid grid-cols-5 gap-3 pb-1">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-12" />
          </div>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="grid grid-cols-5 gap-3 border-t border-hairline pt-3">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-3.5 w-8" />
              <Skeleton className="h-3.5 w-8" />
              <Skeleton className="h-3.5 w-10" />
            </div>
          ))}
        </div>
      </div>
    </ShellFrame>
  );
}

function PracticeSkeleton() {
  return (
    <ShellFrame variant="practice">
      <div className="mx-auto w-full max-w-6xl space-y-5 px-4 pt-6 pb-12 md:px-8">
        <BannerHeaderSkeleton withAction={false} />

        {/* Target Role Context bar */}
        <div className="flex flex-col justify-between gap-3 rounded-xl surface-raised px-4 py-3 sm:flex-row sm:items-center">
          <div className="space-y-1.5">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-80 max-w-full" />
          </div>
          <Skeleton className="h-9 w-56 rounded-[6px]" />
        </div>

        {/* Tab strip: Questions | DSA Sandbox */}
        <div className="flex items-center gap-6 border-b border-hairline pb-2.5">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-24" />
        </div>

        {/* Filter bar */}
        <div className="space-y-3 rounded-[10px] surface-raised p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              <Skeleton className="h-8 w-24 rounded-[6px]" />
              <Skeleton className="h-8 w-40 rounded-[6px]" />
              <Skeleton className="h-8 w-28 rounded-[6px]" />
              <Skeleton className="h-8 w-28 rounded-[6px]" />
            </div>
            <div className="flex gap-1.5">
              <Skeleton className="h-7 w-20 rounded-[6px]" />
              <Skeleton className="h-7 w-14 rounded-[6px]" />
              <Skeleton className="h-7 w-16 rounded-[6px]" />
              <Skeleton className="h-7 w-14 rounded-[6px]" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 border-t border-hairline pt-2.5">
            <Skeleton className="h-7 w-24 rounded-[6px]" />
            <Skeleton className="h-7 w-20 rounded-[6px]" />
            <Skeleton className="h-7 w-20 rounded-[6px]" />
            <Skeleton className="h-7 w-24 rounded-[6px]" />
          </div>
        </div>

        {/* Question/topic cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex flex-col justify-between gap-4 rounded-[10px] surface-raised edge-glow p-4">
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <Skeleton className="h-4 w-44 max-w-full" />
                  <Skeleton className="h-5 w-14 shrink-0 rounded-full" />
                </div>
                <Skeleton className="h-3 w-36" />
              </div>
              <div className="flex flex-wrap gap-1.5 border-t border-hairline pt-3">
                <Skeleton className="h-5 w-16 rounded" />
                <Skeleton className="h-5 w-14 rounded" />
                <Skeleton className="h-5 w-16 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </ShellFrame>
  );
}

function SettingsSkeleton() {
  return (
    <ShellFrame variant="settings">
      <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
        <BannerHeaderSkeleton withAction={false} />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-3 rounded-xl surface-raised edge-glow p-5">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-9 w-28 rounded-md" />
          </div>
        ))}
      </div>
    </ShellFrame>
  );
}

function DefaultSkeleton() {
  return (
    <ShellFrame variant="default">
      <div className="mx-auto max-w-5xl space-y-6 p-6">
        <BannerHeaderSkeleton />
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-3 rounded-xl surface-raised edge-glow p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Skeleton className="h-8 w-8 rounded-md" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
              </div>
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
            </div>
          ))}
        </div>
      </div>
    </ShellFrame>
  );
}

export function PageSkeleton({ variant = "default", className }: PageSkeletonProps) {
  const body = (() => {
    switch (variant) {
      case "editor":
        return <EditorWorkspaceSkeleton />;
      case "tailor":
        return <TailorSkeleton />;
      case "library":
        return <LibrarySkeleton />;
      case "tracker":
        return <TrackerSkeleton />;
      case "discover":
        return <DiscoverSkeleton />;
      case "outcomes":
        return <OutcomesSkeleton />;
      case "practice":
        return <PracticeSkeleton />;
      case "settings":
        return <SettingsSkeleton />;
      default:
        return <DefaultSkeleton />;
    }
  })();

  if (!className) return body;
  return <div className={className}>{body}</div>;
}
