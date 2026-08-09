import { test, expect } from "@playwright/test";

test.describe("Task 9.6 — Tailor AI Feedback -> Editor Handoff E2E Tests", () => {
  test("1. Real UI journey: Click Use as Prompt in Tailor -> Navigates to /editor with seeded feedback banner", async ({ page }) => {
    // Mock the AI qualitative review API route
    await page.route("**/api/ai/qualitative-review", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            jdContextAdjustment: 5,
            adjustmentReasoning: [],
            overviewCommentary: "E2E Test: Add metrics for AWS infrastructure deployment and Kubernetes clusters.",
            categoryFeedbacks: [],
            bulletFeedbacks: [],
            nextStepsAdvice: ["Add Kubernetes deployment bullet to Experience section"],
          },
        }),
      });
    });

    // Navigate to /tailor
    await page.goto("/tailor");
    await page.waitForLoadState("networkidle");

    // Configure mock AI settings in localStorage
    await page.evaluate(() => {
      localStorage.setItem(
        "resumeforge_ai_settings",
        JSON.stringify({ provider: "openai", apiKey: "sk-test-mock-key" })
      );
    });

    // Fill job description text to enable Extract Requirements button
    const jdTextarea = page.locator("textarea").first();
    await expect(jdTextarea).toBeVisible();
    await jdTextarea.fill(
      "Senior Software Engineer role requiring TypeScript, Node.js, PostgreSQL, Docker, and microservices architecture experience."
    );

    // Click Extract Requirements button
    const extractBtn = page.locator('[data-testid="extract-reqs-btn"]');
    await expect(extractBtn).toBeEnabled();
    await extractBtn.click();

    // Click Get AI Feedback button in ATS Score Panel
    const getFeedbackBtn = page.locator('[data-testid="get-ai-feedback-btn"]');
    await expect(getFeedbackBtn).toBeVisible({ timeout: 10000 });
    await getFeedbackBtn.click();

    // Verify Qualitative Review Panel & Use as prompt button appear
    const useAsPromptBtn = page.locator('[data-testid="use-as-prompt-btn"]');
    await expect(useAsPromptBtn).toBeVisible({ timeout: 10000 });

    // Click the actual Use as prompt button in the UI
    await useAsPromptBtn.click();

    // Verify navigation landed on /editor with active jobId query parameter
    await expect(page).toHaveURL(/\/editor/);

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

  test("2. Unseeded visit to /editor without prior Tailor review shows default unseeded AI chat", async ({ page }) => {
    await page.goto("/editor");
    await page.waitForLoadState("networkidle");

    await expect(page.locator('[data-testid="seeded-feedback-banner"]')).not.toBeVisible();
  });
});
