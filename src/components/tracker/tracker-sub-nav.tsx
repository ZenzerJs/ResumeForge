"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
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
  const [canScrollRight, setCanScrollRight] = useState(false);

  const isFeed = pathname === "/tracker/feed" || pathname.startsWith("/tracker/feed/");
  const isApplied = pathname.startsWith("/tracker/applied");
  const isSaved = pathname.startsWith("/tracker/saved");
  const isOutcomes = pathname.startsWith("/tracker/outcomes");
  const isAll = pathname === "/tracker" || pathname === "/tracker/";

  const updateScrollCue = useCallback(() => {
    const container = navListRef.current;
    if (!container) return;
    setCanScrollRight(container.scrollLeft + container.clientWidth < container.scrollWidth - 2);
  }, []);

  const measureIndicator = useCallback(() => {
    const container = navListRef.current;
    if (!container) return;
    const activeEl = container.querySelector<HTMLElement>('[aria-current="page"]');
    if (!activeEl) return;
    const next = { left: activeEl.offsetLeft, width: activeEl.offsetWidth };
    lastIndicatorRect = next;
    setIndicator(next);
  }, []);

  useEffect(() => {
    const container = navListRef.current;
    if (!container) return;
    const activeEl = container.querySelector<HTMLElement>('[aria-current="page"]');
    measureIndicator();
    updateScrollCue();
    if (activeEl && typeof activeEl.scrollIntoView === "function") {
      activeEl.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
    if (!animateIndicator) {
      const id = requestAnimationFrame(() => setAnimateIndicator(true));
      return () => cancelAnimationFrame(id);
    }
  }, [pathname, animateIndicator, measureIndicator, updateScrollCue]);

  useEffect(() => {
    const container = navListRef.current;
    if (!container) return;

    const handleSync = () => {
      measureIndicator();
      updateScrollCue();
    };

    container.addEventListener("scroll", updateScrollCue, { passive: true });
    window.addEventListener("resize", handleSync);

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(handleSync);
      observer.observe(container);
      const activeEl = container.querySelector<HTMLElement>('[aria-current="page"]');
      if (activeEl) observer.observe(activeEl);
    }

    if (typeof document !== "undefined" && document.fonts?.ready) {
      void document.fonts.ready.then(handleSync);
    }

    return () => {
      container.removeEventListener("scroll", updateScrollCue);
      window.removeEventListener("resize", handleSync);
      observer?.disconnect();
    };
  }, [pathname, measureIndicator, updateScrollCue]);

  const linkClass = (active: boolean) =>
    cn(
      "relative flex shrink-0 items-center whitespace-nowrap rounded-lg px-2 py-1.5 sm:px-3 min-h-11 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
      active
        ? "bg-primary/15 border border-primary/40 text-primary"
        : "border border-transparent text-muted-foreground hover:bg-elevated/80 hover:text-foreground",
    );

  return (
    <div className="sticky top-0 z-20 shrink-0 border-b glass-bar">
      <div className="flex min-h-11 items-center justify-between gap-1.5 px-2.5 sm:gap-2 sm:px-4">
        <div className="relative min-w-0 flex-1 h-full">
          <div
            ref={navListRef}
            className="relative flex h-full min-w-0 items-center gap-1 overflow-x-auto pr-6 sm:gap-3 sm:pr-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <span
              aria-hidden="true"
              data-testid="tracker-sub-nav-indicator"
              className={cn(
                "pointer-events-none absolute bottom-0 left-0 h-[2px] rounded-full ombre-bar motion-reduce:transition-none",
                animateIndicator ? "transition-[transform,width] duration-200 ease-out" : "",
              )}
              style={
                indicator
                  ? {
                      transform: `translateX(${indicator.left}px)`,
                      width: `${indicator.width}px`,
                      opacity: 1,
                    }
                  : { opacity: 0 }
              }
            />
            <h1
              data-testid="tracker-page-title"
              className="flex shrink-0 items-center gap-1 border-r border-hairline pr-1.5 sm:gap-1.5 sm:pr-3 text-xs font-bold text-foreground"
            >
              <Briefcase className="hidden sm:inline-block h-3.5 w-3.5 text-primary" aria-hidden="true" />
              Jobs
            </h1>
            <Link
              href="/tracker/feed"
              className={linkClass(isFeed)}
              aria-current={isFeed ? "page" : undefined}
              aria-label="Discover / Feed"
              data-testid="tracker-tab-feed"
            >
              <Compass className="hidden sm:inline-block mr-1 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="sm:hidden">Discover</span>
              <span className="hidden sm:inline">Discover / Feed</span>
            </Link>
            <Link
              href="/tracker"
              className={linkClass(isAll)}
              aria-current={isAll ? "page" : undefined}
              aria-label="All Applications"
              data-testid="tracker-tab-all"
            >
              <LayoutList className="hidden sm:inline-block mr-1 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="sm:hidden">All</span>
              <span className="hidden sm:inline">All Applications</span>
            </Link>
            <Link
              href="/tracker/applied"
              className={linkClass(isApplied)}
              aria-current={isApplied ? "page" : undefined}
              data-testid="tracker-tab-applied"
            >
              <Send className="hidden sm:inline-block mr-1 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Applied
            </Link>
            <Link
              href="/tracker/saved"
              className={linkClass(isSaved)}
              aria-current={isSaved ? "page" : undefined}
              data-testid="tracker-tab-saved"
            >
              <Bookmark className="hidden sm:inline-block mr-1 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Saved
            </Link>
            <Link
              href="/tracker/outcomes"
              className={linkClass(isOutcomes)}
              aria-current={isOutcomes ? "page" : undefined}
              data-testid="tracker-tab-outcomes"
            >
              <BarChart3 className="hidden sm:inline-block mr-1 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Outcomes
            </Link>
          </div>
          {canScrollRight ? (
            <div
              aria-hidden="true"
              data-testid="tracker-sub-nav-scroll-fade"
              className="pointer-events-none absolute inset-y-0 right-0 z-10 w-6 bg-gradient-to-l from-panel via-panel/85 to-transparent"
            />
          ) : null}
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
      aria-haspopup="dialog"
      aria-label={isImporting ? "Refreshing from source" : "Refresh from source"}
      data-testid="refresh-from-source-btn"
      className="flex min-h-9 items-center gap-1.5 rounded-lg border border-hairline bg-inset px-2.5 sm:px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:bg-elevated hover:text-foreground disabled:opacity-50"
      title={syncLabel}
    >
      {isImporting ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" aria-hidden="true" />
      ) : (
        <RefreshCw className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
      )}
      <span className="hidden sm:inline">
        {isImporting ? "Refreshing…" : "Refresh from Source"}
      </span>
      {lastSyncAt ? (
        <span className="hidden xl:inline text-xs font-normal text-muted-foreground">
          {new Date(lastSyncAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
        </span>
      ) : null}
    </button>
  );
}
