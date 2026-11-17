import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const mockNavigationState = {
  pathname: "/library" as string | null,
  searchParams: new URLSearchParams(),
};

vi.mock("next/navigation", () => ({
  usePathname: () => mockNavigationState.pathname,
  useSearchParams: () => mockNavigationState.searchParams,
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
}));

import {
  PRIMARY_NAV_LINKS,
  SETTINGS_NAV_LINK,
  TopNav,
} from "@/components/navigation/top-nav";
import { LibraryWorkspace } from "@/components/library/library-workspace";
import {
  HomeLanding,
  SetupChecklist,
  resolveHomeSavedRole,
  parseGuestEvidenceSummary,
  parseGuestJobsSummary,
} from "@/components/landing/home-landing";
import { emptyGuestStats } from "@/lib/db/stats";
import { DEMO_JOB } from "@/lib/demo-samples";
import {
  writeActiveApplicationContext,
  resolveGlobalTailorHref,
  parseTailorReturnContext,
  type StorageLike,
} from "@/lib/tailor/application-context";

const ROOT = process.cwd();

function createMemoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

const CHILD_PAGE_TITLES: Array<{ route: string; file: string; expectedTitle: string }> = [
  { route: "/editor", file: "src/app/editor/page.tsx", expectedTitle: "Typst Workspace" },
  { route: "/tailor", file: "src/app/tailor/page.tsx", expectedTitle: "Job Tailoring & Requirement Matcher" },
  { route: "/tracker", file: "src/app/tracker/page.tsx", expectedTitle: "Application Tracker" },
  { route: "/library", file: "src/app/library/page.tsx", expectedTitle: "Evidence Bank Library" },
  { route: "/settings", file: "src/app/settings/page.tsx", expectedTitle: "Settings — AI Gateway" },
  { route: "/practice", file: "src/app/practice/page.tsx", expectedTitle: "Technical Interview & OA Practice" },
  { route: "/tracker/feed", file: "src/app/tracker/feed/page.tsx", expectedTitle: "Job Feed" },
  { route: "/tracker/saved", file: "src/app/tracker/saved/page.tsx", expectedTitle: "Saved Jobs — Tracker" },
  { route: "/tracker/applied", file: "src/app/tracker/applied/page.tsx", expectedTitle: "Applied Jobs — Tracker" },
  { route: "/tracker/outcomes", file: "src/app/tracker/outcomes/page.tsx", expectedTitle: "Outcomes — Tracker" },
];

beforeEach(() => {
  mockNavigationState.pathname = "/library";
  mockNavigationState.searchParams = new URLSearchParams();
});

describe("Metadata title deduplication", () => {
  it("keeps root layout template '%s | ResumeForge' and removes duplicate brand suffix from all 10 child routes", () => {
    const layoutSrc = fs.readFileSync(path.join(ROOT, "src/app/layout.tsx"), "utf8");
    expect(layoutSrc).toContain('template: "%s | ResumeForge"');

    for (const entry of CHILD_PAGE_TITLES) {
      const src = fs.readFileSync(path.join(ROOT, entry.file), "utf8");
      const titleMatch = src.match(/title:\s*"([^"]+)"/);
      expect(titleMatch, `${entry.route} should declare metadata title`).not.toBeNull();
      const rawTitle = titleMatch![1];
      expect(rawTitle).toBe(entry.expectedTitle);
      expect(rawTitle).not.toMatch(/ResumeForge/i);
    }
  });
});

