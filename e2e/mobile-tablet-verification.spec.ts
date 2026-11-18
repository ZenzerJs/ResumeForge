import { expect, test, type Locator, type Page } from "@playwright/test";

const VIEWPORT_MATRIX = [
  { name: "320x740", width: 320, height: 740, isDesktop: false },
  { name: "390x844", width: 390, height: 844, isDesktop: false },
  { name: "768x1024", width: 768, height: 1024, isDesktop: false },
  { name: "820x1180", width: 820, height: 1180, isDesktop: false },
  { name: "1024x768", width: 1024, height: 768, isDesktop: true },
  { name: "844x390", width: 844, height: 390, isDesktop: false },
  { name: "1180x820", width: 1180, height: 820, isDesktop: true },
  { name: "1280x800", width: 1280, height: 800, isDesktop: true },
  { name: "1440x900", width: 1440, height: 900, isDesktop: true },
] as const;

const BREAKPOINT_EDGES = [
  { width: 767, height: 900, isDesktop: false },
  { width: 768, height: 900, isDesktop: false },
  { width: 1023, height: 900, isDesktop: false },
  { width: 1024, height: 900, isDesktop: true },
  { width: 1279, height: 900, isDesktop: true },
  { width: 1280, height: 900, isDesktop: true },
] as const;

const SAMPLE_EVIDENCE = [
  {
    id: "ev-mobile-1",
    type: "project",
    title: "Distributed Telemetry Pipeline with Extremely Long Unbroken Subtitle",
    organization: "Example Studio Engineering",
    dates: "Jan 2024 - Present",
    verifiedSummary: "Built TypeScript telemetry ingestion backed by PostgreSQL.",
    tags: ["TypeScript", "PostgreSQL", "Observability"],
    status: "verified",
    bullets: [
      {
        id: "b-mobile-1",
        text: "Reduced tail latency by 38% across high-throughput ingestion workers.",
        technologies: ["TypeScript", "PostgreSQL"],
        roleAffinity: ["backend"],
        verified: true,
        orderIndex: 0,
      },
    ],
  },
];

const SAMPLE_DISCOVER_JOBS = [
  {
    id: "disc-mobile-1",
    externalId: "ext-1",
    source: "GREENHOUSE",
    companyName: "Stripe",
    title: "Staff Platform Engineer, Distributed Systems",
    location: "Toronto, ON",
    workplaceType: "REMOTE",
    isCanadianEligible: true,
    description: "Build reliable TypeScript and PostgreSQL services.",
    descriptionHtml: "",
    applyUrl: "https://example.com/jobs/1",
    postedAt: null,
    salaryMin: 160000,
    salaryMax: 210000,
    salaryCurrency: "CAD",
    createdAt: "2026-01-01T00:00:00.000Z",
    trackedJob: null,
    blendedScore: 88,
    scoreBreakdown: {
      atsScore: 90,
      recencyScore: 80,
      locationScore: 95,
      salaryScore: 85,
      finalScore: 88,
    },
  },
];

const SAMPLE_TRACKER_JOBS = [
  {
    id: "tracked-mobile-1",
    company: "Stripe",
    roleTitle: "Staff Platform Engineer",
    source: "pasted",
    status: "SAVED",
    createdAt: "2026-01-01T00:00:00.000Z",
    notes: "",
    rawDescription: "Build reliable TypeScript and PostgreSQL services.",
    extractedRequirements: {
      requiredSkills: ["TypeScript", "PostgreSQL"],
      preferredSkills: [],
      domainTerms: [],
    },
    variants: [],
    coverLetters: [],
  },
];

