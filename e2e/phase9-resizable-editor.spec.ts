import { test, expect } from "@playwright/test";

async function expandAiSidebarIfCollapsed(page: import("@playwright/test").Page) {
  const expandBtn = page.locator('[data-testid="expand-ai-sidebar-btn"]');
  if (await expandBtn.isVisible().catch(() => false)) {
    await expandBtn.click();
    await expect(page.locator('[data-testid="toggle-ai-sidebar-btn"]')).toBeVisible();
  }
}

test.describe("Task 9.2 — Resizable & Collapsible Editor Panels E2E Tests", () => {
  test.beforeEach(async ({ page }) => {
    // Ensure xl desktop 3-pane layout (>= 1280px)
    await page.setViewportSize({ width: 1440, height: 900 });
    // Navigate to /editor
    await page.goto("/editor");
    await page.waitForLoadState("networkidle");
  });

  test("1. Open /editor, verify panel-ai starts collapsed by default and expands via AI toggle button", async ({ page }) => {
    const group = page.locator('[data-testid="editor-resizable-panel-group"]');
    await expect(group).toBeVisible();

    const codePanel = page.locator('[data-testid="panel-code"]');
    const previewPanel = page.locator('[data-testid="panel-preview"]');
    const aiPanel = page.locator('[data-testid="panel-ai"]');

    await expect(codePanel).toBeVisible();
    await expect(previewPanel).toBeVisible();
    await expect(aiPanel).toHaveCount(1);

    // Default layout collapses panel-ai on fresh load
    const expandBtn = page.locator('[data-testid="expand-ai-sidebar-btn"]');
    await expect(expandBtn).toBeVisible();
    await expect(expandBtn).toHaveAttribute("aria-expanded", "false");
    const collapsedBox = await aiPanel.boundingBox();
    expect(collapsedBox?.width ?? 0).toBeLessThanOrEqual(1);

    // Expand via AI toggle button
    await expandBtn.click();
    await expect(aiPanel).toBeVisible();
    await expect(page.locator('[data-testid="toggle-ai-sidebar-btn"]')).toBeVisible();
    const expandedBox = await aiPanel.boundingBox();
    expect(expandedBox).not.toBeNull();
    expect(expandedBox!.width).toBeGreaterThan(100);
  });

  test("2. Expand AI sidebar, verify open persistence across reload, and collapse back", async ({ page }) => {
    const expandBtn = page.locator('[data-testid="expand-ai-sidebar-btn"]');
    await expect(expandBtn).toBeVisible();

    // Expand AI sidebar via toolbar button
    await expandBtn.click();
    const toggleBtn = page.locator('[data-testid="toggle-ai-sidebar-btn"]');
    await expect(toggleBtn).toBeVisible();

    // Verify localStorage key resumeforge_editor_layout records isAiCollapsed: false
    await expect
      .poll(async () => page.evaluate(() => localStorage.getItem("resumeforge_editor_layout")))
      .not.toBeNull();
    const openLayout = await page.evaluate(() => localStorage.getItem("resumeforge_editor_layout"));
    expect(JSON.parse(openLayout || "{}").isAiCollapsed).toBe(false);

    // Reload page and verify expanded layout persists from localStorage
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(toggleBtn).toBeVisible();
    const reloadedOpen = await page.evaluate(() => localStorage.getItem("resumeforge_editor_layout"));
    expect(JSON.parse(reloadedOpen || "{}").isAiCollapsed).toBe(false);

    // Collapse back via sidebar toggle button
    await toggleBtn.click();
    await expect(expandBtn).toBeVisible();

    await expect
      .poll(async () => {
        const raw = await page.evaluate(() => localStorage.getItem("resumeforge_editor_layout"));
        return raw ? JSON.parse(raw).isAiCollapsed : null;
      })
      .toBe(true);

    // Reload and verify collapsed state persists
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(expandBtn).toBeVisible();
    const reloadedCollapsed = await page.evaluate(() => localStorage.getItem("resumeforge_editor_layout"));
    expect(JSON.parse(reloadedCollapsed || "{}").isAiCollapsed).toBe(true);
  });

  test("3. Verify AI sidebar input state and JD text remain intact across collapse and expand cycles", async ({ page }) => {
    await expandAiSidebarIfCollapsed(page);
    await page.locator('[data-testid="ai-tab-tailor"]').click();
    const jdTextarea = page.locator('textarea[placeholder*="Paste the job posting here"]');
    await expect(jdTextarea).toBeVisible();

    const sampleJD = "Senior Full-Stack Engineer role requiring Next.js, TypeScript, and Prisma.";
    await jdTextarea.fill(sampleJD);
    expect(await jdTextarea.inputValue()).toBe(sampleJD);

    const toggleBtn = page.locator('[data-testid="toggle-ai-sidebar-btn"]');
    // Collapse sidebar
    await toggleBtn.click();

    // Expand sidebar again
    const expandBtn = page.locator('[data-testid="expand-ai-sidebar-btn"]');
    await expect(expandBtn).toBeVisible();
    await expandBtn.scrollIntoViewIfNeeded();
    await expandBtn.click();

    // Assert textarea value remained completely intact without resetting
    await expect(jdTextarea).toBeVisible();
    expect(await jdTextarea.inputValue()).toBe(sampleJD);
  });

  test("4. UI-08: Popped-out AI Assistant supports floating mode, keyboard move/resize handles, aria-pressed, and maximized Esc restore", async ({ page }) => {
    await expandAiSidebarIfCollapsed(page);
    const popoutBtn = page.getByRole("button", { name: /pop out/i }).first();
    if (await popoutBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await popoutBtn.click();
    } else {
      // Fallback via button title if accessible name differs
      await page.locator('[data-testid="panel-ai"] button[title*="Pop out"], [data-testid="panel-ai"] button[aria-label*="Pop"]').first().click();
    }

    const win = page.locator('[data-testid="ai-assistant-window"]');
    await expect(win).toBeVisible();

    const floatBtn = win.getByRole("button", { name: "Float window freely" });
    await floatBtn.click();
    await expect(floatBtn).toHaveAttribute("aria-pressed", "true");
    await expect(win).toHaveAttribute("data-mode", "floating");

    const beforeBox = await win.boundingBox();
    expect(beforeBox).not.toBeNull();

    // Keyboard move handle shifts position
    const dragHandle = win.locator('[data-testid="window-drag-handle"]');
    await dragHandle.focus();
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowDown");

    // Keyboard resize handle adjusts size
    const resizeHandle = win.locator('[data-testid="window-resize-handle"]');
    await resizeHandle.focus();
    await page.keyboard.press("Shift+ArrowRight");
    await page.keyboard.press("Shift+ArrowDown");

    const afterBox = await win.boundingBox();
    expect(afterBox).not.toBeNull();
    expect(afterBox!.width).toBeGreaterThan(beforeBox!.width);
    expect(afterBox!.height).toBeGreaterThan(beforeBox!.height);

    // Pointer drag shifts floating window coordinates and pointercancel rolls back instead of committing
    const dragBox = await dragHandle.boundingBox();
    expect(dragBox).not.toBeNull();
    const startCenterX = dragBox!.x + dragBox!.width / 2;
    const startCenterY = dragBox!.y + dragBox!.height / 2;
    await page.mouse.move(startCenterX, startCenterY);
    await page.mouse.down();
    await page.mouse.move(startCenterX - 30, startCenterY - 20, { steps: 3 });
    await page.mouse.up();
    const postPointerDragBox = await win.boundingBox();
    expect(postPointerDragBox).not.toBeNull();
    expect(Math.round(postPointerDragBox!.x)).not.toBe(Math.round(afterBox!.x));

    // Dispatch pointercancel mid-drag and verify geometry rolls back to postPointerDragBox
    await dragHandle.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, pointerId: 42, clientX: cx, clientY: cy }));
      el.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, pointerId: 42, clientX: cx - 50, clientY: cy - 40 }));
      el.dispatchEvent(new PointerEvent("pointercancel", { bubbles: true, pointerId: 42 }));
    });
    const postCancelBox = await win.boundingBox();
    expect(postCancelBox).not.toBeNull();
    expect(Math.round(postCancelBox!.x)).toBe(Math.round(postPointerDragBox!.x));
    expect(Math.round(postCancelBox!.y)).toBe(Math.round(postPointerDragBox!.y));

    // Maximized mode behaves as modal dialog, traps Tab, and restores on Escape
    const maxBtn = win.getByRole("button", { name: "Maximize window" });
    await maxBtn.click();
    await expect(win).toHaveAttribute("role", "dialog");
    await expect(win).toHaveAttribute("aria-modal", "true");
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press("Tab");
      const activeInside = await win.evaluate((el) => el.contains(document.activeElement));
      expect(activeInside).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(win).toHaveAttribute("data-mode", "docked");
    await expect(win).toHaveAttribute("role", "region");
  });
});