describe("TopNav navigation, Settings entry & continuity wiring", () => {
  it("keeps <= 5 primary destinations and exposes Settings separately", () => {
    expect(PRIMARY_NAV_LINKS.length).toBeLessThanOrEqual(5);
    expect(PRIMARY_NAV_LINKS.map((l) => l.href)).toEqual([
      "/editor",
      "/library",
      "/tracker",
      "/tailor",
      "/practice",
    ]);
    expect(SETTINGS_NAV_LINK.href).toBe("/settings");
    expect(SETTINGS_NAV_LINK.label).toBe("Settings");
  });

  it("renders a keyboard-accessible desktop Settings link even before AI status or session resolves, and preserves DESIGN.md typography tokens", () => {
    const html = renderToStaticMarkup(React.createElement(TopNav));

    const primaryNavMatch = html.match(/<nav[^>]*aria-label="Primary navigation"[^>]*>([\s\S]*?)<\/nav>/);
    expect(primaryNavMatch).not.toBeNull();
    const primaryLinks = primaryNavMatch![1].match(/<a\b/g) ?? [];
    expect(primaryLinks.length).toBe(5);
    expect(primaryNavMatch![1]).toContain("text-body-dense");
    expect(primaryNavMatch![1]).not.toContain("text-[13px]");

    expect(html).toContain('data-testid="nav-settings-link"');
    expect(html).toContain('href="/settings"');
    expect(html).toContain('aria-label="Settings"');

    const navSrc = fs.readFileSync(
      path.join(ROOT, "src/components/navigation/top-nav.tsx"),
      "utf8"
    );
    expect(navSrc).toContain("MOBILE_NAV_LINKS");
    expect(navSrc).toContain("resolveGlobalTailorHref");
    expect(navSrc).toContain("clearActiveApplicationContext");
    expect(navSrc).toContain("text-section-label");
    expect(navSrc).toContain("text-mono-data");
    expect(navSrc).not.toContain("text-[13px]");
  });

  it("resolves global Tailor destination with jobId and exact tab only for resolved matching account scope", () => {
    const storage = createMemoryStorage();
    writeActiveApplicationContext(
      { jobId: "job-alpha", tab: "3-pane", roleTitle: "Backend Engineer" },
      { userId: "user-1", scopeResolved: true },
      storage
    );

    expect(
      resolveGlobalTailorHref({ userId: "user-1", scopeResolved: true }, storage)
    ).toBe("/tailor?jobId=job-alpha&tab=3-pane");

    // Unresolved scope returns bare /tailor without reading stale state
    expect(
      resolveGlobalTailorHref({ userId: "user-1", scopeResolved: false }, storage)
    ).toBe("/tailor");

    // Account switch clears previous user's active job
    expect(
      resolveGlobalTailorHref({ userId: "user-2", scopeResolved: true }, storage)
    ).toBe("/tailor");
  });
});

describe("LibraryWorkspace PageHeader actions, mobile filter ergonomics & Tailor return", () => {
  it("wraps LibraryWorkspace in Suspense in src/app/library/page.tsx", () => {
    const pageSrc = fs.readFileSync(path.join(ROOT, "src/app/library/page.tsx"), "utf8");
    expect(pageSrc).toContain("<Suspense");
    expect(pageSrc).toContain('<PageSkeleton variant="library"');
  });

  it("renders Import JSON and Add Evidence Item inside PageHeader rather than TopNav/AppShell actions, and omits return link without valid context", () => {
    const html = renderToStaticMarkup(React.createElement(LibraryWorkspace));

    const headerMatch = html.match(/<header[\s\S]*?<\/header>/);
    expect(headerMatch).not.toBeNull();
    expect(headerMatch![0]).not.toContain("Import JSON");
    expect(headerMatch![0]).not.toContain("Add Evidence Item");

    const mainMatch = html.match(/<main[\s\S]*<\/main>/);
    expect(mainMatch).not.toBeNull();
    expect(mainMatch![0]).toContain("Import JSON");
    expect(mainMatch![0]).toContain("Add Evidence Item");
    expect(mainMatch![0]).toContain('placeholder="Search evidence…"');
    expect(mainMatch![0]).toContain('data-testid="evidence-status-filter"');
    expect(mainMatch![0]).toContain("whitespace-nowrap");
    expect(mainMatch![0]).toContain("h-11 sm:h-9");
    expect(mainMatch![0]).not.toContain("library-back-to-tailor-link");
  });

  it("renders keyboard-reachable Back to Tailor return link retaining jobId and exact tab when valid Tailor return context exists", () => {
    mockNavigationState.searchParams = new URLSearchParams(
      "from=tailor&jobId=job-123&tab=overview"
    );
    const html = renderToStaticMarkup(React.createElement(LibraryWorkspace));
    expect(html).toContain('data-testid="library-back-to-tailor-link"');
    expect(html).toContain('href="/tailor?jobId=job-123&amp;tab=overview"');
    expect(html).toContain("Back to Tailor");

    // Rejects invalid jobId or non-tailor origin
    mockNavigationState.searchParams = new URLSearchParams(
      "from=tailor&jobId=../evil&tab=overview"
    );
    const invalidHtml = renderToStaticMarkup(React.createElement(LibraryWorkspace));
    expect(invalidHtml).not.toContain("library-back-to-tailor-link");
  });

  it("names the role in the Library return action only when matching scoped application context exists", () => {
    const storage = createMemoryStorage();
    writeActiveApplicationContext(
      { jobId: "job-123", tab: "overview", roleTitle: "Platform Engineer" },
      { userId: "user-1", scopeResolved: true },
      storage
    );

    const sameUser = parseTailorReturnContext("from=tailor&jobId=job-123&tab=overview", {
      scope: { userId: "user-1", scopeResolved: true },
      storage,
    });
    expect(sameUser?.href).toBe("/tailor?jobId=job-123&tab=overview");
    expect(sameUser?.label).toBe("Back to Tailor · Platform Engineer");

    const otherUser = parseTailorReturnContext("from=tailor&jobId=job-123&tab=overview", {
      scope: { userId: "user-2", scopeResolved: true },
      storage,
    });
    expect(otherUser?.label).toBe("Back to Tailor");
  });
});

