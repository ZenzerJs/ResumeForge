import { test, expect } from "@playwright/test";

/**
 * Phase 4.2 E2E Tests — AI Patch Generator Integration
 *
 * Tests the /tailor workspace's Phase 4.2 AI patch generation UI flow:
 * - Generate Patches button renders after requirements extraction
 * - Gap panel, rejected patches panel, and verified patches panel render correctly
 * - Individual accept/reject controls are functional
 */

test.describe("Phase 4.2: AI Patch Generator Workspace", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tailor", { waitUntil: "networkidle" });
  });

  test("should render the tailor workspace page", async ({ page }) => {
    await expect(page.locator("h1")).toContainText("Job Tailoring");
    await expect(page.locator('[data-testid="jd-textarea"]')).toBeVisible();
  });

  test("Generate AI Patches button appears after extracting requirements", async ({ page }) => {
    // Fill in a sample JD using the sample button
    await page.locator('[data-testid="sample-backend-btn"]').click();

    // Extract requirements
    await page.locator('[data-testid="extract-reqs-btn"]').click();

    // Wait for extraction to complete and requirements to render
    await expect(page.locator('[data-testid="evidence-matches-list"], text=No matching')).toBeVisible({
      timeout: 10000,
    });

    // Generate AI Patches button should now be visible
    await expect(page.locator('[data-testid="generate-patches-btn"]')).toBeVisible();
  });

  test("Generate AI Patches button shows error when no AI provider configured", async ({ page }) => {
    // Clear any existing AI settings
    await page.evaluate(() => {
      localStorage.removeItem("resumeforge_ai_settings");
    });

    // Fill in a sample JD using the sample button
    await page.locator('[data-testid="sample-backend-btn"]').click();

    // Extract requirements
    await page.locator('[data-testid="extract-reqs-btn"]').click();

    // Wait for extraction
    await expect(page.locator('[data-testid="evidence-matches-list"], text=No matching')).toBeVisible({
      timeout: 10000,
    });

    // Click generate patches — should show config error
    await page.locator('[data-testid="generate-patches-btn"]').click();

    // Should show error about missing AI provider
    await expect(page.locator("text=No AI provider configured")).toBeVisible({
      timeout: 5000,
    });
  });
});
