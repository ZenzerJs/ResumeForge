"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Briefcase, Loader2, RefreshCw, Compass, LayoutList, Send, Bookmark, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

interface TrackerSubNavProps {
  /** Right-side action (sync / refresh). */
  actions?: React.ReactNode;
}

let lastIndicatorRect: { left: number; width: number } | null = null;

export function TrackerSubNav({ actions }: TrackerSubNavProps) {
  const pathname = usePathname();
  const navListRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(
    () => lastIndicatorRect,
  );
  const [animateIndicator, setAnimateIndicator] = useState(() => lastIndicatorRect !== null);

  const isFeed = pathname === "/tracker/feed" || pathname.startsWith("/tracker/feed/");
  const isApplied = pathname.startsWith("/tracker/applied");
  const isSaved = pathname.startsWith("/tracker/saved");
  const isOutcomes = pathname.startsWith("/tracker/outcomes");
  const isAll = pathname === "/tracker" || pathname === "/tracker/";

  useEffect(() => {
    const container = navListRef.current;
    if (!container) return;
    const activeEl = container.querySelector<HTMLElement>('[aria-current="page"]');
    if (!activeEl) return;
    const next = { left: activeEl.offsetLeft, width: activeEl.offsetWidth };
    lastIndicatorRect = next;
    setIndicator(next);
    if (!animateIndicator) {
      const id = requestAnimationFrame(() => setAnimateIndicator(true));
      return () => cancelAnimationFrame(id);
    }
  }, [pathname, animateIndicator]);

  const linkClass = (active: boolean) =>
    cn(
      "relative flex shrink-0 items-center whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
      active
        ? "bg-primary/15 border border-primary/40 text-primary"
        : "border border-transparent text-muted-foreground hover:bg-elevated/80 hover:text-foreground",
    );

  return (
    <div className="sticky top-0 z-20 shrink-0 border-b glass-bar">
      <div className="flex h-11 items-center justify-between gap-2 px-3 sm:px-4">
        <div
          ref={navListRef}
          className="relative flex h-full min-w-0 flex-1 items-center gap-1 overflow-x-auto sm:gap-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <span
            aria-hidden="true"
            data-testid="tracker-sub-nav-indicator"
            className={cn(
              "pointer-events-none absolute bottom-0 left-0 h-[2px] w-px origin-left rounded-full ombre-bar motion-reduce:transition-none",
              animateIndicator ? "transition-transform duration-200 ease-out" : "",
            )}
            style={
              indicator
                ? { transform: `translateX(${indicator.left}px) scaleX(${indicator.width})`, opacity: 1 }
                : { opacity: 0 }
            }
          />
          <h1
            data-testid="tracker-page-title"
            className="flex shrink-0 items-center gap-1.5 border-r border-hairline pr-2.5 sm:pr-3 text-xs font-bold text-foreground"
          >
            <Briefcase className="h-3.5 w-3.5 text-primary" />
            Jobs
          </h1>
          <Link
            href="/tracker/feed"
            className={linkClass(isFeed)}
            aria-current={isFeed ? "page" : undefined}
            data-testid="tracker-tab-feed"
          >
            <Compass className="mr-1 h-3.5 w-3.5" />
            Discover / Feed
          </Link>
          <Link href="/tracker" className={linkClass(isAll)} aria-current={isAll ? "page" : undefined} data-testid="tracker-tab-all">
            <LayoutList className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
            All Applications
          </Link>
          <Link
            href="/tracker/applied"
            className={linkClass(isApplied)}
            aria-current={isApplied ? "page" : undefined}
            data-testid="tracker-tab-applied"
          >
            <Send className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
            Applied
          </Link>
          <Link
            href="/tracker/saved"
            className={linkClass(isSaved)}
            aria-current={isSaved ? "page" : undefined}
            data-testid="tracker-tab-saved"
          >
            <Bookmark className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
            Saved
          </Link>
          <Link
            href="/tracker/outcomes"
            className={linkClass(isOutcomes)}
            aria-current={isOutcomes ? "page" : undefined}
            data-testid="tracker-tab-outcomes"
          >
            <BarChart3 className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
            Outcomes
          </Link>
        </div>

        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      </div>
    </div>
  );
}

export function TrackerRefreshButton({
  onClick,
  isImporting,
  lastSyncAt,
}: {
  onClick: () => void;
  isImporting: boolean;
  lastSyncAt?: string | null;
}) {
  const syncLabel = lastSyncAt
    ? `Last sync ${new Date(lastSyncAt).toLocaleString()}`
    : "No connector sync yet";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isImporting}
      aria-label={isImporting ? "Refreshing from source" : "Refresh from source"}
      data-testid="refresh-from-source-btn"
      className="flex min-h-9 items-center gap-1.5 rounded-lg border border-hairline bg-inset px-2.5 sm:px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:bg-elevated hover:text-foreground disabled:opacity-50"
      title={syncLabel}
    >
      {isImporting ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
      ) : (
        <RefreshCw className="h-3.5 w-3.5 text-primary" />
      )}
      <span className="hidden sm:inline">
        {isImporting ? "Refreshing…" : "Refresh from Source"}
      </span>
      {lastSyncAt ? (
        <span className="hidden xl:inline text-[11px] font-normal text-muted-foreground">
          {new Date(lastSyncAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
        </span>
      ) : null}
    </button>
  );
}