describe("HomeLanding entry points (new posting, sample experience, saved role)", () => {
  it("routes primary first-run CTA and Step 4 Add Target Job to empty job entry and routes sample links to sample experience", () => {
    const heroHtml = renderToStaticMarkup(
      React.createElement(HomeLanding, {
        initialStats: emptyGuestStats(),
        demoMode: false,
      })
    );

    expect(heroHtml).toContain('data-testid="hero-start-tailoring-btn"');
    expect(heroHtml).toContain('href="/tailor?new=1&amp;tab=job-info"');
    expect(heroHtml).toContain('data-testid="hero-sample-job-link"');
    expect(heroHtml).toContain('href="/tailor?sample=1&amp;tab=job-info"');

    const demoChecklistHtml = renderToStaticMarkup(
      React.createElement(SetupChecklist, {
        stats: emptyGuestStats(),
        hasLocalResume: false,
        guestEvidence: parseGuestEvidenceSummary(null),
        guestJobs: parseGuestJobsSummary(JSON.stringify([DEMO_JOB])),
        hasAiKey: false,
        aiKeyless: false,
        demoMode: true,
        onUploadPdf: () => {},
        onDismiss: () => {},
      })
    );
    expect(demoChecklistHtml).toContain('data-testid="onboarding-step-4-action"');
    expect(demoChecklistHtml).toContain('href="/tailor?new=1&amp;tab=job-info"');
    expect(demoChecklistHtml).toContain("Add Target Job");
    expect(demoChecklistHtml).toContain('data-testid="onboarding-step-4-sample-link"');
    expect(demoChecklistHtml).toContain('href="/tailor?sample=demo&amp;tab=job-info"');

    const completedWithRoleHtml = renderToStaticMarkup(
      React.createElement(SetupChecklist, {
        stats: { ...emptyGuestStats(), hasTargetJob: true },
        hasLocalResume: false,
        guestEvidence: parseGuestEvidenceSummary(null),
        guestJobs: parseGuestJobsSummary(null),
        hasAiKey: false,
        aiKeyless: false,
        demoMode: false,
        savedRole: {
          href: "/tailor?jobId=job-99&tab=overview",
          roleLabel: "Staff Backend Engineer",
        },
        onUploadPdf: () => {},
        onDismiss: () => {},
      })
    );
    expect(completedWithRoleHtml).toContain('href="/tailor?jobId=job-99&amp;tab=overview"');
    expect(completedWithRoleHtml).toContain("Open Tailor · Staff Backend Engineer");
  });

  it("resolves saved role for a named resume action only for current scoped account/guest and ignores demo samples", () => {
    const storage = createMemoryStorage();
    writeActiveApplicationContext(
      { jobId: "job-saved-1", tab: "3-pane", roleTitle: "Staff Backend Engineer" },
      { userId: "user-1", scopeResolved: true },
      storage
    );

    expect(
      resolveHomeSavedRole({ userId: "user-1", scopeResolved: true }, null, storage)
    ).toEqual({
      href: "/tailor?jobId=job-saved-1&tab=3-pane",
      roleLabel: "Staff Backend Engineer",
    });

    // Unresolved scope returns null
    expect(
      resolveHomeSavedRole({ userId: "user-1", scopeResolved: false }, null, storage)
    ).toBeNull();

    // Switching to signed-out guest clears mismatched user-1 context and ignores demo sample job
    const guestJobsOnlySample = JSON.stringify([DEMO_JOB]);
    expect(
      resolveHomeSavedRole({ userId: null, scopeResolved: true }, guestJobsOnlySample, storage)
    ).toBeNull();

    // Guest with a personal saved job gets a named resume action
    const guestJobsPersonal = JSON.stringify([
      DEMO_JOB,
      { id: "guest-job-99", company: "Acme", roleTitle: "Data Engineer", rawDescription: "SQL" },
    ]);
    expect(
      resolveHomeSavedRole({ userId: null, scopeResolved: true }, guestJobsPersonal, storage)
    ).toEqual({
      href: "/tailor?jobId=guest-job-99&tab=job-info",
      roleLabel: "Data Engineer (Acme)",
    });
  });
});
