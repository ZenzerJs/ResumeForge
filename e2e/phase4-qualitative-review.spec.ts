import { test, expect } from "@playwright/test";

test.describe("Phase 4.3b On-Demand AI Qualitative Reviewer E2E Tests", () => {
  test("1. Tailor Page -> Render ATS Score Panel -> Click Get AI Feedback -> Show Opt-In Trigger", async ({
    page,
  }) => {
    await page.goto("/tailor");
    await page.waitForSelector("[data-testid='jd-textarea']", { timeout: 10000 });

    // 1. Fill sample JD & extract requirements
    await page.click("[data-testid='sample-backend-btn']");
    await page.click("[data-testid='extract-reqs-btn']");

    // 2. Verify ATS Score Panel renders
    await page.waitForSelector("[data-testid='ats-score-panel']", { timeout: 5000 });

    // 3. Verify Get AI Feedback button is present
    const aiFeedbackBtn = page.locator("[data-testid='get-ai-feedback-btn']");
    await expect(aiFeedbackBtn).toBeVisible();

    // 4. Click button without AI settings configured
    await aiFeedbackBtn.click();

    // 5. Verify user-friendly configuration error banner displays
    await page.waitForSelector("[data-testid='qualitative-error-banner']", { timeout: 5000 });
    const errorText = await page.locator("[data-testid='qualitative-error-banner']").textContent();
    expect(errorText).toContain("No AI provider configured");
  });

  test("2. Rejection Path: POST /api/ai/qualitative-review returns 400 on invalid payload", async ({
    request,
  }) => {
    const res = await request.post("/api/ai/qualitative-review", {
      data: {
        providerConfig: { provider: "openai" },
        // missing required fields
      },
    });

    expect(res.status()).toBe(400);

    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toContain("Invalid input");
  });
});
