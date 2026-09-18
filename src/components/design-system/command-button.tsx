"use client";

import React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const commandButtonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-3.5 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-amber-500 text-rf-bg shadow shadow-amber-500/20 hover:bg-amber-400",
        secondary:
          "border border-slate-700 bg-rf-surface text-rf-body hover:bg-rf-elevated hover:text-rf-cloud",
        ghost: "text-rf-meta hover:bg-slate-800/60 hover:text-rf-cloud",
        success:
          "bg-emerald-600 text-white shadow shadow-emerald-500/20 hover:bg-emerald-500",
      },
      size: {
        default: "h-8 px-3",
        sm: "h-7 px-2.5 text-[11px]",
        lg: "h-10 px-4 text-sm",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

export interface CommandButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof commandButtonVariants> {}

export const CommandButton = React.forwardRef<
  HTMLButtonElement,
  CommandButtonProps
>(({ className, variant, size, type = "button", ...props }, ref) => (
  <button
    ref={ref}
    type={type}
    className={cn(commandButtonVariants({ variant, size, className }))}
    {...props}
  />
));
CommandButton.displayName = "CommandButton";

export { commandButtonVariants };
