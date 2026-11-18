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
import { BrandMark } from "@/components/design-system/brand-mark";
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
import { BYOK_UPDATED_EVENT, getActiveConfig } from "@/lib/byok-vault";
import {
  buildSettingsHref,
  clearActiveApplicationContext,
  resolveGlobalTailorContext,
  resolveGlobalTailorHref,
  type ApplicationAccountScope,
} from "@/lib/tailor/application-context";

export const PRIMARY_NAV_LINKS = [
  { href: "/editor", label: "Editor", icon: Edit },
  { href: "/library", label: "Evidence Bank", icon: Database },
  { href: "/tracker", label: "Jobs", icon: Briefcase },
  { href: "/tailor", label: "Tailor", icon: Sparkles },
  { href: "/practice", label: "Practice", icon: Code2 },
] as const;

export const SETTINGS_NAV_LINK = {
  href: "/settings",
  label: "Settings",
  icon: Settings,
} as const;

const MOBILE_NAV_LINKS = [...PRIMARY_NAV_LINKS, SETTINGS_NAV_LINK] as const;

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
        clearActiveApplicationContext();
        void signOutAndRedirect();
      }}
      className={`text-body-dense ${cn(
        "inline-flex min-h-11 items-center gap-2 rounded-[6px] px-3 font-body-dense text-on-surface-variant hover:bg-elevated hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50",
        className
      )}`}
    >
      <LogOut className="h-4 w-4" aria-hidden />
      <span className="hidden sm:inline">Sign Out</span>
    </button>
  );
}

function GuestAuthLinks({ className, signupEnabled }: { className?: string; signupEnabled: boolean }) {
  return (
    <div className={cn("hidden lg:flex items-center gap-2", className)}>
      <Link
        href="/login"
        className="inline-flex min-h-9 items-center rounded-[7px] border border-outline/80 bg-transparent px-3.5 text-body-dense font-body-dense font-medium text-foreground/90 transition-colors hover:border-outline hover:bg-elevated/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        Sign In
      </Link>
      {signupEnabled ? <Link
        href="/login?mode=signup"
        className="inline-flex min-h-9 items-center rounded-[7px] bg-primary px-3.5 text-body-dense font-body-dense font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        Sign Up
      </Link> : null}
    </div>
  );
}

function useAiStatus(pathname: string) {
  const [aiStatus, setAiStatus] = useState<{
    provider: string;
    hasKey: boolean;
    keyless: boolean;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const refreshAiStatus = () => {
      void getActiveConfig()
        .then((cfg) => {
          if (!cancelled) {
            setAiStatus({
              provider: cfg.provider,
              hasKey: cfg.hasKey,
              keyless: cfg.keyless,
            });
          }
        })
        .catch(() => {});
    };

    refreshAiStatus();
    if (typeof window === "undefined") {
      return () => {
        cancelled = true;
      };
    }

    window.addEventListener(BYOK_UPDATED_EVENT, refreshAiStatus);
    window.addEventListener("storage", refreshAiStatus);
    window.addEventListener("focus", refreshAiStatus);
    return () => {
      cancelled = true;
      window.removeEventListener(BYOK_UPDATED_EVENT, refreshAiStatus);
      window.removeEventListener("storage", refreshAiStatus);
      window.removeEventListener("focus", refreshAiStatus);
    };
  }, [pathname]);

  return aiStatus;
}

