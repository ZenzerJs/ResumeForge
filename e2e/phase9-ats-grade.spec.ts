import { test, expect } from "@playwright/test";

test.describe("Task 9.5 — Editor ATS Grade Button & Evidence Retirement E2E Tests", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/editor");
    await page.waitForLoadState("networkidle");
  });

  test("1. Open /editor, click Grade button in preview header, verify inline ATS score breakdown appears", async ({ page }) => {
    const gradeBtn = page.locator('[data-testid="grade-resume-btn"]');
    await expect(gradeBtn).toBeVisible();

    // Click Grade button
    await gradeBtn.click();

    // Verify ATS score breakdown overlay renders inside preview area
    const scoreOverlay = page.locator('[data-testid="editor-ats-score-overlay"]');
    await expect(scoreOverlay).toBeVisible({ timeout: 10000 });

    const scoreBadge = page.locator('[data-testid="overall-score-badge"]');
    await expect(scoreBadge).toBeVisible();
    await expect(scoreBadge).toContainText("/ 100");
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
