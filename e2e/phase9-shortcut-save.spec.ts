import { test, expect } from "@playwright/test";

test.describe("Task 9.3 — Ctrl+S Save & Auto-Compile Protocol E2E Tests", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/editor");
    await page.waitForLoadState("networkidle");
  });

  test("1. Edit Typst source, press Ctrl+S, verify save confirmation toast appears and preview SVG updates", async ({ page }) => {
    const editor = page.locator('[data-testid="panel-code"] .cm-content');
    await expect(editor).toBeVisible();

    // Type new section header
    await editor.click();
    await page.keyboard.press("Control+End");
    await page.keyboard.type("\n\n== CtrlS Test Section Header\n- Test bullet point under CtrlS");

    // Press Control+S
    await page.keyboard.press("Control+s");

    // Verify draft save confirmation toast appears
    const toast = page.locator('[data-testid="shortcut-save-toast"]');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText("Draft Saved & Recompiled");

    // Verify Save as Master confirmation modal did NOT open
    const confirmModal = page.locator('[data-testid="save-master-confirm-modal"]');
    await expect(confirmModal).not.toBeVisible();

    // Verify preview SVG contains edited section header
    const previewSvg = page.locator('[data-testid="typst-preview-svg"]');
    await expect(previewSvg).toBeVisible({ timeout: 10000 });
  });

  test("2. Typst syntax error + Ctrl+S shows draft save toast while preserving error banner", async ({ page }) => {
    const editor = page.locator('[data-testid="panel-code"] .cm-content');
    await expect(editor).toBeVisible();

    // Introduce invalid Typst syntax
    await editor.click();
    await page.keyboard.press("Control+End");
    await page.keyboard.type("\n\n#invalid_typst_function_call_xyz(");

    // Press Control+S
    await page.keyboard.press("Control+s");

    // Save toast should still appear
    const toast = page.locator('[data-testid="shortcut-save-toast"]');
    await expect(toast).toBeVisible();

    // Error banner should display compile error
    const errorBanner = page.locator('[data-testid="typst-error-banner"]');
    await expect(errorBanner).toBeVisible();

    // Save as Master modal must remain closed
    const confirmModal = page.locator('[data-testid="save-master-confirm-modal"]');
    await expect(confirmModal).not.toBeVisible();
  });
});
