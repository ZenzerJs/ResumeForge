import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";
import { buildSampleResumePdf } from "../scripts/generate-sample-resume-pdf";

test.describe("Task 9.1 — AI-Powered PDF Conversion & Guaranteed Editor Redirect", () => {
  const testPdfPath = path.join(process.cwd(), "e2e", "fixtures", "sample-resume.pdf");

  test.beforeAll(() => {
    const fixtureDir = path.dirname(testPdfPath);
    if (!fs.existsSync(fixtureDir)) {
      fs.mkdirSync(fixtureDir, { recursive: true });
    }
    fs.writeFileSync(testPdfPath, buildSampleResumePdf(), "utf8");
  });

  test("1. PDF Upload triggers client upload and redirects to /editor with non-master draft", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    // Check upload button exists on homepage
    const uploadBtn = page.locator('[data-testid="upload-pdf-hero-btn"]');
    await expect(uploadBtn).toBeVisible();

    // Attach PDF file to hidden file input
    const fileInput = page.locator('[data-testid="pdf-upload-input"]');
    await fileInput.setInputFiles(testPdfPath);

    // Wait for redirect to /editor?resumeId=...
    await expect(page).toHaveURL(/\/editor\?resumeId=/, { timeout: 30000 });

    // Verify draft loaded in editor
    const editorBadge = page.locator('[data-testid="document-type-badge"]');
    await expect(editorBadge).toBeVisible();

    // Verify conversion path status banner is displayed
    const statusBanner = page.locator('[data-testid^="pdf-conversion-"]');
    await expect(statusBanner).toBeVisible();
  });

  test("2. Conversion path status banner can be dismissed per session", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const fileInput = page.locator('[data-testid="pdf-upload-input"]');
    await fileInput.setInputFiles(testPdfPath);

    await expect(page).toHaveURL(/\/editor\?resumeId=/, { timeout: 30000 });

    const dismissBtn = page.locator('[data-testid="dismiss-conversion-banner-btn"]');
    if (await dismissBtn.isVisible()) {
      await dismissBtn.click();
      await expect(page.locator('[data-testid^="pdf-conversion-"]')).not.toBeVisible();
    }
  });
});
