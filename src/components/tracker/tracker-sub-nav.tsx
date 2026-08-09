"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Briefcase, Loader2, RefreshCw, Compass } from "lucide-react";
import { cn } from "@/lib/utils";

interface TrackerSubNavProps {
  /** Right-side action (sync / refresh). */
  actions?: React.ReactNode;
}

export function TrackerSubNav({ actions }: TrackerSubNavProps) {
  const pathname = usePathname();
  const isFeed = pathname === "/tracker/feed" || pathname.startsWith("/tracker/feed/");
  const isApplied = pathname.startsWith("/tracker/applied");
  const isSaved = pathname.startsWith("/tracker/saved");
  const isAll = pathname === "/tracker" || pathname === "/tracker/";

  const linkClass = (active: boolean) =>
    cn(
      "flex h-full items-center border-b-2 px-3 text-xs font-medium transition-colors",
      active
        ? "border-amber-500 text-amber-400"
        : "border-transparent text-slate-400 hover:text-slate-200",
    );

  return (
    <div className="sticky top-[52px] z-10 border-b border-slate-800 bg-slate-950/80 backdrop-blur">
      <div className="mx-auto flex h-11 max-w-6xl items-center justify-between px-4">
        <div className="flex h-full items-center gap-1 sm:gap-3">
          <h1
            data-testid="tracker-page-title"
            className="flex shrink-0 items-center gap-1.5 border-r border-slate-800 pr-3 text-xs font-bold text-slate-100"
          >
            <Briefcase className="h-3.5 w-3.5 text-amber-400" />
            Jobs
          </h1>
          <Link
            href="/tracker/feed"
            className={linkClass(isFeed)}
            data-testid="tracker-tab-feed"
          >
            <Compass className="mr-1 h-3.5 w-3.5" />
            Feed
          </Link>
          <Link href="/tracker" className={linkClass(isAll)} data-testid="tracker-tab-all">
            All
          </Link>
          <Link
            href="/tracker/applied"
            className={linkClass(isApplied)}
            data-testid="tracker-tab-applied"
          >
            Applied
          </Link>
          <Link
            href="/tracker/saved"
            className={linkClass(isSaved)}
            data-testid="tracker-tab-saved"
          >
            Saved
          </Link>
        </div>

        <div className="flex items-center gap-2">{actions}</div>
      </div>
    </div>
  );
}

export function TrackerRefreshButton({
  onClick,
  isImporting,
}: {
  onClick: () => void;
  isImporting: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isImporting}
      data-testid="refresh-from-source-btn"
      className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-amber-400 transition hover:bg-slate-800 disabled:opacity-50"
      title="Manual refresh: Bulk import Tier 1 postings from SimplifyJobs source"
    >
      {isImporting ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <RefreshCw className="h-3.5 w-3.5" />
      )}
      <span className="hidden sm:inline">
        {isImporting ? "Refreshing..." : "Refresh from Source"}
      </span>
    </button>
  );
}
