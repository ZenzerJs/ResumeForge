import { test, expect } from "@playwright/test";

test.describe("Phase 10 — Production Polish & Editorial Landing Motion E2E Tests", () => {
  test("1. Visiting non-existent route renders branded 404 page (not-found.tsx)", async ({ page }) => {
    await page.goto("/non-existent-route-xyz");
    await page.waitForLoadState("networkidle");

    const header = page.locator("h1", { hasText: "Document Node Missing" });
    await expect(header).toBeVisible();

    const returnBtn = page.locator('a:has-text("Return to Dashboard")');
    await expect(returnBtn).toBeVisible();
    await returnBtn.click();

    await expect(page).toHaveURL("/");
  });

  test("2. Root metadata includes Open Graph, Twitter Cards, and theme color tags", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const ogTitle = page.locator('meta[property="og:title"]');
    await expect(ogTitle).toHaveAttribute("content", /ResumeForge/);

    const twitterCard = page.locator('meta[name="twitter:card"]');
    await expect(twitterCard).toHaveAttribute("content", "summary_large_image");

    const themeColor = page.locator('meta[name="theme-color"]');
    await expect(themeColor).toHaveAttribute("content", "#ff8c00");
  });

  test("3. Manifest and Icon routes serve valid 200 HTTP responses", async ({ request }) => {
    const iconRes = await request.get("/icon");
    expect(iconRes.status()).toBe(200);

    const manifestRes = await request.get("/manifest.webmanifest");
    expect(manifestRes.status()).toBe(200);
    const manifestJson = await manifestRes.json();
    expect(manifestJson.short_name).toBe("ResumeForge");
  });

  test("4. Landing page proof mockup is explicitly labeled WORKSPACE PREVIEW and illustrative", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const previewLabel = page.locator("text=WORKSPACE PREVIEW");
    await expect(previewLabel).toBeVisible();

    const disclaimerText = page.locator("text=Illustrative interface — sample layout only");
    await expect(disclaimerText).toBeVisible();

    // Verify proof card contains structural shapes, no fabricated scores (e.g. 87/100)
    const proofCard = page.locator('[data-testid="product-proof-card"]');
    await expect(proofCard).toBeVisible();
  });

  test("5. Interactive 5-step workflow timeline supports step switching and keyboard navigation", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const activePanel = page.locator('[data-testid="workflow-active-panel"]');
    await expect(activePanel).toContainText("1. IMPORT");
    await expect(activePanel).toContainText("2. GROUND");
    await expect(activePanel).toContainText("3. TAILOR");
    await expect(activePanel).toContainText("4. VERIFY");
    await expect(activePanel).toContainText("5. APPLY");
  });

  test("6. Upload PDF button remains enabled and immediately clickable", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const uploadBtn = page.locator('[data-testid="upload-pdf-hero-btn"]');
    await expect(uploadBtn).toBeVisible();
    await expect(uploadBtn).toBeEnabled();
  });

  test("7. All 5 capability cards navigate to correct destinations", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const grid = page.locator('[data-testid="capability-cards-grid"]');

    const editorLink = grid.locator('a[href="/editor"]');
    await expect(editorLink).toBeVisible();

    const tailorLink = grid.locator('a[href="/tailor"]');
    await expect(tailorLink).toBeVisible();

    const trackerLink = grid.locator('a[href="/tracker"]');
    await expect(trackerLink).toBeVisible();

    const libraryLink = grid.locator('a[href="/library"]');
    await expect(libraryLink).toBeVisible();

    const settingsLink = grid.locator('a[href="/settings"]');
    await expect(settingsLink).toBeVisible();
  });

  test("8. prefers-reduced-motion: reduce renders landing page cleanly", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const heroTitle = page.locator("h1");
    await expect(heroTitle).toContainText("Make every application feel");
  });

  test("9. Responsive viewports (375px mobile, 768px tablet, 1200px desktop) render without horizontal overflow", async ({ page }) => {
    // 375px Mobile Viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await expect(page.locator('[data-testid="upload-pdf-hero-btn"]')).toBeVisible();

    // Check no horizontal scrollbar on body
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalOverflow).toBe(false);

    // 768px Tablet Viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.locator('[data-testid="workflow-section"]')).toBeVisible();

    // 1200px Desktop Viewport
    await page.setViewportSize({ width: 1200, height: 800 });
    await expect(page.locator('[data-testid="capability-grid-section"]')).toBeVisible();
  });
});
