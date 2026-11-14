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
    primary: "bg-card border border-border shadow-md",
    elevated: "bg-popover border border-outline/70 shadow-lg",
    flat: "bg-background border border-border",
    transparent: "bg-surface-container-lowest/60 border border-border/60 backdrop-blur-sm",
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
