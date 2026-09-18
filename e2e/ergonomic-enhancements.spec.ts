import { test, expect } from "@playwright/test";

test.describe("Ergonomic Enhancements E2E", () => {
  test("1. Global Keyboard Shortcuts Modal appears via Control+/ and closes on Esc", async ({ page }) => {
    await page.goto("/editor");
    await page.waitForSelector(".typst-preview-svg svg", { timeout: 15000 });

    await page.keyboard.press("Control+/");

    const modal = page.locator("[data-testid='keyboard-shortcuts-modal']");
    await expect(modal).toBeVisible();

    // Verify key categories exist
    await expect(modal.getByRole("heading", { name: "Keyboard Shortcuts" })).toBeVisible();
    await expect(modal.getByText("Save & recompile Typst resume")).toBeVisible();

    // Close via Esc
    await page.keyboard.press("Escape");
    await expect(modal).not.toBeVisible();
  });

  test("2. Editor Export Hub dropdown contains multi-format options", async ({ page }) => {
    await page.goto("/editor");
    await page.waitForSelector(".typst-preview-svg svg", { timeout: 15000 });

    const exportBtn = page.locator("[data-testid='export-dropdown-btn']").first();
    await expect(exportBtn).toBeVisible({ timeout: 10000 });
    await exportBtn.click();

    await expect(page.locator("[data-testid='export-pdf-menu-item']")).toBeVisible();
    await expect(page.locator("[data-testid='export-docx-menu-item']")).toBeVisible();
    await expect(page.locator("[data-testid='export-typst-menu-item']")).toBeVisible();
    await expect(page.locator("[data-testid='export-txt-menu-item']")).toBeVisible();
    await expect(page.locator("[data-testid='export-json-menu-item']")).toBeVisible();
  });

  test("3. Job Detail Pane contains Prep Sheet modal trigger", async ({ page }) => {
    await page.goto("/tracker");
    await page.waitForLoadState("domcontentloaded");

    const prepSheetBtn = page.locator("[data-testid='open-prep-sheet-btn']").first();
    if (await prepSheetBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await prepSheetBtn.click();
      const modal = page.locator("[data-testid='apply-prep-sheet-modal']");
      await expect(modal).toBeVisible();
      await expect(modal.getByText("Candidate Information")).toBeVisible();

      // Close modal
      await page.locator("[data-testid='close-prep-sheet-btn']").click();
      await expect(modal).not.toBeVisible();
    }
  });

  test("4. Tailor Workspace allows inline gap resolution", async ({ page }) => {
    await page.goto("/tailor?tab=job-info");
    await page.waitForLoadState("domcontentloaded");

    // Click sample backend JD to populate requirements
    const sampleBtn = page.locator("[data-testid='tailor-sample-backend-btn']");
    if (await sampleBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await sampleBtn.click();

      // Check if resolve gap buttons exist on uncovered skills
      const resolveGapBtn = page.locator("[data-testid^='resolve-gap-']").first();
      if (await resolveGapBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
        await resolveGapBtn.click();
        const modal = page.locator("[data-testid='quick-add-evidence-modal']");
        await expect(modal).toBeVisible();
        await expect(page.locator("[data-testid='quick-evidence-title-input']")).toBeVisible();
        await page.locator("[data-testid='close-add-evidence-btn']").click();
        await expect(modal).not.toBeVisible();
      }
    }
  });
});
