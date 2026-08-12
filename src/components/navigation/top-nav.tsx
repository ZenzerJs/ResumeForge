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
      className="bg-background/80 backdrop-blur-xl border-b border-outline-variant shadow-[0_0_20px_rgba(255,140,0,0.05)] fixed top-0 w-full z-50 flex items-center justify-between px-margin-desktop h-16 max-w-full"
    >
      {/* Left: Logo + Badge */}
      <div className="flex items-center gap-4 shrink-0">
        <Link
          href="/"
          className="flex items-center gap-2 group outline-none"
          aria-label="ResumeForge home"
        >
          <div
            className="w-8 h-8 rounded bg-primary flex items-center justify-center font-bold text-on-primary text-sm shadow-[0_0_12px_rgba(255,140,0,0.3)] transition-transform group-hover:scale-105"
          >
            R
          </div>
          <span className="font-page-title text-[22px] text-primary tracking-tighter transition-colors">
            ResumeForge
          </span>
        </Link>

        {badge && (
          <>
            <span className="hidden sm:block h-4 w-px bg-outline-variant" aria-hidden />
            {badge}
          </>
        )}
      </div>

      {/* Center: Nav Links */}
      <nav
        className="hidden md:flex items-center gap-1 text-sm font-body-regular"
        aria-label="Primary navigation"
      >
        {NAV_LINKS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded transition-all duration-200 active:scale-95",
                isActive
                  ? "text-primary font-bold border-b-2 border-primary bg-surface-variant/20"
                  : "text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/50"
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Right: Actions */}
      <div className="flex items-center gap-4 shrink-0">
        {actions}
      </div>
    </header>
  );
}
