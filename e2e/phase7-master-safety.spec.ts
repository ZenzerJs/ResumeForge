import { test, expect } from "@playwright/test";

test.describe("Task 7.9: Save as Master + Revert to Master Safety Protocol E2E Tests", () => {
  test("1. Save as Master requires confirmation modal and provides Undo Overwrite banner", async ({ page }) => {
    await page.goto("/editor");
    await page.waitForSelector("[data-testid='save-as-master-btn']", { timeout: 15000 });

    // Click Save as Master Resume button
    await page.click("[data-testid='save-as-master-btn']");

    // Assert confirmation modal appears
    await expect(page.locator("[data-testid='save-master-confirm-modal']")).toBeVisible();

    // Tick confirmation checkbox before confirming
    await page.click("[data-testid='confirm-master-checkbox']");

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

  test("2. Revert to Master button opens controlled ConfirmDialog focusing Cancel first and triggers zero native dialogs", async ({ page }) => {
    let nativeDialogs = 0;
    page.on("dialog", async (dialog) => {
      nativeDialogs += 1;
      await dialog.dismiss();
    });

    await page.goto("/editor");
    await page.waitForSelector("[data-testid='revert-to-master-btn']", { timeout: 10000 });
    await expect(page.locator("[data-testid='revert-to-master-btn']")).toBeVisible();

    await page.locator('[data-testid="panel-code"] [data-testid="editor-mode-code"]').click();
    const editor = page.locator('[data-testid="panel-code"] .cm-content');
    await editor.click();
    await page.keyboard.press("Control+End");
    await page.keyboard.type("\n// UI09 Unsaved Marker");

    await page.click("[data-testid='revert-to-master-btn']");
    const revertDialog = page.locator("[data-testid='revert-master-confirm-modal']");
    await expect(revertDialog).toBeVisible();

    // Focus lands on Cancel first
    const cancelBtn = page.locator("[data-testid='cancel-revert-master-btn']");
    await expect(cancelBtn).toBeFocused();

    // Cancel via Escape keeps unsaved edits
    await page.keyboard.press("Escape");
    await expect(revertDialog).toBeHidden();
    await expect(editor).toContainText("UI09 Unsaved Marker");

    // Confirm revert restores canonical master and removes unsaved edit
    await page.click("[data-testid='revert-to-master-btn']");
    await expect(revertDialog).toBeVisible();
    await page.click("[data-testid='confirm-revert-master-btn']");
    await expect(revertDialog).toBeHidden();
    await expect(editor).not.toContainText("UI09 Unsaved Marker");

    expect(nativeDialogs).toBe(0);
  });

  test("3. UI-09: Reformat unsafe source uses role=alert and ConfirmDialog prevents synchronous double-submit", async ({ page }) => {
    let nativeDialogs = 0;
    page.on("dialog", async (dialog) => {
      nativeDialogs += 1;
      await dialog.dismiss();
    });

    await page.goto("/editor");
    await page.waitForSelector("[data-testid='save-as-master-btn']", { timeout: 15000 });

    // Rapid synchronous double-click on ConfirmDialog button fires only one save-master POST
    let saveCalls = 0;
    await page.route("**/api/resumes/save-master", async (route) => {
      saveCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 150));
      await route.continue();
    });
    await page.click("[data-testid='save-as-master-btn']");
    await page.click("[data-testid='confirm-master-checkbox']");
    const confirmBtn = page.locator("[data-testid='confirm-save-master-btn']");
    await expect(confirmBtn).toBeVisible();
    await expect(confirmBtn).toBeEnabled();
    await confirmBtn.evaluate((el) => {
      (el as HTMLButtonElement).click();
      (el as HTMLButtonElement).click();
    });
    await expect(page.locator("[data-testid='save-master-confirm-modal']")).toBeHidden();
    expect(saveCalls).toBe(1);

    // Trigger non-canonical source + Reformat draft -> inline role=alert (without saving invalid master)
    await page.locator('[data-testid="panel-code"] [data-testid="editor-mode-code"]').click();
    const editor = page.locator('[data-testid="panel-code"] .cm-content');
    await editor.click();
    await page.keyboard.press("Control+End");
    await page.keyboard.type("\n// UI09 Unmanaged Marker");
    await page.getByRole("button", { name: "Reformat draft" }).click();
    const alertBanner = page.getByTestId("reformat-error-alert");
    await expect(alertBanner).toBeVisible();
    await expect(alertBanner).toHaveAttribute("role", "alert");
    expect(nativeDialogs).toBe(0);
  });
});
