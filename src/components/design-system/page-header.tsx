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
        "enter-once relative flex flex-col gap-4 rounded-xl surface-raised edge-glow p-5 sm:p-6 md:flex-row md:items-center md:justify-between",
        className,
      )}
    >
      <div className="space-y-1.5 border-l-2 border-primary pl-3 sm:pl-4">
        {eyebrow ? (
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-hairline bg-inset/80 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
            <span>{eyebrow}</span>
          </div>
        ) : null}
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold tracking-tight text-rf-cloud md:text-2xl">
            {title}
          </h1>
          {statusBadge}
        </div>
        {description ? (
          <p className="max-w-2xl font-sans text-xs text-rf-meta md:text-sm">
            {description}
          </p>
        ) : null}
      </div>

      {actions ? (
        <div className="flex shrink-0 items-center gap-2.5">{actions}</div>
      ) : null}
    </div>
  );
}
