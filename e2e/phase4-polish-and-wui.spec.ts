import { test, expect } from "@playwright/test";
import {
  buildResumeDocument,
  renderResumeDocument,
  type ResumeAssignment,
} from "../src/lib/typst/resume-document";

function buildManagedV2Resume(): string {
  const rows: Array<[ResumeAssignment["kind"], string]> = [
    ["name", "Morgan Example"],
    ["contact", "Boston, MA"],
    ["contact", "morgan@example.test"],
    ["section", "Experience"],
    ["entry-title", "Northwind Labs"],
    ["entry-role", "Senior Platform Engineer"],
    ["entry-location", "Boston, MA"],
    ["entry-date", "2023 - Present"],
    ["bullet", "- Built distributed TypeScript services backed by PostgreSQL."],
  ];
  const source = rows.map(([, text]) => text).join("\n");
  const assignments: ResumeAssignment[] = [];
  let cursor = 0;
  for (const [kind, text] of rows) {
    const start = source.indexOf(text, cursor);
    const end = start + text.length;
    assignments.push({ kind, span: { start, end } });
    cursor = end + 1;
  }
  return renderResumeDocument(buildResumeDocument(source, assignments, "us-letter"), "comfortable");
}

test.describe("Phase 4 Polish & WUI Regressions", () => {
  test("1. /tracker/feed More filters popover opens with opaque background", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/tracker/feed");
    await page.waitForLoadState("networkidle");

    const moreFiltersBtn = page.getByTestId("discover-more-filters-btn");
    await expect(moreFiltersBtn).toBeVisible();
    await moreFiltersBtn.click();

    const salarySelect = page.getByTestId("discover-salary-select");
    await expect(salarySelect).toBeVisible();

    const popoverBg = await salarySelect.evaluate((el) => {
      const popover = el.closest('[role="dialog"]') ?? el.closest("[data-radix-popper-content-wrapper] > div");
      return popover ? getComputedStyle(popover).backgroundColor : "";
    });

    expect(popoverBg).toBeTruthy();
    expect(popoverBg).not.toBe("rgba(0, 0, 0, 0)");
    expect(popoverBg).not.toBe("transparent");
  });

  test("2. /login and /tracker render at most 1 .ombre-divider and zero top-16 floating dividers", async ({
    browser,
    page,
  }) => {
    const loginContext = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });
    try {
      const loginPage = await loginContext.newPage();
      await loginPage.goto("/login");
      await loginPage.waitForLoadState("networkidle");
      await expect(loginPage.locator("main#main-content")).toBeVisible();

      const loginDividers = await loginPage.locator(".ombre-divider").count();
      const loginFloating = await loginPage.locator(".ombre-divider.top-16").count();
      expect(loginDividers).toBeLessThanOrEqual(1);
      expect(loginFloating).toBe(0);
    } finally {
      await loginContext.close();
    }

    await page.goto("/tracker");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("tracker-page-title")).toBeVisible();

    const trackerDividers = await page.locator(".ombre-divider").count();
    const trackerFloating = await page.locator(".ombre-divider.top-16").count();
    expect(trackerDividers).toBeLessThanOrEqual(1);
    expect(trackerFloating).toBe(0);
  });

  test("3. /editor fresh load has sole Save as Master Resume primary CTA, t=0ms focus ring, and live ManagedResumeForm updates without blur", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/editor");
    await page.waitForLoadState("networkidle");

    const toolbar = page.getByTestId("workspace-toolbar");
    await expect(toolbar).toBeVisible();

    // Sole .bg-primary CTA in workspace toolbar is Save as Master Resume
    const primaryCtas = toolbar.locator(".bg-primary");
    await expect(primaryCtas).toHaveCount(1);
    await expect(primaryCtas.first()).toHaveAttribute("data-testid", "save-as-master-btn");

    // Immediate :focus-visible box-shadow at t=0ms after Tab is non-transparent
    await page.getByTestId("revert-to-master-btn").focus();
    await page.keyboard.press("Tab");
    const focusInfo = await page.evaluate(() => {
      const active = document.activeElement as HTMLElement | null;
      return {
        testId: active?.getAttribute("data-testid") ?? null,
        boxShadow: active ? getComputedStyle(active).boxShadow : "none",
      };
    });
    expect(focusInfo.testId).toBe("save-as-master-btn");
    expect(focusInfo.boxShadow).not.toBe("none");
    expect(focusInfo.boxShadow).not.toMatch(/^rgba\(\s*0,\s*0,\s*0,\s*0\s*\)/);

    // ManagedResumeForm updates Typst preview live while typing without blurring
    const managedSource = buildManagedV2Resume();
    await page.route("**/api/resumes", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({ json: { success: true, data: [] } });
      } else {
        await route.continue();
      }
    });
    await page.addInitScript((src) => {
      localStorage.setItem("resumeforge_typst_source", src);
    }, managedSource);

    await page.goto("/editor?mode=visual");
    await expect(page.getByTestId("managed-resume-form")).toBeVisible({ timeout: 15000 });
    const renderedImg = page
      .getByTestId("layout-page-preview")
      .locator("img[data-page-rendered='true']")
      .first();
    await expect(renderedImg).toBeVisible({ timeout: 30000 });
    const initialSrc = await renderedImg.getAttribute("src");

    const nameInput = page.getByRole("textbox", { name: "Full name", exact: true });
    await nameInput.click();
    await nameInput.fill("Morgan LiveUpdateCheck");
    await expect(nameInput).toBeFocused();

    // Live debounced update commits source and refreshes preview without calling blur()
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem("resumeforge_typst_source") || ""), {
        timeout: 5000,
      })
      .toContain("Morgan LiveUpdateCheck");
    await expect
      .poll(() => renderedImg.getAttribute("src"), { timeout: 15000 })
      .not.toBe(initialSrc);
    await expect(nameInput).toBeFocused();
  });

  test("4. 375x812 mobile /practice renders first problem card in first viewport fold and TrackerSubNav tabs are >= 44px tall", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/practice");
    await page.waitForLoadState("networkidle");

    const firstProblemCard = page.locator("button:has(h3)").first();
    await expect(firstProblemCard).toBeVisible();
    const cardBox = await firstProblemCard.boundingBox();
    expect(cardBox).not.toBeNull();
    expect(cardBox!.y).toBeLessThan(812);

    await page.goto("/tracker/feed");
    await page.waitForLoadState("networkidle");

    const tabIds = [
      "tracker-tab-feed",
      "tracker-tab-all",
      "tracker-tab-applied",
      "tracker-tab-saved",
      "tracker-tab-outcomes",
    ];
    for (const id of tabIds) {
      const tab = page.getByTestId(id);
      await expect(tab).toBeVisible();
      const box = await tab.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
  });

  test("5. WAI-ARIA ArrowRight / ArrowLeft moves focus across tabs on /tailor and /library", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    // /tailor tablist
    await page.goto("/tailor");
    await page.waitForLoadState("networkidle");

    const jobTab = page.getByTestId("tailor-tab-job-info");
    const reviewTab = page.getByTestId("tailor-tab-3-pane");
    await expect(jobTab).toBeVisible();
    await expect(reviewTab).toBeVisible();

    await jobTab.focus();
    await expect(jobTab).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(reviewTab).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(jobTab).toBeFocused();

    // /library tablist
    await page.goto("/library");
    await page.waitForLoadState("networkidle");

    const libraryTablist = page.locator('[role="tablist"]').first();
    await expect(libraryTablist).toBeVisible();
    const libraryTab = libraryTablist.getByRole("tab", { name: /^Library/i });
    const reviewQueueTab = libraryTablist.getByRole("tab", { name: /^Review Queue/i });

    await libraryTab.focus();
    await expect(libraryTab).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(reviewQueueTab).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(libraryTab).toBeFocused();
  });
});