function AiStatusPill({
  aiStatus,
  settingsHref = "/settings",
  testId,
  className,
  onClick,
}: {
  aiStatus: { provider: string; hasKey: boolean; keyless: boolean };
  settingsHref?: string;
  testId?: string;
  className?: string;
  onClick?: () => void;
}) {
  const isConnected = aiStatus.hasKey && !aiStatus.keyless;

  return (
    <Link
      href={settingsHref}
      data-testid={testId}
      onClick={onClick}
      title={
        aiStatus.keyless
          ? `Local AI (${aiStatus.provider.toUpperCase()}) not verified — Click to manage in Settings`
          : isConnected
            ? `AI Connected (${aiStatus.provider.toUpperCase()}) — Click to manage in Settings`
            : "No AI API key configured — Click to connect in Settings"
      }
      className={`text-mono-data ${cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono-data font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        aiStatus.keyless
          ? "border-outline bg-elevated/60 text-on-surface-variant hover:bg-elevated hover:text-foreground"
          : isConnected
            ? "border-signal/35 bg-signal/10 text-signal hover:bg-signal/20"
            : "border-primary/35 bg-primary/10 text-primary hover:bg-primary/20",
        className
      )}`}
    >
      {isConnected && hasBrandIcon(aiStatus.provider) ? (
        <BrandIcon name={aiStatus.provider} className="h-3.5 w-3.5 shrink-0" />
      ) : (
        <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden />
      )}
      <span>
        {aiStatus.keyless
          ? "Local AI · not verified"
          : isConnected
            ? `AI · ${aiStatus.provider.toUpperCase()}`
            : "Connect AI Key"}
      </span>
    </Link>
  );
}

function NavUtilities({
  aiStatus,
  aiSettingsHref,
  isSettingsActive,
  compact,
}: {
  aiStatus: { provider: string; hasKey: boolean; keyless: boolean } | null;
  aiSettingsHref: string;
  isSettingsActive: boolean;
  compact: boolean;
}) {
  return (
    <div className="hidden lg:flex items-center gap-1.5">
      {aiStatus && (
        <AiStatusPill
          aiStatus={aiStatus}
          settingsHref={aiSettingsHref}
          testId="nav-ai-status-pill"
        />
      )}
      <Link
        href={SETTINGS_NAV_LINK.href}
        aria-label={SETTINGS_NAV_LINK.label}
        title={SETTINGS_NAV_LINK.label}
        data-testid="nav-settings-link"
        aria-current={isSettingsActive ? "page" : undefined}
        className={cn(
          "inline-flex items-center justify-center rounded-[6px] border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          compact ? "min-h-9 min-w-9" : "min-h-11 min-w-11",
          isSettingsActive
            ? "border-primary/30 bg-primary/10 text-primary"
            : "border-transparent text-on-surface-variant hover:bg-elevated hover:text-foreground"
        )}
      >
        <Settings className="h-4 w-4" aria-hidden />
      </Link>
    </div>
  );
}

