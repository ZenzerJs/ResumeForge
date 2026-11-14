"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface SurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "primary" | "raised" | "elevated" | "flat" | "transparent" | "glass";
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
    primary: "surface-raised",
    raised: "surface-raised",
    elevated: "bg-popover border border-outline/70 shadow-[var(--shadow-2)]",
    flat: "bg-background border border-border",
    transparent: "bg-surface-container-lowest/60 border border-border/60 backdrop-blur-sm",
    glass: "glass-bar border",
  };

  return (
    <div
      className={cn("rounded-[10px]", variantStyles[variant], className)}
      {...props}
    >
      {children}
    </div>
  );
}
