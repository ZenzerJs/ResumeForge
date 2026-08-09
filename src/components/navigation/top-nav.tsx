"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, Database, Sparkles, Briefcase, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  {
    href: "/editor",
    label: "Editor",
    icon: FileText,
    accent: "text-amber-400",
    hoverBg: "hover:bg-amber-500/8",
  },
  {
    href: "/library",
    label: "Evidence Bank",
    icon: Database,
    accent: "text-emerald-400",
    hoverBg: "hover:bg-emerald-500/8",
  },
  {
    href: "/tracker",
    label: "Jobs",
    icon: Briefcase,
    accent: "text-amber-400",
    hoverBg: "hover:bg-amber-500/8",
  },
  {
    href: "/tailor",
    label: "Tailor",
    icon: Sparkles,
    accent: "text-amber-400",
    hoverBg: "hover:bg-amber-500/8",
  },
  {
    href: "/settings",
    label: "Settings",
    icon: Settings,
    accent: "text-amber-400",
    hoverBg: "hover:bg-amber-500/8",
  },
];

interface TopNavProps {
  /** Optional right-side action content (e.g. Save as Master button) */
  actions?: React.ReactNode;
  /** Optional extra element beneath logo (e.g. document type badge) */
  badge?: React.ReactNode;
}

export function TopNav({ actions, badge }: TopNavProps) {
  const pathname = usePathname();

  return (
    <header
      className="sticky top-0 z-50 flex shrink-0 items-center justify-between border-b border-slate-800/80 bg-rf-bg/92 px-4 backdrop-blur-md md:px-6"
      style={{ height: "52px" }}
    >
      {/* Left: Logo + Badge */}
      <div className="flex items-center gap-3 shrink-0">
        <Link
          href="/"
          className="flex items-center gap-2.5 group outline-none"
          aria-label="ResumeForge home"
        >
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg font-bold text-sm transition-all"
            style={{
              background: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)",
              color: "var(--rf-bg)",
              boxShadow: "0 0 12px rgba(245,158,11,0.3)",
            }}
          >
            R
          </div>
          <span className="hidden sm:block text-sm font-semibold tracking-tight text-white/90 group-hover:text-white transition-colors">
            Resume<span className="text-amber-400">Forge</span>
          </span>
        </Link>

        {badge && (
          <>
            <span className="hidden sm:block h-4 w-px" style={{ backgroundColor: "#1E2536" }} aria-hidden />
            {badge}
          </>
        )}
      </div>

      {/* Center: Nav Links */}
      <nav
        className="hidden md:flex items-center gap-0.5 text-xs font-medium absolute left-1/2 -translate-x-1/2"
        aria-label="Primary navigation"
      >
        {NAV_LINKS.map(({ href, label, icon: Icon, accent, hoverBg }) => {
          const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50",
                hoverBg,
                isActive
                  ? "bg-slate-800/80 text-white border border-slate-700/60"
                  : "text-slate-400 hover:text-slate-100"
              )}
            >
              <Icon
                className={cn("h-3.5 w-3.5 transition-colors", isActive ? accent : "text-current")}
              />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Right: Actions */}
      <div className="flex items-center gap-2 shrink-0">
        {actions}
      </div>
    </header>
  );
}