export function TopNav({ actions, badge, compact = false }: TopNavProps) {
  const pathname = usePathname();
  const currentPath = pathname ?? "";
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);
  const [demoMode, setDemoMode] = useState<boolean | undefined>(undefined);
  const [signupEnabled, setSignupEnabled] = useState(true);
  const [tailorHref, setTailorHref] = useState<string>("/tailor");
  const isOnTailor = currentPath === "/tailor" || currentPath.startsWith("/tailor/");
  const [aiSettingsHref, setAiSettingsHref] = useState<string>(
    isOnTailor ? "/settings?from=tailor&tab=job-info" : "/settings"
  );
  const aiStatus = useAiStatus(pathname);
  const menuId = useId();
  const mobileMenuTriggerRef = React.useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchDemoConfig().then((config) => {
      if (cancelled) return;
      setDemoMode(config?.demoMode === true);
      if (config?.signupEnabled === false) setSignupEnabled(false);
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
    const scope: ApplicationAccountScope = {
      userId: user?.id ?? null,
      demoMode: demoMode ?? false,
      scopeResolved: user !== undefined && demoMode !== undefined,
    };
    const refreshTailorHref = () => {
      setTailorHref(resolveGlobalTailorHref(scope));
      const resolved = resolveGlobalTailorContext(scope);
      if (currentPath === "/tailor" || currentPath.startsWith("/tailor/")) {
        const sp =
          typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
        const urlJobId = sp?.get("jobId") ?? resolved.activeContext?.jobId ?? null;
        const urlTab = sp?.get("tab") ?? resolved.activeContext?.tab ?? "job-info";
        setAiSettingsHref(
          buildSettingsHref({
            from: "tailor",
            jobId: urlJobId,
            tab: urlTab,
            variantId: sp?.get("variantId") ?? resolved.activeContext?.variantId ?? null,
            resumeId: sp?.get("resumeId") ?? resolved.activeContext?.resumeId ?? null,
            mode: sp?.get("mode") ?? resolved.activeContext?.mode ?? null,
          })
        );
      } else {
        setAiSettingsHref("/settings");
      }
    };
    refreshTailorHref();
    if (typeof window === "undefined") return;
    window.addEventListener("focus", refreshTailorHref);
    window.addEventListener("storage", refreshTailorHref);
    window.addEventListener("resumeforge:application-context-changed", refreshTailorHref);
    return () => {
      window.removeEventListener("focus", refreshTailorHref);
      window.removeEventListener("storage", refreshTailorHref);
      window.removeEventListener("resumeforge:application-context-changed", refreshTailorHref);
    };
  }, [user, demoMode, pathname, currentPath]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const closeIfDesktop = (matches: boolean) => {
      if (matches) {
        setMobileOpen(false);
      }
    };
    closeIfDesktop(mediaQuery.matches);
    const listener = (event: MediaQueryListEvent) => closeIfDesktop(event.matches);
    mediaQuery.addEventListener("change", listener);
    return () => mediaQuery.removeEventListener("change", listener);
  }, []);

  const isGuest = user === null;
  const isSettingsActive =
    currentPath === SETTINGS_NAV_LINK.href || currentPath.startsWith(`${SETTINGS_NAV_LINK.href}/`);

  return (
    <header
      className={cn(
        "bg-rf-bg/90 backdrop-blur-xl border-b border-border fixed top-0 w-full z-50 flex items-center justify-between gap-2 sm:gap-3 pt-[env(safe-area-inset-top)] max-w-full overflow-visible",
        compact
          ? "h-[calc(3rem+env(safe-area-inset-top))] px-4 lg:px-6"
          : "h-[calc(4rem+env(safe-area-inset-top))] px-4 lg:px-8"
      )}
    >
      <div className={cn("flex items-center min-w-0", compact ? "gap-3 sm:gap-6" : "gap-4 sm:gap-8")}>
        <Link
          href="/"
          className="flex min-w-0 items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-[6px]"
          aria-label="ResumeForge home"
        >
          <BrandMark compact={compact} />
        </Link>

        {badge ? (
          <>
            <span className="hidden sm:block h-4 w-px shrink-0 bg-border" aria-hidden />
            <div className="min-w-0 truncate">{badge}</div>
          </>
        ) : null}
      </div>

      <nav
        className="hidden lg:flex flex-1 items-center justify-center gap-1 xl:gap-2 text-body-dense"
        aria-label="Primary navigation"
      >
        {PRIMARY_NAV_LINKS.map(({ href, label }) => {
          const isActive = currentPath === href || currentPath.startsWith(`${href}/`);
          const resolvedHref = href === "/tailor" ? tailorHref : href;
          return (
            <Link
              key={href}
              href={resolvedHref}
              title={label}
              aria-current={isActive ? "page" : undefined}
              className={`text-body-dense ${cn(
                "whitespace-nowrap rounded-[6px] px-2.5 xl:px-3 py-1.5 font-body-dense transition-colors border border-transparent hover:bg-elevated/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                isActive
                  ? "bg-primary/10 text-primary border-primary/30 font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}`}
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
          className="lg:hidden inline-flex min-h-11 min-w-11 items-center justify-center rounded-[6px] text-on-surface-variant hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          aria-expanded={mobileOpen}
          aria-controls={mobileOpen ? menuId : undefined}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          onClick={() => setMobileOpen((open) => !open)}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        {actions ? <div className="hidden lg:flex items-center gap-2">{actions}</div> : null}
        <NavUtilities
          aiStatus={aiStatus}
          aiSettingsHref={aiSettingsHref}
          isSettingsActive={isSettingsActive}
          compact={compact}
        />
        {user ? (
          <div className="hidden lg:flex items-center gap-1.5 pl-1.5 border-l border-hairline">
            <span
              title={user.username}
              className="inline-flex max-w-[10rem] items-center gap-2 rounded-[6px] px-2 py-1 font-mono-data text-mono-data text-foreground"
            >
              <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-outline bg-elevated font-bold text-primary">
                {usernameInitial(user.username)}
              </span>
              <span className="truncate">@{user.username}</span>
            </span>
            <SignOutButton className={cn("inline-flex", compact ? "lg:min-h-8" : "lg:min-h-9")} />
          </div>
        ) : isGuest ? (
          <GuestAuthLinks signupEnabled={signupEnabled} />
        ) : null}
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          id={menuId}
          side="left"
          className="w-72 border-r border-hairline bg-panel px-6 pb-6 pt-[calc(1.5rem+env(safe-area-inset-top))] text-foreground lg:hidden overscroll-contain overflow-y-auto"
          onEscapeKeyDown={() => setMobileOpen(false)}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (
              typeof window !== "undefined" &&
              typeof window.matchMedia === "function" &&
              window.matchMedia("(min-width: 1024px)").matches
            ) {
              return;
            }
            mobileMenuTriggerRef.current?.focus();
          }}
        >
          <SheetHeader className="border-b border-hairline pb-3 text-left">
            <SheetTitle className="font-section-label text-section-label uppercase text-muted-foreground">
              Navigation
            </SheetTitle>
            <SheetDescription className="sr-only">
              Site links and account actions
            </SheetDescription>
          </SheetHeader>
          <nav aria-label="Mobile navigation" className="mt-4 flex flex-col gap-1">
            {MOBILE_NAV_LINKS.map(({ href, label, icon: Icon }) => {
              const isActive = currentPath === href || currentPath.startsWith(`${href}/`);
              const resolvedHref = href === "/tailor" ? tailorHref : href;
              return (
                <Link
                  key={href}
                  href={resolvedHref}
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => setMobileOpen(false)}
                  className={`text-body-dense ${cn(
                    "flex min-h-11 items-center gap-3 rounded-[6px] px-3 py-2 font-body-dense border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    isActive
                      ? "bg-elevated text-foreground border-hairline shadow-[inset_2px_0_0_rgb(var(--accent-action))] font-semibold"
                      : "border-transparent text-on-surface-variant hover:bg-elevated"
                  )}`}
                >
                  <Icon className={cn("h-4 w-4", isActive && "text-primary")} aria-hidden />
                  {label}
                </Link>
              );
            })}
            {aiStatus ? (
              <div className="mt-3 border-t border-hairline pt-3">
                <AiStatusPill
                  aiStatus={aiStatus}
                  settingsHref={aiSettingsHref}
                  testId="mobile-nav-ai-status-pill"
                  className="min-h-11 w-full justify-start rounded-full px-3.5 py-2"
                  onClick={() => setMobileOpen(false)}
                />
              </div>
            ) : null}
            {user ? (
              <>
                <p className="mt-2 px-3 font-mono-data text-mono-data text-muted-foreground">@{user.username}</p>
                <button
                  type="button"
                  className="flex min-h-11 items-center gap-3 rounded-[6px] px-3 py-2 text-body-dense font-body-dense text-on-surface-variant hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  onClick={() => {
                    setMobileOpen(false);
                    clearActiveApplicationContext();
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
                  onClick={() => setMobileOpen(false)}
                  className="mt-2 flex min-h-11 items-center gap-3 rounded-[6px] px-3 py-2 text-body-dense font-body-dense text-on-surface-variant hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  Sign In
                </Link>
                {signupEnabled ? <Link
                  href="/login?mode=signup"
                  onClick={() => setMobileOpen(false)}
                  className="flex min-h-11 items-center gap-3 rounded-[6px] px-3 py-2 text-body-dense font-body-dense text-primary hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
