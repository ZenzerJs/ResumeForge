"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface SectionHeadingProps {
  title: string;
  description?: string;
  meta?: React.ReactNode;
  className?: string;
}

export function SectionHeading({
  title,
  description,
  meta,
  className = "",
}: SectionHeadingProps) {
  return (
    <div className={cn("mb-3 flex items-end justify-between gap-3", className)}>
      <div className="min-w-0 space-y-0.5">
        <h2 className="text-sm font-semibold tracking-tight text-rf-cloud">
          {title}
        </h2>
        {description ? (
          <p className="text-xs text-rf-meta">{description}</p>
        ) : null}
      </div>
      {meta ? <div className="shrink-0 text-[11px] font-mono text-rf-meta">{meta}</div> : null}
    </div>
  );
}
