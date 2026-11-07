"use client";

import { useState } from "react";
import { companyLogo } from "./company-logo-registry";
import { cn } from "@/lib/utils";

export function CompanyAvatar({ company, className }: { company?: string | null; className?: string }) {
  const logo = companyLogo(company);
  const [failedLogo, setFailedLogo] = useState<string | null>(null);
  const initial = company?.trim().charAt(0).toUpperCase() || "?";

  return (
    <span aria-hidden="true" className={cn("flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-700 bg-slate-800 text-sm font-bold text-slate-200", className)}>
      {logo && failedLogo !== logo ? (
        // Local curated icons have fixed dimensions and do not require image optimization.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="" className={cn("h-full w-full object-contain", logo.endsWith("/apple.ico") ? "bg-slate-800" : "bg-white")} onError={() => setFailedLogo(logo)} />
      ) : initial}
    </span>
  );
}
