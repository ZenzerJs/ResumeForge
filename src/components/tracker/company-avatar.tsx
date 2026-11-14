"use client";

import { useState } from "react";
import { companyLogo } from "./company-logo-registry";
import { BrandIcon, hasBrandIcon } from "@/components/design-system/brand-icon";
import { cn } from "@/lib/utils";

export function CompanyAvatar({ company, className }: { company?: string | null; className?: string }) {
  const logo = companyLogo(company);
  const [failedLogo, setFailedLogo] = useState<string | null>(null);
  const initial = company?.trim().charAt(0).toUpperCase() || "?";
  const showLogo = Boolean(logo && failedLogo !== logo);

  return (
    <span aria-hidden="true" className={cn("flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-hairline bg-elevated text-sm font-bold text-foreground", className)}>
      {showLogo ? (
        // Local curated icons have fixed dimensions and do not require image optimization.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo!} alt="" className={cn("h-full w-full object-contain", logo!.endsWith("/apple.ico") ? "bg-elevated" : "bg-white")} onError={() => setFailedLogo(logo)} />
      ) : !logo && hasBrandIcon(company) ? (
        <BrandIcon name={company} className="h-4 w-4 text-text-secondary" />
      ) : initial}
    </span>
  );
}
