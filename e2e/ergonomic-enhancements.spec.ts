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

  test("3. Job Detail Pane contains Prep Sheet modal trigger", async ({ page, request }) => {
    const created = await request.post("/api/jobs", {
      data: {
        company: "Prep Sheet Corp",
        roleTitle: "Platform Engineer",
        rawDescription: "TypeScript, React, PostgreSQL",
        personal: true,
      },
    });
    expect(created.ok()).toBeTruthy();

    await page.goto("/tracker");
    const firstCard = page.locator("[data-testid^='tracker-job-card-']").first();
    await expect(firstCard).toBeVisible({ timeout: 15000 });
    await firstCard.locator("[data-testid^='job-select-btn-']").first().click();

    const prepSheetBtn = page.locator("[data-testid='open-prep-sheet-btn']").first();
    await expect(prepSheetBtn).toBeVisible({ timeout: 10000 });
    await prepSheetBtn.click();
    const modal = page.locator("[data-testid='apply-prep-sheet-modal']");
    await expect(modal).toBeVisible();
    await expect(modal.getByText("Candidate Information")).toBeVisible();

    // Close modal
    await page.locator("[data-testid='close-prep-sheet-btn']").click();
    await expect(modal).not.toBeVisible();
  });

  test("4. Tailor Workspace allows inline gap resolution", async ({ page }) => {
    await page.route("**/api/evidence", async (route) => {
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

    await page.goto("/tailor?tab=job-info");

    // Click sample backend JD to populate requirements
    const sampleBtn = page.getByTestId("sample-backend-btn");
    await expect(sampleBtn).toBeVisible({ timeout: 10000 });
    await sampleBtn.click();

    const extractBtn = page.getByTestId("extract-reqs-btn");
    await expect(extractBtn).toBeVisible();
    await extractBtn.click();

    // Assert resolve gap button exists on uncovered skills and opens quick-add modal
    const resolveGapBtn = page.locator("[data-testid^='resolve-gap-']").first();
    await expect(resolveGapBtn).toBeVisible({ timeout: 10000 });
    await resolveGapBtn.click();

    const modal = page.locator("[data-testid='quick-add-evidence-modal']");
    await expect(modal).toBeVisible();
    await expect(page.locator("[data-testid='quick-evidence-title-input']")).toBeVisible();
    await page.locator("[data-testid='close-add-evidence-btn']").click();
    await expect(modal).not.toBeVisible();
  });

  test("5. UI-06: Dialogs trap focus, return focus to opener, and cancel without writes", async ({ page }) => {
    await page.goto("/editor");
    await page.waitForSelector(".typst-preview-svg svg", { timeout: 15000 });

    const exportBtn = page.locator("[data-testid='export-dropdown-btn']").first();
    await exportBtn.focus();
    await page.keyboard.press("?");

    const shortcutsModal = page.locator("[data-testid='keyboard-shortcuts-modal']");
    await expect(shortcutsModal).toBeVisible();
    await expect(shortcutsModal.getByRole("button", { name: /close/i })).toHaveCount(1);

    // Tab cycles inside dialog without escaping to background page
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press("Tab");
      const inside = await shortcutsModal.evaluate((el) => el.contains(document.activeElement));
      expect(inside).toBe(true);
    }

    await page.keyboard.press("Escape");
    await expect(shortcutsModal).not.toBeVisible();
    await expect(exportBtn).toBeFocused();

    // Library dialog: Cancel / Escape makes zero POST /api/evidence writes and binds labels
    await page.goto("/library");
    await page.waitForLoadState("networkidle");
    let evidenceWrites = 0;
    page.on("request", (req) => {
      if (req.url().includes("/api/evidence") && req.method() === "POST") evidenceWrites += 1;
    });
    const addBtn = page.getByRole("button", { name: /add evidence/i }).first();
    await addBtn.focus();
    await addBtn.click();
    const libraryDialog = page.getByRole("dialog");
    await expect(libraryDialog).toBeVisible();
    await expect(libraryDialog.getByLabel("Title")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(libraryDialog).not.toBeVisible();
    await expect(addBtn).toBeFocused();
    expect(evidenceWrites).toBe(0);
  });

  test("6. UI-06: Mobile TopNav sheet & nested JobDetailPane -> ApplyPrepSheetModal reverse Esc dismissal", async ({ page, request }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const created = await request.post("/api/jobs", {
      data: {
        company: "UI06 Sheet Corp",
        roleTitle: "Staff Frontend Engineer",
        rawDescription: "React, TypeScript, Playwright, Accessibility",
        personal: true,
      },
    });
    expect(created.ok()).toBeTruthy();

    await page.goto("/tracker");
    await page.waitForSelector("[data-testid^='tracker-job-card-']", { timeout: 15000 });

    // Mobile TopNav Sheet
    const openMenuBtn = page.getByRole("button", { name: "Open menu" });
    await openMenuBtn.focus();
    await openMenuBtn.click();
    const mobileNavDialog = page.getByRole("dialog", { name: "Navigation" });
    await expect(mobileNavDialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(mobileNavDialog).not.toBeVisible();
    await expect(openMenuBtn).toBeFocused();

    // Mobile JobDetailPane Sheet -> nested ApplyPrepSheetModal -> reverse Esc order
    const firstCard = page.locator("[data-testid^='tracker-job-card-']").first();
    await firstCard.click();
    const detailSheet = page.locator("[data-testid='job-detail-sheet']");
    await expect(detailSheet).toBeVisible();

    const prepBtn = detailSheet.locator("[data-testid='open-prep-sheet-btn']");
    await prepBtn.click();
    const prepModal = page.locator("[data-testid='apply-prep-sheet-modal']");
    await expect(prepModal).toBeVisible();

    // First Escape closes prep modal only
    await page.keyboard.press("Escape");
    await expect(prepModal).not.toBeVisible();
    await expect(detailSheet).toBeVisible();

    // Second Escape closes job detail sheet cleanly
    await page.keyboard.press("Escape");
    await expect(detailSheet).not.toBeVisible();
  });

  test("7. UI-07: TopNav omits Notifications/Terminal, shortcuts reflect truth, /interview redirects cleanly, and focus outlines stay visible", async ({ page }) => {
    await page.goto("/editor");
    await page.waitForSelector(".typst-preview-svg svg", { timeout: 15000 });

    const header = page.locator("header").first();
    await expect(header.getByRole("button", { name: "Notifications" })).toHaveCount(0);
    await expect(header.getByRole("link", { name: "Terminal" })).toHaveCount(0);
    await expect(header.locator("[data-testid='nav-ai-status-pill']")).toBeVisible();

    // Shortcuts modal lists only real implemented shortcuts
    await page.keyboard.press("Control+/");
    const modal = page.locator("[data-testid='keyboard-shortcuts-modal']");
    await expect(modal).toBeVisible();
    await expect(modal).toContainText("Save & recompile Typst resume");
    await expect(modal).not.toContainText("Toggle AI Assistant sidebar");
    await expect(modal).not.toContainText("Jump to Editor workspace");
    await page.keyboard.press("Escape");

    // Keyboard focus traversal shows visible ring/outline on desktop and mobile
    await page.keyboard.press("Tab");
    const hasVisibleFocusStyle = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return false;
      const styles = getComputedStyle(el);
      const hasOutline = styles.outlineStyle !== "none" && parseFloat(styles.outlineWidth) > 0;
      const hasShadow = styles.boxShadow !== "none";
      return hasOutline || hasShadow;
    });
    expect(hasVisibleFocusStyle).toBe(true);

    await page.setViewportSize({ width: 375, height: 812 });
    const mobileMenu = page.getByRole("button", { name: "Open menu" });
    await mobileMenu.focus();
    await expect(mobileMenu).toBeFocused();

    // /interview redirects to /practice?tab=questions preserving query params while /interview/dsa preserves runner handoff
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/interview?company=Stripe");
    await page.waitForURL(/\/practice\?.*tab=questions/);
    expect(page.url()).toContain("company=Stripe");

    await page.goto("/interview/dsa?problem=two-sum");
    await page.waitForURL(/\/practice\?.*tab=runner/);
    expect(page.url()).toContain("problem=two-sum");
  });
});
