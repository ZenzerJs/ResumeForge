"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface SurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "primary" | "elevated" | "flat" | "transparent";
  className?: string;
  children: React.ReactNode;
}

export function Surface({
  variant = "primary",
  className = "",
  children,
  ...props
}: SurfaceProps) {
  const variantStyles = {
    primary: "bg-rf-surface border border-slate-800/80 shadow-md",
    elevated: "bg-rf-elevated border border-slate-700/60 shadow-lg",
    flat: "bg-rf-bg border border-slate-800/60",
    transparent: "bg-slate-950/40 border border-slate-800/40 backdrop-blur-sm",
  };

  return (
    <div
      className={cn("rounded-xl", variantStyles[variant], className)}
      {...props}
    >
      {children}
    </div>
  );
}
