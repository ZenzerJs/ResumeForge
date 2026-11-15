"use client";

import React, { useEffect, useId, useState } from "react";
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
  Code2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandIcon, hasBrandIcon } from "@/components/design-system/brand-icon";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  fetchDemoConfig,
  fetchSessionUser,
  signOutAndRedirect,
  usernameInitial,
  type SessionUser,
} from "@/components/auth/session-user";
import { getActiveConfig } from "@/lib/byok-vault";

const NAV_LINKS = [
  { href: "/editor", label: "Editor", icon: Edit },
  { href: "/library", label: "Evidence Bank", icon: Database },
  { href: "/tracker", label: "Jobs", icon: Briefcase },
  { href: "/tailor", label: "Tailor", icon: Sparkles },
  { href: "/practice", label: "Practice", icon: Code2 },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

interface TopNavProps {
  actions?: React.ReactNode;
  badge?: React.ReactNode;
  compact?: boolean;
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
        "inline-flex min-h-11 items-center gap-2 rounded-[6px] px-3 text-xs text-on-surface-variant hover:bg-elevated hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50",
        className
      )}
    >
      <LogOut className="h-4 w-4" aria-hidden />
      <span className="hidden sm:inline">Sign Out</span>
    </button>
  );
}

function GuestAuthLinks({ className, signupEnabled }: { className?: string; signupEnabled: boolean }) {
  return (
    <div className={cn("hidden md:flex items-center gap-2", className)}>
      <Link
        href="/login"
        className="inline-flex min-h-9 items-center rounded-[7px] border border-outline/80 bg-transparent px-3.5 text-xs font-medium text-foreground/90 transition-colors hover:border-outline hover:bg-elevated/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        Sign In
      </Link>
      {signupEnabled ? <Link
        href="/login?mode=signup"
        className="inline-flex min-h-9 items-center rounded-[7px] bg-primary px-3.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        Sign Up
      </Link> : null}
    </div>
  );
}

