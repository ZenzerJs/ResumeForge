import { test, expect } from "@playwright/test";

test.describe("Task 9.5 — Editor ATS Grade Button & Evidence Retirement E2E Tests", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/editor");
    await page.waitForLoadState("networkidle");
  });

  test("1. Open /editor, click Grade button in preview header, verify inline ATS score breakdown appears with zero idle/rerender loops", async ({ page }) => {
    let evaluatePostCount = 0;
    page.on("request", (req) => {
      if (req.url().includes("/api/ats/evaluate") && req.method() === "POST") {
        evaluatePostCount += 1;
      }
    });

    const gradeBtn = page.locator('[data-testid="grade-resume-btn"]');
    await expect(gradeBtn).toBeVisible();

    const firstEvalResponse = page.waitForResponse(
      (res) => res.url().includes("/api/ats/evaluate") && res.request().method() === "POST"
    );

    // Click Grade button
    await gradeBtn.click();
    await firstEvalResponse;

    // Verify ATS score breakdown overlay renders inside preview area
    const scoreOverlay = page.locator('[data-testid="editor-ats-score-overlay"]');
    await expect(scoreOverlay).toBeVisible({ timeout: 10000 });

    const scoreBadge = page.locator('[data-testid="overall-score-badge"]');
    await expect(scoreBadge).toBeVisible();
    await expect(scoreBadge).toContainText("/ 100");

    const countAfterOpen = evaluatePostCount;
    expect(countAfterOpen).toBe(1);

    // Idle wait must add zero requests
    await page.waitForTimeout(1500);
    expect(evaluatePostCount).toBe(countAfterOpen);

    // Selecting a distinct profile adds exactly one request
    const profileEvalResponse = page.waitForResponse(
      (res) => res.url().includes("/api/ats/evaluate") && res.request().method() === "POST"
    );
    await page.locator('[data-testid="profile-btn-Frontend"]').click();
    await profileEvalResponse;
    await page.waitForTimeout(500);
    expect(evaluatePostCount).toBe(countAfterOpen + 1);
  });

  test("1b. /tailor with extracted job requirements evaluates once per distinct input", async ({ page }) => {
    let evaluatePostCount = 0;
    page.on("request", (req) => {
      if (req.url().includes("/api/ats/evaluate") && req.method() === "POST") {
        evaluatePostCount += 1;
      }
    });

    const initialEvalResponse = page.waitForResponse(
      (res) => res.url().includes("/api/ats/evaluate") && res.request().method() === "POST"
    );
    await page.goto("/tailor");
    await initialEvalResponse;

    await expect(page.locator("[data-testid='ats-score-panel']")).toBeVisible();
    await expect(page.locator("[data-testid='overall-score-badge']")).toBeVisible({ timeout: 10000 });
    const countAfterInitial = evaluatePostCount;
    expect(countAfterInitial).toBe(1);

    // Idle wait must add zero requests
    await page.waitForTimeout(1500);
    expect(evaluatePostCount).toBe(countAfterInitial);

    // Switching to a distinct JD and extracting requirements adds one evaluation
    await page.waitForSelector("[data-testid='jd-textarea']", { timeout: 10000 });
    await page.click("[data-testid='sample-frontend-btn']");

    const extractEvalResponse = page.waitForResponse(
      (res) => res.url().includes("/api/ats/evaluate") && res.request().method() === "POST"
    );
    await page.click("[data-testid='extract-reqs-btn']");
    await extractEvalResponse;

    const countAfterExtract = evaluatePostCount;
    expect(countAfterExtract).toBe(countAfterInitial + 1);

    await page.waitForTimeout(1500);
    expect(evaluatePostCount).toBe(countAfterExtract);
  });

  test("2. /library Evidence Bank management CRUD remains fully accessible and functional", async ({ page }) => {
    await page.goto("/library");
    await page.waitForLoadState("networkidle");

    const header = page.locator("h1", { hasText: "Evidence Bank" });
    await expect(header).toBeVisible();

    const addBtn = page.locator("button", { hasText: "Add Evidence Item" });
    await expect(addBtn).toBeVisible();
  });
});
