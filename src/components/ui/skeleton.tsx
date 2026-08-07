import * as React from "react";
import { cn } from "@/lib/utils";

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-md bg-slate-800/60 skeleton-pulse",
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };
