import React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { EditorWorkspaceSkeleton } from "@/components/editor/editor-workspace-skeleton";

export type PageSkeletonVariant =
  | "default"
  | "editor"
  | "tailor"
  | "library"
  | "tracker"
  | "settings"
  | "discover";

interface PageSkeletonProps {
  variant?: PageSkeletonVariant;
  className?: string;
}

function ShellFrame({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "min-h-screen bg-rf-bg text-rf-body",
        className
      )}
      data-testid="page-skeleton"
      aria-busy="true"
      aria-label="Loading page"
    >
      {/* Nav bar placeholder */}
      <div className="fixed inset-x-0 top-0 z-40 h-16 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-4 w-28" />
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-8 w-20 rounded-md" />
        </div>
      </div>
      <div className="pt-16">{children}</div>
    </div>
  );
}

function TailorSkeleton() {
  return (
    <ShellFrame>
      <div className="mx-auto grid max-w-7xl gap-6 p-4 sm:p-6 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-5">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-48 w-full rounded-lg" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-36" />
          </div>
        </div>
        <div className="space-y-4 lg:col-span-7">
          <Skeleton className="h-5 w-52" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-28 w-full rounded-lg" />
            <Skeleton className="h-28 w-full rounded-lg" />
            <Skeleton className="h-28 w-full rounded-lg" />
            <Skeleton className="h-28 w-full rounded-lg" />
          </div>
          <Skeleton className="h-40 w-full rounded-lg" />
        </div>
      </div>
    </ShellFrame>
  );
}

function LibrarySkeleton() {
  return (
    <ShellFrame>
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-28" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-3 rounded-lg border border-slate-800 p-4">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-5/6" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      </div>
    </ShellFrame>
  );
}

function TrackerSkeleton() {
  return (
    <ShellFrame>
      <div className="mx-auto grid max-w-7xl gap-4 p-4 sm:p-6 lg:grid-cols-12">
        <div className="space-y-3 lg:col-span-4">
          <Skeleton className="h-5 w-32" />
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
        <div className="space-y-4 lg:col-span-8">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-64 w-full rounded-lg" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      </div>
    </ShellFrame>
  );
}

function SettingsSkeleton() {
  return (
    <ShellFrame>
      <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-4 w-64" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-3 rounded-lg border border-slate-800 p-4">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-9 w-28" />
          </div>
        ))}
      </div>
    </ShellFrame>
  );
}

function DefaultSkeleton() {
  return (
    <ShellFrame>
      <div className="mx-auto max-w-5xl space-y-6 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-80" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-40 w-full rounded-lg" />
          <Skeleton className="h-40 w-full rounded-lg" />
          <Skeleton className="h-40 w-full rounded-lg" />
          <Skeleton className="h-40 w-full rounded-lg" />
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
      case "discover":
        return <TrackerSkeleton />;
      case "settings":
        return <SettingsSkeleton />;
      default:
        return <DefaultSkeleton />;
    }
  })();

  if (!className) return body;
  return <div className={className}>{body}</div>;
}
