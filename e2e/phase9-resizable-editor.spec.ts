import { test, expect } from "@playwright/test";

test.describe("Task 9.2 — Resizable & Collapsible Editor Panels E2E Tests", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to /editor
    await page.goto("/editor");
    await page.waitForLoadState("networkidle");
  });

  test("1. Open /editor, verify resizable panel group renders all three desktop panels", async ({ page }) => {
    const group = page.locator('[data-testid="editor-resizable-panel-group"]');
    await expect(group).toBeVisible();

    const codePanel = page.locator('[data-testid="panel-code"]');
    const previewPanel = page.locator('[data-testid="panel-preview"]');
    const aiPanel = page.locator('[data-testid="panel-ai"]');

    await expect(codePanel).toBeVisible();
    await expect(previewPanel).toBeVisible();
    await expect(aiPanel).toBeVisible();
  });

  test("2. Collapse AI sidebar via header toggle button and verify state persistence across reload", async ({ page }) => {
    const toggleBtn = page.locator('[data-testid="toggle-ai-sidebar-btn"]');
    await expect(toggleBtn).toBeVisible();

    // Click to collapse
    await toggleBtn.click();
    await page.waitForTimeout(300);

    // Verify localStorage key resumeforge_editor_layout was set
    const savedLayout = await page.evaluate(() => localStorage.getItem("resumeforge_editor_layout"));
    expect(savedLayout).not.toBeNull();
    const parsed = JSON.parse(savedLayout || "{}");
    expect(parsed.isAiCollapsed).toBe(true);

    // Reload page and verify layout state is restored from localStorage
    await page.reload();
    await page.waitForLoadState("networkidle");

    const reloadedSavedLayout = await page.evaluate(() => localStorage.getItem("resumeforge_editor_layout"));
    expect(reloadedSavedLayout).not.toBeNull();
    const reloadedParsed = JSON.parse(reloadedSavedLayout || "{}");
    expect(reloadedParsed.isAiCollapsed).toBe(true);
  });

  test("3. Verify AI sidebar input state and JD text remain intact across collapse and expand cycles", async ({ page }) => {
    const jdTextarea = page.locator('textarea[placeholder*="Paste the job posting here"]');
    await expect(jdTextarea).toBeVisible();

    const sampleJD = "Senior Full-Stack Engineer role requiring Next.js, TypeScript, and Prisma.";
    await jdTextarea.fill(sampleJD);
    expect(await jdTextarea.inputValue()).toBe(sampleJD);

    const toggleBtn = page.locator('[data-testid="toggle-ai-sidebar-btn"]');
    // Collapse sidebar
    await toggleBtn.click();
    await page.waitForTimeout(300);

    // Expand sidebar again
    const expandBtn = page.locator('[data-testid="expand-ai-sidebar-btn"]');
    await expandBtn.scrollIntoViewIfNeeded();
    await expandBtn.click();
    await page.waitForTimeout(300);

    // Assert textarea value remained completely intact without resetting
    await expect(jdTextarea).toBeVisible();
    expect(await jdTextarea.inputValue()).toBe(sampleJD);
  });
});
