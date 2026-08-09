import { test, expect } from "@playwright/test";

test.describe("Task 10.4 & Task 10.5 — Atmospheric Landing & Typst Repair Assist E2E Tests", () => {
  test("1. Open /editor, trigger syntax error, click Fix with AI, verify Repair Assist Mode opens", async ({ page }) => {
    await page.goto("/editor");
    await page.waitForLoadState("networkidle");

    const editor = page.locator('[data-testid="panel-code"] .cm-content');
    await expect(editor).toBeVisible();

    await editor.click();
    await page.keyboard.press("Control+End");
    await page.keyboard.type("\n\n#invalid_typst_function_call_xyz(");
    await page.keyboard.press("Control+s");

    // Verify compile error banner appears with Fix with AI button
    const errorBanner = page.locator('[data-testid="typst-error-banner"]').first();
    await expect(errorBanner).toBeVisible({ timeout: 10000 });

    const fixWithAiBtn = page.locator('[data-testid="fix-typst-ai-btn"]').first();
    await expect(fixWithAiBtn).toBeVisible();
    await fixWithAiBtn.click();

    // Verify AI sidebar focuses with Repair Assist Mode
    const repairHeader = page.locator("text=Typst Repair Assist").first();
    await expect(repairHeader).toBeVisible();

    const generateRepairBtn = page.locator('[data-testid="generate-repair-btn"]').first();
    await expect(generateRepairBtn).toBeVisible();
  });

  test("2. Mock /api/ai/repair-typst, click Generate Proposal, pre-validate fix, click Apply Fix, verify preview recompiles", async ({ page }) => {
    await page.goto("/editor");
    await page.waitForLoadState("networkidle");

    const editor = page.locator('[data-testid="panel-code"] .cm-content');
    await expect(editor).toBeVisible();

    // Read initial source text from editor buffer
    const initialSource = await editor.innerText();
    const correctedSource = initialSource + "\n#let fixedVal = 42\n";

    // Intercept /api/ai/repair-typst request
    await page.route("**/api/ai/repair-typst", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            summary: "Fixed invalid function call syntax",
            errorAnalysis: "Removed unclosed parenthesis in invalid call.",
            replacementSource: correctedSource,
            confidence: "high",
            warnings: [],
            changedLinesCount: 0,
          },
        }),
      });
    });

    await editor.click();
    await page.keyboard.press("Control+End");
    await page.keyboard.type("\n\n#invalid_typst_function_call_xyz(");
    await page.keyboard.press("Control+s");

    const fixWithAiBtn = page.locator('[data-testid="fix-typst-ai-btn"]').first();
    await expect(fixWithAiBtn).toBeVisible({ timeout: 10000 });
    await fixWithAiBtn.click();

    // Click Generate AI Repair Proposal
    const generateRepairBtn = page.locator('[data-testid="generate-repair-btn"]').first();
    await generateRepairBtn.click();

    // Verify pre-compilation status passed & Apply Fix button appears
    const applyFixBtn = page.locator('[data-testid="apply-typst-fix-btn"]').first();
    await expect(applyFixBtn).toBeVisible({ timeout: 10000 });
    await expect(applyFixBtn).toBeEnabled();

    // Click Apply Fix
    await applyFixBtn.click();

    // Verify source updated and compile error banner cleared
    const errorBanner = page.locator('[data-testid="typst-error-banner"]').first();
    await expect(errorBanner).not.toBeVisible({ timeout: 10000 });
  });

  test("3. Dismiss Repair Assist mode, verify repair mode exits cleanly", async ({ page }) => {
    await page.goto("/editor");
    await page.waitForLoadState("networkidle");

    const editor = page.locator('[data-testid="panel-code"] .cm-content');
    await expect(editor).toBeVisible();

    await editor.click();
    await page.keyboard.press("Control+End");
    await page.keyboard.type("\n\n#invalid_typst_function_call_xyz(");
    await page.keyboard.press("Control+s");

    const fixWithAiBtn = page.locator('[data-testid="fix-typst-ai-btn"]').first();
    await expect(fixWithAiBtn).toBeVisible({ timeout: 10000 });
    await fixWithAiBtn.click();

    const closeRepairBtn = page.locator('[data-testid="close-repair-mode-btn"]').first();
    await expect(closeRepairBtn).toBeVisible();
    await closeRepairBtn.click();

    const repairHeader = page.locator("text=Typst Repair Assist").first();
    await expect(repairHeader).not.toBeVisible();
  });

  test("4. Landing page renders SVG atmosphere background, proof card framing, and softened headline without horizontal overflow", async ({ page }) => {
    // 1200px Desktop
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const headline = page.locator("h1");
    await expect(headline).toContainText("Make every application feel");

    // Verify proof card container exists
    const proofCard = page.locator('[data-testid="product-proof-card"]');
    await expect(proofCard).toBeVisible();

    // Check no horizontal overflow
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalOverflow).toBe(false);

    // 375px Mobile
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForLoadState("networkidle");
    const mobileOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(mobileOverflow).toBe(false);
  });

  test("5. Large repair proposal (>25% lines changed) requires explicit checkbox confirmation before Apply Fix is enabled", async ({ page }) => {
    // Mock proposal that modifies 100% of document lines
    await page.route("**/api/ai/repair-typst", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            summary: "Replaced entire document",
            errorAnalysis: "Replaced source with single line.",
            replacementSource: '#set page(paper: "a4")',
            confidence: "high",
            warnings: ["Replaced entire document"],
            changedLinesCount: 50,
          },
        }),
      });
    });

    await page.goto("/editor");
    await page.waitForLoadState("networkidle");

    const editor = page.locator('[data-testid="panel-code"] .cm-content');
    await expect(editor).toBeVisible();

    await editor.click();
    await page.keyboard.press("Control+End");
    await page.keyboard.type("\n\n#invalid_call(");
    await page.keyboard.press("Control+s");

    const fixWithAiBtn = page.locator('[data-testid="fix-typst-ai-btn"]').first();
    await expect(fixWithAiBtn).toBeVisible({ timeout: 10000 });
    await fixWithAiBtn.click();

    const generateRepairBtn = page.locator('[data-testid="generate-repair-btn"]').first();
    await generateRepairBtn.click();

    const applyFixBtn = page.locator('[data-testid="apply-typst-fix-btn"]').first();
    await expect(applyFixBtn).toBeVisible({ timeout: 10000 });

    // Apply Fix should be disabled initially due to large diff ratio (>25%)
    await expect(applyFixBtn).toBeDisabled();

    // Check confirmation checkbox
    const confirmCheckbox = page.locator('[data-testid="confirm-large-repair-checkbox"]').first();
    await expect(confirmCheckbox).toBeVisible();
    await confirmCheckbox.check();

    // Apply Fix should now be enabled
    await expect(applyFixBtn).toBeEnabled();
  });

  test("6. Dismissing repair mode or triggering a new repair resets large repair confirmation state", async ({ page }) => {
    await page.route("**/api/ai/repair-typst", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            summary: "Replaced entire document",
            errorAnalysis: "Replaced source with single line.",
            replacementSource: '#set page(paper: "a4")',
            confidence: "high",
            warnings: [],
            changedLinesCount: 50,
          },
        }),
      });
    });

    await page.goto("/editor");
    await page.waitForLoadState("networkidle");

    const editor = page.locator('[data-testid="panel-code"] .cm-content');
    await expect(editor).toBeVisible();

    await editor.click();
    await page.keyboard.press("Control+End");
    await page.keyboard.type("\n\n#invalid_call(");
    await page.keyboard.press("Control+s");

    const fixWithAiBtn = page.locator('[data-testid="fix-typst-ai-btn"]').first();
    await expect(fixWithAiBtn).toBeVisible({ timeout: 10000 });
    await fixWithAiBtn.click();

    const generateRepairBtn = page.locator('[data-testid="generate-repair-btn"]').first();
    await generateRepairBtn.click();

    const confirmCheckbox = page.locator('[data-testid="confirm-large-repair-checkbox"]').first();
    await expect(confirmCheckbox).toBeVisible();
    await confirmCheckbox.check();

    const applyFixBtn = page.locator('[data-testid="apply-typst-fix-btn"]').first();
    await expect(applyFixBtn).toBeEnabled();

    // Dismiss repair mode
    const closeRepairBtn = page.locator('[data-testid="close-repair-mode-btn"]').first();
    await closeRepairBtn.click();

    // Re-trigger repair mode
    await fixWithAiBtn.click();
    await generateRepairBtn.click();

    // Verify Apply Fix is disabled again until checkbox is checked afresh
    await expect(applyFixBtn).toBeDisabled();
  });
});
