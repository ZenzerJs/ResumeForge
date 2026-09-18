"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Surface } from "./surface";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <Surface
      variant="flat"
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-12 text-center",
        className,
      )}
      data-testid="empty-state"
    >
      {icon ? (
        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-800 bg-rf-surface text-amber-400">
          {icon}
        </div>
      ) : null}
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-rf-cloud">{title}</h3>
        {description ? (
          <p className="max-w-sm text-xs text-rf-meta">{description}</p>
        ) : null}
      </div>
      {action}
    </Surface>
  );
}
