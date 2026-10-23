import { test, expect } from "@playwright/test";

test.describe("Guest Guardrail Export Flow — Unfrozen Master vs. Patched Variant", () => {
  test("1. Guest master/starter self-export is allowed when no frozen master exists", async ({ page }) => {
    // Ensure guest has no frozen master in /api/resumes
    await page.route("**/api/resumes", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true, data: [] }),
        });
        return;
      }
      await route.continue();
    });

    await page.goto("/editor");
    const exportBtn = page.locator('[data-testid="export-dropdown-btn"]:visible').first();
    await expect(exportBtn).toBeVisible({ timeout: 20000 });
    await expect(exportBtn).toBeEnabled({ timeout: 20000 });

    const downloadPromise = page.waitForEvent("download", { timeout: 20000 });
    await exportBtn.click();
    await page.locator('[data-testid="export-docx-menu-item"]').click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("resume.docx");
    await expect(page.locator('[data-testid="export-error-recovery-banner"]')).not.toBeVisible();
  });

  test("2. Guest AI-patched document export remains blocked in a new session (cleared sessionStorage) when no frozen master exists", async ({ page }) => {
    // Ensure guest has no frozen master in /api/resumes
    await page.route("**/api/resumes", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true, data: [] }),
        });
        return;
      }
      await route.continue();
    });

    // Simulate a new session/tab where sessionStorage was cleared, but the document itself carries the persistent patch marker
    await page.addInitScript(() => {
      window.sessionStorage.clear();
      window.localStorage.setItem(
        "resumeforge_typst_source",
        '// @resumeforge-patched: true\n#set page(paper: "us-letter")\n= Alex Rivera\n- Engineered distributed backend systems.\n'
      );
    });

    await page.goto("/editor");
    const exportBtn = page.locator('[data-testid="export-dropdown-btn"]:visible').first();
    await expect(exportBtn).toBeVisible({ timeout: 20000 });
    await expect(exportBtn).toBeEnabled({ timeout: 20000 });

    await exportBtn.click();
    await page.locator('[data-testid="export-pdf-menu-item"]').click();

    const errorBanner = page.locator('[data-testid="export-error-recovery-banner"]:visible').first();
    await expect(errorBanner).toBeVisible();
    await expect(errorBanner).toContainText(
      "Freeze your master resume first before exporting a tailored or AI-patched variant."
    );
  });
});
