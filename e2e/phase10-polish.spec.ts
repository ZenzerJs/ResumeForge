import { test, expect } from "@playwright/test";

test.describe("Phase 10 — Production Polish & Landing Motion E2E Tests", () => {
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
    await expect(themeColor).toHaveAttribute("content", "#f59e0b");
  });

  test("3. Manifest and Icon routes serve valid 200 HTTP responses", async ({ request }) => {
    const iconRes = await request.get("/icon");
    expect(iconRes.status()).toBe(200);

    const manifestRes = await request.get("/manifest.webmanifest");
    expect(manifestRes.status()).toBe(200);
    const manifestJson = await manifestRes.json();
    expect(manifestJson.short_name).toBe("ResumeForge");
  });

  test("4. Landing page renders with all functional elements present", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const uploadBtn = page.locator('[data-testid="upload-pdf-hero-btn"]');
    await expect(uploadBtn).toBeVisible();

    const editorCard = page.locator('a[href="/editor"]').first();
    await expect(editorCard).toBeVisible();

    const tailorCard = page.locator('a[href="/tailor"]').first();
    await expect(tailorCard).toBeVisible();

    const trackerCard = page.locator('a[href="/tracker"]').first();
    await expect(trackerCard).toBeVisible();
  });

  test("5. prefers-reduced-motion: reduce renders landing page without motion errors", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const heroTitle = page.locator("h1");
    await expect(heroTitle).toContainText("Resume");
    await expect(heroTitle).toContainText("Forge");
  });
});