async function installMocks(
  page: Page,
  options?: {
    holdEvidence?: () => Promise<void>;
    failTestConnection?: boolean;
    demoMode?: boolean;
  }
) {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  await page.addInitScript(
    ({ evidence, trackedJobs }) => {
      localStorage.setItem("resumeforge_guest_evidence", JSON.stringify(evidence));
      localStorage.setItem("resumeforge_guest_jobs", JSON.stringify(trackedJobs));
    },
    { evidence: SAMPLE_EVIDENCE, trackedJobs: SAMPLE_TRACKER_JOBS }
  );

  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const pathname = url.pathname;
    let body: unknown = { success: true, data: [] };

    if (pathname === "/api/demo-config") {
      body = { demoMode: options?.demoMode ?? true };
    } else if (pathname === "/api/auth/me") {
      body = { data: null, guest: true };
    } else if (pathname === "/api/evidence") {
      if (options?.holdEvidence) await options.holdEvidence();
      body = { success: true, data: SAMPLE_EVIDENCE };
    } else if (pathname === "/api/jobs") {
      body = { success: true, data: SAMPLE_TRACKER_JOBS };
    } else if (pathname === "/api/connectors/jobs") {
      body = {
        success: true,
        data: SAMPLE_DISCOVER_JOBS,
        meta: { total: SAMPLE_DISCOVER_JOBS.length, totalPages: 1 },
        hasEvidence: true,
      };
    } else if (pathname === "/api/stats/outcomes") {
      body = {
        success: true,
        guest: false,
        data: {
          funnel: { SAVED: 1, APPLIED: 5, INTERVIEWING: 2, OFFER: 1, REJECTED: 1 },
          interviewRate: 0.4,
          medianResponseDays: 4,
          variants: [
            {
              variantId: "var-1",
              variantTitle: "Platform Core Variant",
              company: "Stripe",
              roleTitle: "Staff Platform Engineer",
              applications: 3,
              interviews: 2,
              offers: 1,
              interviewRate: 0.67,
            },
          ],
        },
      };
    } else if (pathname === "/api/resumes/master") {
      body = { success: true, data: null };
    } else if (pathname === "/api/resumes") {
      body = { success: true, data: [] };
    } else if (pathname === "/api/ai/test-connection") {
      if (options?.failTestConnection) {
        body = { success: false, error: "Invalid provider API key" };
      } else {
        body = { success: true, message: "Connected", latencyMs: 12 };
      }
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });

  return errors;
}

async function assertNoHorizontalOverflow(page: Page, contextLabel: string) {
  const layout = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const sw = document.documentElement.scrollWidth;
    const header = document.querySelector("header");
    const headerSw = header ? header.scrollWidth : 0;
    const headerCw = header ? header.clientWidth : vw;

    const outOfBounds: Array<{ tag: string; label: string; left: number; right: number }> = [];
    const hasScrollableXAncestor = (el: Element): boolean => {
      let cur = el.parentElement;
      while (cur && cur !== document.body && cur !== document.documentElement) {
        const ox = getComputedStyle(cur).overflowX;
        if (ox === "auto" || ox === "scroll") return true;
        cur = cur.parentElement;
      }
      return false;
    };

    for (const el of document.querySelectorAll(
      "header button, header a, main button, main [data-testid='evidence-item-card']"
    )) {
      if (el.closest("[aria-hidden='true']")) continue;
      if (el.closest("[data-testid='tracker-kanban-board']")) continue;
      if (hasScrollableXAncestor(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.left < -1 || r.right > vw + 1) {
        outOfBounds.push({
          tag: el.tagName.toLowerCase(),
          label: (el.getAttribute("data-testid") || el.getAttribute("aria-label") || el.textContent || "")
            .trim()
            .replace(/\s+/g, " ")
            .slice(0, 32),
          left: Math.round(r.left),
          right: Math.round(r.right),
        });
      }
    }

    const headerItems = Array.from(document.querySelectorAll("header a, header button"))
      .map((el) => ({
        label: (el.getAttribute("aria-label") || el.textContent || "").trim().replace(/\s+/g, " "),
        rect: el.getBoundingClientRect(),
      }))
      .filter((item) => item.rect.width > 0 && item.rect.height > 0);

    const headerOverlaps: Array<[string, string]> = [];
    for (let i = 0; i < headerItems.length; i++) {
      for (let j = i + 1; j < headerItems.length; j++) {
        const a = headerItems[i].rect;
        const b = headerItems[j].rect;
        const overlapsX = a.left < b.right - 1 && b.left < a.right - 1;
        const overlapsY = a.top < b.bottom - 1 && b.top < a.bottom - 1;
        if (overlapsX && overlapsY) {
          headerOverlaps.push([headerItems[i].label, headerItems[j].label]);
        }
      }
    }

    return { vw, sw, headerSw, headerCw, outOfBounds, headerOverlaps };
  });

  expect(layout.sw, `${contextLabel}: document scrollWidth`).toBeLessThanOrEqual(layout.vw + 1);
  expect(layout.headerSw, `${contextLabel}: header scrollWidth`).toBeLessThanOrEqual(layout.headerCw + 1);
  expect(layout.outOfBounds, `${contextLabel}: out-of-bounds controls`).toEqual([]);
  expect(layout.headerOverlaps, `${contextLabel}: overlapping header items`).toEqual([]);
}

