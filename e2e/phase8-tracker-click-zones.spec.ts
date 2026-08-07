import { test, expect } from "@playwright/test";

test.describe("Task 8.3 & Task 8.6: Tracker Card Click-Zone & Unified Actions E2E Tests", () => {
  test.beforeEach(async ({ page, request }) => {
    // Seed job with valid apply link
    await request.post("/api/jobs", {
      data: {
        company: "Playwright E2E Corp",
        roleTitle: "Senior Automation Engineer",
        rawDescription: "TypeScript, Playwright, CI/CD, Next.js",
        notes: "Apply Link: https://example.com/jobs/12345",
      },
    });

    await page.goto("/tracker");
    await page.waitForSelector("[data-testid^='tracker-job-card-']", { timeout: 15000 });
  });

  test("1. Clicking card title/body opens external job applyUrl in a new tab popup", async ({ page, context }) => {
    // Find job card that has an external apply link
    const cardWithLink = page.locator("[data-testid^='tracker-job-card-']").filter({ has: page.locator("a[data-testid^='open-original-btn-']") }).first();
    await expect(cardWithLink).toBeVisible();

    // Listen for new tab popup
    const popupPromise = context.waitForEvent("page", { timeout: 5000 });

    // Click card title
    await cardWithLink.locator("h3").first().click();

    const popup = await popupPromise;
    expect(popup).toBeDefined();
    await popup.close();
  });

  test("2. Clicking action bar buttons (Copy JD, Tailor) stops propagation and does NOT open external popup", async ({ page, context }) => {
    const cardWithLink = page.locator("[data-testid^='tracker-job-card-']").filter({ has: page.locator("a[data-testid^='open-original-btn-']") }).first();
    await expect(cardWithLink).toBeVisible();

    let popupTriggered = false;
    const pageListener = () => {
      popupTriggered = true;
    };
    context.on("page", pageListener);

    // Click Tailor Resume button inside action bar (links to /tailor within current tab)
    const tailorBtn = cardWithLink.locator("a:has-text('Tailor Resume')").first();
    await tailorBtn.click();

    // Wait short delay to ensure no external popup tab was opened
    await page.waitForTimeout(500);

    context.off("page", pageListener);

    // Assert event propagation was stopped: NO external popup tab opened
    expect(popupTriggered).toBe(false);
  });

  test("3. Open Posting button opens external applyUrl in new tab", async ({ page, context }) => {
    const openBtn = page.locator("a[data-testid^='open-original-btn-']").first();
    await expect(openBtn).toBeVisible();

    const popupPromise = context.waitForEvent("page", { timeout: 5000 });
    await openBtn.click();
    const popup = await popupPromise;
    expect(popup).toBeDefined();
    await popup.close();
  });

  test("4. Generate/Open Cover Letter action button navigates to /tailor with active jobId", async ({ page }) => {
    const coverBtn = page.locator("[data-testid^='generate-cover-letter-btn-'], [data-testid^='open-cover-letter-btn-']").first();
    await expect(coverBtn).toBeVisible();

    await coverBtn.click();
    await page.waitForURL(/\/tailor\?jobId=/, { timeout: 10000 });
    expect(page.url()).toContain("jobId=");
    await expect(page.locator("[data-testid='active-job-header-banner']")).toBeVisible();
  });
});
