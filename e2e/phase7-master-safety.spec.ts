import { test, expect } from "@playwright/test";

test.describe("Task 7.9: Save as Master + Revert to Master Safety Protocol E2E Tests", () => {
  test("1. Save as Master requires confirmation modal and provides Undo Overwrite banner", async ({ page }) => {
    await page.goto("/editor");
    await page.waitForSelector("[data-testid='save-as-master-btn']", { timeout: 15000 });

    // Click Save as Master Resume button
    await page.click("[data-testid='save-as-master-btn']");

    // Assert confirmation modal appears
    await expect(page.locator("[data-testid='save-master-confirm-modal']")).toBeVisible();

    // Click Confirm Overwrite & Save
    const savePromise = page.waitForResponse(
      (resp) => resp.url().includes("/api/resumes/save-master") && resp.request().method() === "POST" && resp.ok()
    );
    await page.click("[data-testid='confirm-save-master-btn']");
    await savePromise;

    // Assert modal closes, saved indicator shows, and Undo Overwrite banner appears
    await expect(page.locator("[data-testid='save-master-confirm-modal']")).toBeHidden();
    await page.waitForSelector("text=Saved as Master!", { timeout: 5000 });
    await expect(page.locator("[data-testid='undo-overwrite-banner']")).toBeVisible();
    await expect(page.locator("[data-testid='undo-overwrite-btn']")).toBeVisible();
  });

  test("2. Revert to Master button exists in header", async ({ page }) => {
    await page.goto("/editor");
    await page.waitForSelector("[data-testid='revert-to-master-btn']", { timeout: 10000 });
    await expect(page.locator("[data-testid='revert-to-master-btn']")).toBeVisible();
  });
});