async function expectHitTestable(locator: Locator, label: string) {
  await locator.scrollIntoViewIfNeeded();
  await expect(locator, `${label}: visible`).toBeVisible();
  const hit = await locator.evaluate((el) => {
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const target = document.elementFromPoint(cx, cy);
    return target !== null && (el === target || el.contains(target));
  });
  expect(hit, `${label}: elementFromPoint hits target`).toBe(true);
}

test.describe("Mobile & Tablet Usability Verification", () => {
  test("1. Full viewport matrix, breakpoint edges (767/768, 1023/1024, 1279/1280), 200% zoom, and TopNav keyboard/focus restore", async ({
    page,
  }) => {
    const errors = await installMocks(page);
    const routes = ["/", "/library", "/tracker", "/tracker/feed", "/tailor", "/practice", "/settings"];

    for (const vp of VIEWPORT_MATRIX) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      for (const route of routes) {
        await page.goto(route, { waitUntil: "domcontentloaded" });
        await expect(page.locator("header").first()).toBeVisible();
        await assertNoHorizontalOverflow(page, `${route}@${vp.name}`);

        const primaryNav = page.locator('header nav[aria-label="Primary navigation"]');
        const menuToggle = page.locator('header button[aria-label="Open menu"], header button[aria-label="Close menu"]');

        if (vp.isDesktop) {
          await expect(primaryNav, `${route}@${vp.name}: desktop nav visible`).toBeVisible();
          await expect(menuToggle, `${route}@${vp.name}: menu button hidden`).toBeHidden();
        } else {
          await expect(primaryNav, `${route}@${vp.name}: desktop nav hidden`).toBeHidden();
          await expect(menuToggle, `${route}@${vp.name}: menu button visible`).toBeVisible();
        }
      }
    }

    // Breakpoint edges on /library and /editor
    for (const edge of BREAKPOINT_EDGES) {
      await page.setViewportSize({ width: edge.width, height: edge.height });
      await page.goto("/library", { waitUntil: "domcontentloaded" });
      await assertNoHorizontalOverflow(page, `/library@${edge.width}`);
      if (edge.isDesktop) {
        await expect(page.locator('header nav[aria-label="Primary navigation"]')).toBeVisible();
        await expect(page.locator('header button[aria-label="Open menu"]')).toBeHidden();
      } else {
        await expect(page.locator('header nav[aria-label="Primary navigation"]')).toBeHidden();
        await expect(page.locator('header button[aria-label="Open menu"]')).toBeVisible();
      }
    }

    // 200% zoom equivalent (640x450)
    await page.setViewportSize({ width: 640, height: 450 });
    for (const route of ["/library", "/settings", "/tailor", "/practice"]) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await assertNoHorizontalOverflow(page, `${route}@200%-zoom`);
    }

    // Mobile drawer: hit-test trigger, focus trap (Tab stays inside dialog), Escape restores focus to trigger, resize-to-xl auto-closes
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/library", { waitUntil: "domcontentloaded" });
    const openMenuBtn = page.getByRole("button", { name: "Open menu" });
    await expectHitTestable(openMenuBtn, "TopNav mobile menu trigger");
    await openMenuBtn.click();

    const dialog = page.getByRole("dialog");
    const mobileNav = page.locator('nav[aria-label="Mobile navigation"]');
    await expect(dialog).toBeVisible();
    await expect(mobileNav).toBeVisible();

    for (let i = 0; i < 6; i++) {
      await page.keyboard.press("Tab");
      const insideDialog = await page.evaluate(() => {
        const dlg = document.querySelector('[role="dialog"]');
        return Boolean(dlg && document.activeElement && dlg.contains(document.activeElement));
      });
      expect(insideDialog, "Tab stays trapped inside mobile nav dialog").toBe(true);
    }

    await page.keyboard.press("Escape");
    await expect(mobileNav).toBeHidden();
    await expect(openMenuBtn).toBeFocused();

    // Open again, resize across 1023 -> 1024 -> drawer auto-closes cleanly
    await openMenuBtn.click();
    await expect(mobileNav).toBeVisible();
    await page.setViewportSize({ width: 1024, height: 900 });
    await expect(mobileNav).toBeHidden();

    expect(errors).toEqual([]);
  });

  test("2. Editor enforces lg/xl pane boundaries (1023 vs 1024, 1279 vs 1280), exposes WAI-ARIA tabs, preserves edits across tabs & resizes, and holds 1440x900 chrome budget", async ({
    page,
  }) => {
    const errors = await installMocks(page);

    for (const vp of VIEWPORT_MATRIX.filter((v) => !v.isDesktop)) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/editor", { waitUntil: "domcontentloaded" });
      await assertNoHorizontalOverflow(page, `/editor@${vp.name}`);

      await expect(page.getByTestId("editor-resizable-panel-group")).toHaveCount(0);

      const tablist = page.getByRole("tablist", { name: "Workspace panels" });
      await expect(tablist).toBeVisible();
      const tabs = tablist.getByRole("tab");
      await expect(tabs).toHaveCount(3);
      await expect(tablist.getByRole("tab", { name: /Editor/i })).toBeVisible();
      await expect(tablist.getByRole("tab", { name: /Preview/i })).toBeVisible();
      await expect(tablist.getByRole("tab", { name: /AI/i })).toBeVisible();
    }

    // Breakpoint boundary check: 1023 stays tabbed, 1024 switches to 2-pane, 1279 stays 2-pane, 1280 switches to 3-pane
    await page.setViewportSize({ width: 1023, height: 900 });
    await expect(page.getByTestId("editor-resizable-panel-group")).toHaveCount(0);
    await expect(page.getByRole("tablist", { name: "Workspace panels" })).toBeVisible();
    await page.setViewportSize({ width: 1024, height: 900 });
    await expect(page.getByTestId("editor-resizable-panel-group")).toBeVisible();
    await expect(page.getByTestId("panel-ai")).toHaveCount(0);
    await page.setViewportSize({ width: 1279, height: 900 });
    await expect(page.getByTestId("editor-resizable-panel-group")).toBeVisible();
    await expect(page.getByTestId("panel-ai")).toHaveCount(0);
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(page.getByTestId("editor-resizable-panel-group")).toBeVisible();
    await expect(page.getByTestId("panel-ai")).toHaveCount(1);
    await expect(page.getByRole("button", { name: "AI Assistant" })).toBeVisible();

    // Keyboard nav, hit-test, and state preservation across tabs and 390 -> 1024 -> 1440 -> 390 resizes
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/editor", { waitUntil: "domcontentloaded" });
    const tablist = page.getByRole("tablist", { name: "Workspace panels" });
    const tabs = tablist.getByRole("tab");
    await tabs.first().focus();
    await page.keyboard.press("ArrowRight");
    await expect(tabs.nth(1)).toBeFocused();
    await page.keyboard.press("End");
    await expect(tabs.nth(2)).toBeFocused();
    await page.keyboard.press("Home");
    await expect(tabs.first()).toBeFocused();
    await expectHitTestable(page.getByTestId("save-as-master-btn"), "Save as Master button on 390px");

    const marker = "// MobileResizeStatePreserved";
    await page.getByTestId("editor-mode-code").first().click();
    const cmContent = page.locator(".cm-content").first();
    await expect(cmContent).toBeVisible({ timeout: 15000 });
    await cmContent.click();
    await page.keyboard.press("Control+Home");
    await page.keyboard.type(`${marker}\n`);

    await tablist.getByRole("tab", { name: /Preview/i }).click();
    await expect(page.locator("#workspace-tabpanel-preview")).toBeVisible();
    await tablist.getByRole("tab", { name: /AI/i }).click();
    await expect(page.locator("#workspace-tabpanel-ai")).toBeVisible();
    await tablist.getByRole("tab", { name: /Editor/i }).click();
    await expect(cmContent).toContainText(marker);

    await page.setViewportSize({ width: 1024, height: 768 });
    await expect(page.getByTestId("editor-resizable-panel-group")).toHaveCount(0);
    await expect(cmContent).toContainText(marker);

    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.getByTestId("editor-resizable-panel-group")).toBeVisible();
    await expect(page.locator(".cm-content").first()).toContainText(marker);

    const headerBox = await page.locator("header").first().boundingBox();
    expect(headerBox).not.toBeNull();
    expect(headerBox!.height).toBe(48);

    const toolbarBox = await page.getByTestId("workspace-toolbar").boundingBox();
    expect(toolbarBox).not.toBeNull();
    expect(toolbarBox!.height).toBeLessThanOrEqual(42);

    const paperSheet = page
      .locator('[data-testid="panel-preview"] [data-testid="typst-paper-sheet"], [data-testid="panel-preview"] [data-page-slot="1"]')
      .first();
    await expect(paperSheet).toBeVisible({ timeout: 15000 });
    const paperBox = await paperSheet.boundingBox();
    expect(paperBox).not.toBeNull();
    expect(paperBox!.y).toBeLessThanOrEqual(128);
    console.log(
      `EDITOR_1440_GEOMETRY=${JSON.stringify({
        headerH: headerBox!.height,
        toolbarH: toolbarBox!.height,
        paperY: Math.round(paperBox!.y * 100) / 100,
      })}`
    );

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId("editor-resizable-panel-group")).toHaveCount(0);
    await expect(page.locator(".cm-content").first()).toContainText(marker);

    expect(errors).toEqual([]);
  });

  test("3. Library cards, compact actions, reduced-motion, and skeleton-vs-loaded parity", async ({
    page,
  }) => {
    let releaseEvidence: () => void = () => {};
    const evidencePending = new Promise<void>((resolve) => {
      releaseEvidence = resolve;
    });
    const errors = await installMocks(page, { holdEvidence: () => evidencePending });
    await page.emulateMedia({ reducedMotion: "reduce" });

    // Check loading skeleton parity at 390x844 before releasing fetch
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/library", { waitUntil: "domcontentloaded" });
    await expect(page.locator("main .skeleton-pulse").first()).toBeVisible();
    await expect(page.locator('header nav[aria-label="Primary navigation"]')).toBeHidden();
    await assertNoHorizontalOverflow(page, "/library-skeleton@390x844");

    releaseEvidence();
    await expect(page.getByTestId("evidence-item-card").first()).toBeVisible();

    for (const vp of [
      { name: "320x740", width: 320, height: 740 },
      { name: "390x844", width: 390, height: 844 },
      { name: "768x1024", width: 768, height: 1024 },
      { name: "1024x768", width: 1024, height: 768 },
    ]) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/library", { waitUntil: "domcontentloaded" });

      const card = page.getByTestId("evidence-item-card").first();
      await expect(card).toBeVisible();
      const cardMetrics = await card.evaluate((el) => ({
        sw: el.scrollWidth,
        cw: el.clientWidth,
        vw: document.documentElement.clientWidth,
        right: Math.round(el.getBoundingClientRect().right),
      }));
      expect(cardMetrics.sw).toBeLessThanOrEqual(cardMetrics.cw + 1);
      expect(cardMetrics.right).toBeLessThanOrEqual(cardMetrics.vw + 1);

      const editBtn = card.getByRole("button", { name: "Edit Item" });
      await expectHitTestable(editBtn, `Edit Item@${vp.name}`);
      await expectHitTestable(page.getByRole("button", { name: /Add Evidence Item/i }), `Add Evidence@${vp.name}`);
      await assertNoHorizontalOverflow(page, `/library@${vp.name}`);
    }

    const blobAnim = await page.evaluate(() => {
      const blob = document.querySelector(".ambient-blob-a");
      return blob ? getComputedStyle(blob).animationName : "none";
    });
    expect(blobAnim).toBe("none");

    expect(errors).toEqual([]);
  });

  test("4. Settings aria-live/wrap, Jobs sheet & Kanban, and Tailor/Practice mobile ergonomics", async ({
    page,
  }) => {
    const errors = await installMocks(page, { failTestConnection: true, demoMode: false });

    // Settings aria-live + invalid association + button wrap/hit-test
    await page.setViewportSize({ width: 320, height: 740 });
    await page.goto("/settings", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("account-settings")).toBeVisible();
    await assertNoHorizontalOverflow(page, "/settings@320x740");

    const testConnBtn = page.locator("#test-connection-btn");
    await expectHitTestable(testConnBtn, "Test Connection button");
    await testConnBtn.click();

    const banner = page.locator("#test-result-banner");
    await expect(banner).toBeVisible();
    await expect(banner).toHaveAttribute("role", "status");
    await expect(banner).toHaveAttribute("aria-live", "polite");
    const apiInput = page.locator("#api-key-input");
    if (await apiInput.isVisible()) {
      await expect(apiInput).toHaveAttribute("aria-invalid", "true");
      await expect(apiInput).toHaveAttribute("aria-describedby", "test-result-banner");
    }

    // Tracker split list -> mobile JobDetailPane sheet, then Kanban board
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/tracker", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("tracker-job-list")).toBeVisible();
    await assertNoHorizontalOverflow(page, "/tracker@390x844");

    await page.getByTestId("tracker-job-list").getByRole("button").first().click();
    await expect(page.getByTestId("job-detail-sheet")).toBeVisible();
    await expectHitTestable(page.getByTestId("job-detail-close-btn"), "JobDetailSheet close button");
    await page.getByTestId("job-detail-close-btn").click();
    await expect(page.getByTestId("job-detail-sheet")).toBeHidden();

    await page.getByTestId("tracker-view-kanban").click();
    await expect(page.getByTestId("tracker-kanban-board")).toBeVisible();
    await assertNoHorizontalOverflow(page, "/tracker-kanban@390x844");

    await page.getByTestId("kanban-card-tracked-mobile-1").getByRole("button").first().click();
    await expect(page.getByTestId("tracker-job-list")).toBeVisible();

    // Outcomes scroll container parity
    await page.goto("/tracker/outcomes", { waitUntil: "domcontentloaded" });
    await assertNoHorizontalOverflow(page, "/tracker/outcomes@390x844");

    // Tailor & Practice DSA runner on mobile
    await page.goto("/tailor", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("jd-textarea")).toBeVisible();
    await assertNoHorizontalOverflow(page, "/tailor@390x844");

    await page.goto("/practice", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("practice-main-tabs")).toBeVisible();
    await assertNoHorizontalOverflow(page, "/practice@390x844");
    await page.getByTestId("tab-code-runner").click();
    await expect(page.getByTestId("dsa-run-btn")).toBeVisible();
    await assertNoHorizontalOverflow(page, "/practice-dsa@390x844");

    expect(errors).toEqual([]);
  });
});
