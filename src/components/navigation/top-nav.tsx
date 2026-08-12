"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/editor", label: "Editor", icon: "edit_note" },
  { href: "/library", label: "Evidence Bank", icon: "database" },
  { href: "/tracker", label: "Jobs", icon: "work" },
  { href: "/tailor", label: "Tailor", icon: "auto_fix_high" },
  { href: "/settings", label: "Settings", icon: "settings" },
] as const;

interface TopNavProps {
  /** Optional right-side action content (e.g. Save as Master button) */
  actions?: React.ReactNode;
  /** Optional extra element beneath logo (e.g. document type badge) */
  badge?: React.ReactNode;
}

function DefaultUtilities() {
  return (
    <>
      <button
        type="button"
        aria-label="Notifications"
        className="text-slate-400 hover:text-[#ff8c00] transition-colors p-2 rounded-full hover:bg-slate-800/50"
      >
        <span className="material-symbols-outlined text-lg" data-icon="notifications">
          notifications
        </span>
      </button>
      <button
        type="button"
        aria-label="Terminal"
        className="text-slate-400 hover:text-[#ff8c00] transition-colors p-2 rounded-full hover:bg-slate-800/50"
      >
        <span className="material-symbols-outlined text-lg" data-icon="terminal">
          terminal
        </span>
      </button>
      <div className="w-8 h-8 rounded-full border border-slate-700 bg-slate-800 flex items-center justify-center text-xs font-bold text-[#ff8c00]">
        <span className="material-symbols-outlined text-sm text-slate-300" data-icon="person">
          person
        </span>
      </div>
    </>
  );
}

export function TopNav({ actions, badge }: TopNavProps) {
  const pathname = usePathname();

  return (
    <header className="bg-[#0b1326]/90 backdrop-blur-xl border-b border-slate-800/80 fixed top-0 w-full z-50 flex items-center justify-between px-6 md:px-12 h-16 max-w-full">
      <div className="flex items-center gap-8">
        <Link href="/" className="flex items-center gap-2.5" aria-label="ResumeForge home">
          <div className="w-8 h-8 bg-[#ff8c00] rounded flex items-center justify-center font-bold text-black text-lg">
            R
          </div>
          <span className="font-extrabold text-xl text-white tracking-[-0.04em]">
            ResumeForge
          </span>
        </Link>

        {badge ? (
          <>
            <span className="hidden sm:block h-4 w-px bg-slate-700" aria-hidden />
            {badge}
          </>
        ) : null}

        <nav
          className="hidden md:flex items-center gap-6 text-sm"
          aria-label="Primary navigation"
        >
          {NAV_LINKS.map(({ href, label, icon }) => {
            const isActive = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "transition-colors flex items-center gap-2 px-3 py-1.5 rounded hover:bg-slate-800/40",
                  isActive
                    ? "text-white bg-slate-800/40"
                    : "text-slate-400 hover:text-white"
                )}
              >
                <span
                  className="material-symbols-outlined text-base"
                  data-icon={icon}
                >
                  {icon}
                </span>
                {label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="flex items-center gap-4 shrink-0">
        {actions ?? <DefaultUtilities />}
      </div>
    </header>
  );
}
