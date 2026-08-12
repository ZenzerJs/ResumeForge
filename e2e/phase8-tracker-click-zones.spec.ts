import { test, expect } from "@playwright/test";

test.describe("Task 8.3 & Task 8.6: Tracker Card Click-Zone & Unified Actions E2E Tests", () => {
  test.beforeEach(async ({ page, request }) => {
    const created = await request.post("/api/jobs", {
      data: {
        company: "Playwright E2E Corp",
        roleTitle: "Senior Automation Engineer",
        rawDescription: "TypeScript, Playwright, CI/CD, Next.js",
      },
    });
    expect(created.ok()).toBeTruthy();
    const json = await created.json();
    const patch = await request.patch(`/api/jobs/${json.data.id}`, {
      data: { notes: "Apply Link: https://example.com/jobs/12345" },
    });
    expect(patch.ok()).toBeTruthy();

    await page.goto("/tracker");
    await page.waitForSelector("[data-testid^='tracker-job-card-']", { timeout: 15000 });
  });

  test("1. Clicking card row selects job for detail (does NOT open apply URL)", async ({
    page,
    context,
  }) => {
    const cardWithLink = page
      .locator("[data-testid^='tracker-job-card-']")
      .filter({ has: page.locator("a[data-testid^='open-original-btn-']") })
      .first();
    await expect(cardWithLink).toBeVisible();

    let popupTriggered = false;
    const pageListener = () => {
      popupTriggered = true;
    };
    context.on("page", pageListener);

    await cardWithLink.locator("h3").first().click();
    await page.waitForTimeout(500);

    context.off("page", pageListener);
    expect(popupTriggered).toBe(false);
    await expect(page.locator("[data-testid='job-detail-pane']")).toBeVisible();
  });

  test("2. Clicking Tailor Resume does NOT open external popup", async ({ page, context }) => {
    const cardWithLink = page
      .locator("[data-testid^='tracker-job-card-']")
      .filter({ has: page.locator("a[data-testid^='open-original-btn-']") })
      .first();
    await expect(cardWithLink).toBeVisible();

    let popupTriggered = false;
    const pageListener = () => {
      popupTriggered = true;
    };
    context.on("page", pageListener);

    const tailorBtn = cardWithLink.locator("a:has-text('Tailor Resume')").first();
    await tailorBtn.click();
    await page.waitForTimeout(500);

    context.off("page", pageListener);
    expect(popupTriggered).toBe(false);
  });

  test("3. Open Posting icon opens external applyUrl in new tab", async ({ page, context }) => {
    const openBtn = page.locator("a[data-testid^='open-original-btn-']").first();
    await expect(openBtn).toBeVisible();

    const popupPromise = context.waitForEvent("page", { timeout: 5000 });
    await openBtn.click();
    const popup = await popupPromise;
    expect(popup).toBeDefined();
    await popup.close();
  });

  test("4. Generate/Open Cover Letter in detail navigates to /tailor with jobId", async ({
    page,
  }) => {
    const card = page.locator("[data-testid^='tracker-job-card-']").first();
    await card.click();
    await expect(page.locator("[data-testid='job-detail-pane']")).toBeVisible();

    const coverBtn = page
      .locator(
        "[data-testid^='generate-cover-letter-btn-'], [data-testid^='open-cover-letter-btn-']",
      )
      .first();
    await expect(coverBtn).toBeVisible();

    await coverBtn.click();
    await page.waitForURL(/\/tailor\?jobId=/, { timeout: 10000 });
    expect(page.url()).toContain("jobId=");
    await expect(page.locator("[data-testid='active-job-header-banner']")).toBeVisible();
  });
});
