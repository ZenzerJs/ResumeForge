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
        "flex flex-col gap-4 border-b border-slate-800/80 pb-6 md:flex-row md:items-center md:justify-between",
        className,
      )}
    >
      <div className="space-y-1">
        {eyebrow ? (
          <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-amber-400">
            {eyebrow}
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
