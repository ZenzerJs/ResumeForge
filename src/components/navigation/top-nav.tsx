"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Edit,
  Database,
  Briefcase,
  Sparkles,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/editor", label: "Editor", icon: Edit },
  { href: "/library", label: "Evidence Bank", icon: Database },
  { href: "/tracker", label: "Jobs", icon: Briefcase },
  { href: "/tailor", label: "Tailor", icon: Sparkles },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

interface TopNavProps {
  actions?: React.ReactNode;
  badge?: React.ReactNode;
}

type AuthUser = { id: string; email: string };

async function signOutAndRedirect() {
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } finally {
    window.location.assign("/");
  }
}

function SignOutButton({ className }: { className?: string }) {
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      aria-label="Sign Out"
      onClick={() => {
        setPending(true);
        void signOutAndRedirect();
      }}
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-xs font-medium text-slate-300 hover:bg-slate-800/60 hover:text-white focus-visible:ring-2 focus-visible:ring-amber-500/60 disabled:opacity-50",
        className
      )}
    >
      <LogOut className="h-4 w-4" aria-hidden />
      <span className="hidden sm:inline">Sign Out</span>
    </button>
  );
}

function GuestAuthLinks({ className }: { className?: string }) {
  return (
    <div className={cn("hidden md:flex items-center gap-1", className)}>
      <Link
        href="/login"
        className="inline-flex min-h-11 items-center rounded-md px-3 text-xs font-medium text-slate-300 hover:bg-slate-800/60 hover:text-white focus-visible:ring-2 focus-visible:ring-amber-500/60"
      >
        Sign In
      </Link>
      <Link
        href="/login?mode=signup"
        className="inline-flex min-h-11 items-center rounded-md bg-[#ff8c00] px-3 text-xs font-semibold text-black hover:bg-[#ffa024] focus-visible:ring-2 focus-visible:ring-amber-500/60"
      >
        Sign Up
      </Link>
    </div>
  );
}

export function TopNav({ actions, badge }: TopNavProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);
  const drawerRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/auth/me")
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        setUser(json?.data ?? null);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const drawer = drawerRef.current;
    const focusable = drawer?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled])'
    );
    focusable?.[0]?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileOpen(false);
        return;
      }
      if (event.key !== "Tab" || !focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  const isGuest = user === null;

  return (
    <header className="bg-[#0b1326]/90 backdrop-blur-xl border-b border-slate-800/80 fixed top-0 w-full z-50 flex items-center justify-between gap-3 px-4 md:px-8 h-16 pt-[env(safe-area-inset-top)] max-w-full overflow-x-auto">
      <div className="flex items-center gap-8 min-w-0">
        <Link
          href="/"
          className="flex items-center gap-2.5 focus-visible:ring-2 focus-visible:ring-amber-500/60 rounded"
          aria-label="ResumeForge home"
        >
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
          {NAV_LINKS.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "transition-colors flex items-center gap-2 px-3 py-1.5 rounded hover:bg-slate-800/40 focus-visible:ring-2 focus-visible:ring-amber-500/60",
                  isActive
                    ? "text-white bg-slate-800/40"
                    : "text-slate-400 hover:text-white"
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="flex items-center gap-2 shrink-0 min-w-0">
        <button
          type="button"
          className="md:hidden inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-slate-300 hover:bg-slate-800/60 focus-visible:ring-2 focus-visible:ring-amber-500/60"
          aria-expanded={mobileOpen}
          aria-controls={menuId}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          onClick={() => setMobileOpen((open) => !open)}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        {actions}
        {user ? (
          <>
            <span className="hidden lg:inline max-w-[12rem] truncate text-xs text-slate-400" title={user.email}>
              {user.email}
            </span>
            <SignOutButton className="hidden md:inline-flex" />
          </>
        ) : isGuest ? (
          <GuestAuthLinks />
        ) : null}
      </div>

      {mobileOpen ? (
        <div
          id={menuId}
          ref={drawerRef}
          className="absolute left-0 right-0 top-16 border-b border-slate-800 bg-[#0b1326] px-6 py-4 md:hidden overscroll-contain"
        >
          <nav aria-label="Mobile navigation" className="flex flex-col gap-1">
            {NAV_LINKS.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-amber-500/60",
                    isActive ? "bg-slate-800/60 text-white" : "text-slate-300 hover:bg-slate-800/40"
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {label}
                </Link>
              );
            })}
            {user ? (
              <button
                type="button"
                className="mt-2 flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-slate-800/40 focus-visible:ring-2 focus-visible:ring-amber-500/60"
                onClick={() => {
                  void signOutAndRedirect();
                }}
              >
                <LogOut className="h-4 w-4" aria-hidden />
                Sign Out
              </button>
            ) : (
              <>
                <Link
                  href="/login"
                  className="mt-2 flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-slate-800/40 focus-visible:ring-2 focus-visible:ring-amber-500/60"
                >
                  Sign In
                </Link>
                <Link
                  href="/login?mode=signup"
                  className="flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm text-amber-400 hover:bg-slate-800/40 focus-visible:ring-2 focus-visible:ring-amber-500/60"
                >
                  Sign Up
                </Link>
              </>
            )}
          </nav>
        </div>
      ) : null}
    </header>
  );
}