function NavUtilities({ pathname }: { pathname: string }) {
  const [aiStatus, setAiStatus] = useState<{ provider: string; hasKey: boolean } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getActiveConfig()
      .then((cfg) => {
        if (!cancelled) {
          setAiStatus({ provider: cfg.provider, hasKey: cfg.hasKey });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return (
    <div className="hidden md:flex items-center gap-1.5">
      {aiStatus && (
        <Link
          href="/settings"
          data-testid="nav-ai-status-pill"
          title={
            aiStatus.hasKey
              ? `AI Connected (${aiStatus.provider.toUpperCase()}) — Click to manage in Settings`
              : "No AI API key configured — Click to connect in Settings"
          }
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            aiStatus.hasKey
              ? "border-signal/35 bg-signal/10 text-signal hover:bg-signal/20"
              : "border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
          )}
        >
          {aiStatus.hasKey && hasBrandIcon(aiStatus.provider) ? (
            <BrandIcon name={aiStatus.provider} className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden />
          )}
          <span className="hidden xl:inline">
            {aiStatus.hasKey ? `AI · ${aiStatus.provider.toUpperCase()}` : "Connect AI Key"}
          </span>
          <span className="xl:hidden">
            {aiStatus.hasKey ? aiStatus.provider.toUpperCase() : "AI Key"}
          </span>
        </Link>
      )}
    </div>
  );
}

export function TopNav({ actions, badge, compact = false }: TopNavProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);
  const [signupEnabled, setSignupEnabled] = useState(true);
  const menuId = useId();
  const mobileMenuTriggerRef = React.useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchDemoConfig().then((config) => {
      if (!cancelled && config?.signupEnabled === false) setSignupEnabled(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchSessionUser().then((next) => {
      if (!cancelled) setUser(next);
    });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const isGuest = user === null;

  return (
    <header className={`bg-rf-bg/90 backdrop-blur-xl border-b border-border fixed top-0 w-full z-50 flex items-center justify-between gap-3 pt-[env(safe-area-inset-top)] max-w-full overflow-visible ${compact ? "h-12 px-4 md:px-6" : "h-16 px-4 md:px-8"}`}>
      <div className={`flex items-center min-w-0 ${compact ? "gap-6" : "gap-8"}`}>
        <Link
          href="/"
          className="flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-[6px]"
          aria-label="ResumeForge home"
        >
          <div
            className={`rounded-[8px] flex items-center justify-center font-bold text-primary-foreground ${compact ? "w-7 h-7 text-base" : "w-8 h-8 text-lg"}`}
            style={{
              background: "linear-gradient(135deg, rgb(var(--accent-action)), rgb(var(--accent-secondary)))",
              boxShadow: "0 0 0 1px rgb(255 255 255 / 0.12) inset, 0 6px 20px rgb(var(--accent-action) / 0.35)",
            }}
          >
            R
          </div>
          <span className="font-bold text-xl text-foreground tracking-[-0.04em]">
            ResumeForge
          </span>
        </Link>

        {badge ? (
          <>
            <span className="hidden sm:block h-4 w-px bg-border" aria-hidden />
            {badge}
          </>
        ) : null}
      </div>

      <nav
        className="hidden md:flex flex-1 items-center justify-center gap-1 lg:gap-2 text-sm"
        aria-label="Primary navigation"
      >
        {NAV_LINKS.map(({ href, label }) => {
          const isActive = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              title={label}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "whitespace-nowrap rounded-[6px] px-3 py-1.5 text-[13px] transition-colors border border-transparent hover:bg-elevated/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                isActive
                  ? "bg-primary/10 text-primary border-primary/30 font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-2 shrink-0 min-w-0">
        <button
          ref={mobileMenuTriggerRef}
          type="button"
          className="md:hidden inline-flex min-h-11 min-w-11 items-center justify-center rounded-[6px] text-on-surface-variant hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          aria-expanded={mobileOpen}
          aria-controls={mobileOpen ? menuId : undefined}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          onClick={() => setMobileOpen((open) => !open)}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        {actions}
        <NavUtilities pathname={pathname} />
        {user ? (
          <>
            <Link
              href="/settings"
              title={user.username}
              className="hidden lg:inline-flex max-w-[10rem] items-center gap-2 rounded-[6px] px-2 py-1 text-xs text-foreground hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-outline bg-elevated font-bold text-primary">
                {usernameInitial(user.username)}
              </span>
              <span className="truncate">@{user.username}</span>
            </Link>
            <SignOutButton className="hidden md:inline-flex" />
          </>
        ) : isGuest ? (
          <GuestAuthLinks signupEnabled={signupEnabled} />
        ) : null}
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          id={menuId}
          side="left"
          className="w-72 border-r border-hairline bg-panel p-6 text-foreground md:hidden overscroll-contain"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            mobileMenuTriggerRef.current?.focus();
          }}
        >
          <SheetHeader className="border-b border-hairline pb-3 text-left">
            <SheetTitle className="text-sm font-semibold text-foreground">
              Navigation
            </SheetTitle>
            <SheetDescription className="sr-only">
              Site links and account actions
            </SheetDescription>
          </SheetHeader>
          <nav aria-label="Mobile navigation" className="mt-4 flex flex-col gap-1">
            {NAV_LINKS.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex min-h-11 items-center gap-3 rounded-[6px] px-3 py-2 text-sm border border-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    isActive ? "bg-primary/10 text-primary border-primary/30 font-semibold" : "text-on-surface-variant hover:bg-elevated"
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {label}
                </Link>
              );
            })}
            {user ? (
              <>
                <p className="mt-2 px-3 text-xs text-muted-foreground">@{user.username}</p>
                <button
                  type="button"
                  className="flex min-h-11 items-center gap-3 rounded-[6px] px-3 py-2 text-sm text-on-surface-variant hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  onClick={() => {
                    void signOutAndRedirect();
                  }}
                >
                  <LogOut className="h-4 w-4" aria-hidden />
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="mt-2 flex min-h-11 items-center gap-3 rounded-[6px] px-3 py-2 text-sm text-on-surface-variant hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  Sign In
                </Link>
                {signupEnabled ? <Link
                  href="/login?mode=signup"
                  className="flex min-h-11 items-center gap-3 rounded-[6px] px-3 py-2 text-sm text-primary hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  Sign Up
                </Link> : null}
              </>
            )}
          </nav>
        </SheetContent>
      </Sheet>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px ombre-divider"
      />
    </header>
  );
}
