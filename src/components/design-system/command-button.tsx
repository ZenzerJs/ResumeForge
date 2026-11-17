"use client";

import React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const commandButtonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg text-xs font-semibold transition-[transform,color,background-color,border-color,box-shadow,opacity] duration-150 active:scale-[0.98] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-3.5 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground btn-glow hover:bg-primary/90",
        secondary:
          "border border-hairline bg-rf-surface text-rf-body hover:bg-rf-elevated hover:text-rf-cloud",
        ghost: "text-rf-meta hover:bg-elevated hover:text-rf-cloud",
        success:
          "bg-status-success text-accent-ink shadow shadow-status-success/20 hover:bg-status-success/90",
      },
      size: {
        default: "h-8 px-3",
        sm: "h-7 px-2.5 text-xs",
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
