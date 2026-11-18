import React from "react";
import { cn } from "@/lib/utils";

export interface BrandMarkProps {
  compact?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
  showText?: boolean;
  textClassName?: string;
}

export function BrandMark({
  compact = false,
  size,
  className,
  showText = true,
  textClassName,
}: BrandMarkProps) {
  const resolvedSize = size ?? (compact ? "sm" : "md");

  const badgeSizeClass =
    resolvedSize === "sm"
      ? "w-7 h-7 text-sm"
      : resolvedSize === "lg"
      ? "w-9 h-9 text-xl"
      : "w-8 h-8 text-lg";

  const textSizeClass =
    resolvedSize === "sm"
      ? "text-sm"
      : resolvedSize === "lg"
      ? "text-2xl"
      : "text-xl tracking-[-0.04em]";

  return (
    <div className={cn("inline-flex items-center gap-2.5 min-w-0", className)}>
      <span
        aria-hidden="true"
        className={cn(
          "shrink-0 rounded-[8px] flex items-center justify-center font-bold text-primary-foreground select-none",
          badgeSizeClass
        )}
        style={{
          background: "linear-gradient(135deg, rgb(var(--accent-action)), rgb(var(--accent-secondary)))",
          boxShadow: "0 0 0 1px rgb(255 255 255 / 0.12) inset, 0 6px 20px rgb(var(--accent-action) / 0.35)",
        }}
      >
        R
      </span>
      {showText && (
        <span
          className={cn(
            "truncate font-bold text-foreground",
            textSizeClass,
            textClassName
          )}
        >
          ResumeForge
        </span>
      )}
    </div>
  );
}
