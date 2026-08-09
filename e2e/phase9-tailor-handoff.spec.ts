import { test, expect } from "@playwright/test";

test.describe("Task 9.6 — Tailor AI Feedback -> Editor Handoff E2E Tests", () => {
  test("1. Tailor page -> Use as prompt -> Navigates to /editor with seeded feedback banner", async ({ page }) => {
    // Navigate to /tailor
    await page.goto("/tailor");
    await page.waitForLoadState("networkidle");

    // Click Get AI Feedback button if review panel is visible, or simulate seeded state in sessionStorage
    await page.evaluate(() => {
      const activeJobId = "job-e2e-handoff-1";
      sessionStorage.setItem("resumeforge_active_job_id", activeJobId);
      sessionStorage.setItem(
        `resumeforge_tailor_feedback_${activeJobId}`,
        JSON.stringify({
          jobId: activeJobId,
          overviewCommentary: "E2E Test: Add metrics for AWS infrastructure deployment and Kubernetes clusters.",
          nextStepsAdvice: ["Add Kubernetes deployment bullet to Experience section"],
          timestamp: Date.now(),
        })
      );
    });

    // Navigate to /editor
    await page.goto("/editor?jobId=job-e2e-handoff-1");
    await page.waitForLoadState("networkidle");

    // Verify seeded feedback banner appears in AI sidebar
    const banner = page.locator('[data-testid="seeded-feedback-banner"]');
    await expect(banner).toBeVisible({ timeout: 10000 });
    await expect(banner).toContainText("Seeded Feedback from Tailor Review");
    await expect(banner).toContainText("Kubernetes");

    // Click Dismiss Context button
    const dismissBtn = page.locator('[data-testid="dismiss-seeded-feedback-btn"]');
    await expect(dismissBtn).toBeVisible();
    await dismissBtn.click();

    // Verify banner disappears
    await expect(banner).not.toBeVisible();

    // Reload page and verify banner remains unseeded (cleared)
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.locator('[data-testid="seeded-feedback-banner"]')).not.toBeVisible();
  });
});
