"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  statusBadge?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  statusBadge,
  className = "",
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "enter-once relative flex min-w-0 flex-col gap-4 rounded-xl surface-raised edge-glow p-4 sm:p-6 md:flex-row md:items-center md:justify-between",
        className,
      )}
    >
      <div className="min-w-0 flex-1 space-y-1.5 border-l-2 border-primary pl-3 sm:pl-4">
        {eyebrow ? (
          <div className="inline-flex max-w-full w-fit items-center gap-2 rounded-full border border-hairline bg-inset/80 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-text-secondary">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
            <span className="truncate">{eyebrow}</span>
          </div>
        ) : null}
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
          <h1 className="min-w-0 break-words text-balance text-xl font-bold tracking-tight text-rf-cloud md:text-2xl">
            {title}
          </h1>
          {statusBadge ? <div className="max-w-full shrink-0">{statusBadge}</div> : null}
        </div>
        {description ? (
          <p className="max-w-2xl break-words font-sans text-sm text-rf-meta">
            {description}
          </p>
        ) : null}
      </div>

      {actions ? (
        <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2.5 md:max-w-[50%] md:justify-end xl:max-w-[75%]">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
