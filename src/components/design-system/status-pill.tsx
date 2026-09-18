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
    amber: "bg-amber-950/60 border-amber-800/60 text-amber-300",
    emerald: "bg-emerald-950/60 border-emerald-800/60 text-emerald-300",
    slate: "bg-slate-900/80 border-slate-800/80 text-slate-300",
    cyan: "bg-cyan-950/60 border-cyan-800/60 text-cyan-300",
    red: "bg-red-950/60 border-red-800/60 text-red-300",
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
