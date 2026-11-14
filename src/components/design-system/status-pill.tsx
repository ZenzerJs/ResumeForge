"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface StatusPillProps {
  status?: "amber" | "emerald" | "slate" | "cyan" | "red";
  label: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export function StatusPill({
  status = "slate",
  label,
  icon,
  className = "",
}: StatusPillProps) {
  const styles = {
    amber: "bg-primary/15 border-primary/40 text-primary",
    emerald: "bg-status-success/15 border-status-success/40 text-status-success",
    slate: "bg-panel border-hairline text-text-secondary",
    cyan: "bg-signal/15 border-signal/40 text-signal",
    red: "bg-status-danger/15 border-status-danger/40 text-status-danger",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-mono font-medium",
        styles[status],
        className,
      )}
    >
      {icon}
      <span>{label}</span>
    </span>
  );
}
