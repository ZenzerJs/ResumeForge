import { test, expect, Page } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

const PROJECT_SCREENSHOTS_DIR = path.join(process.cwd(), "screenshots");
const BRAIN_SCREENSHOTS_DIR = "C:/Users/jayde/.gemini/antigravity/brain/d4a531ea-5f55-4906-92f1-dc2c20108fd4/screenshots";

// Ensure directories exist
fs.mkdirSync(PROJECT_SCREENSHOTS_DIR, { recursive: true });
fs.mkdirSync(BRAIN_SCREENSHOTS_DIR, { recursive: true });

async function capture(page: Page, filename: string, options: { fullPage?: boolean } = {}) {
  const p1 = path.join(PROJECT_SCREENSHOTS_DIR, filename);
  const p2 = path.join(BRAIN_SCREENSHOTS_DIR, filename);
  const buffer = await page.screenshot({ ...options });
  fs.writeFileSync(p1, buffer);
  fs.writeFileSync(p2, buffer);
  console.log(`[Captured] ${filename} (${buffer.length} bytes)`);
}

test.describe("ResumeForge Showcase Screenshots Gallery", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("01 & 02 - Landing Page Hero and Features", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    // Hero Viewport
    await capture(page, "01-landing-hero.png");

    // Scroll to feature highlights
    await page.evaluate(() => window.scrollTo({ top: 750, behavior: "instant" }));
    await page.waitForTimeout(1000);
    await capture(page, "02-landing-features.png");
  });

  test("03, 04, 05 - Resume Editor Workspace & Typst Live Preview", async ({ page }) => {
    await page.goto("/editor");
    // Wait for either the typst preview svg or the editor
    await page.waitForSelector(".cm-editor", { timeout: 25000 });
    try {
      await page.waitForSelector(".typst-preview-svg svg", { timeout: 20000 });
    } catch {
      console.log("Typst SVG preview selector timed out, proceeding with rendered workspace");
    }
    await page.waitForTimeout(2000);

    // Main dual-pane workspace
    await capture(page, "03-editor-typst-preview.png");

    // Trigger Save as Master dialog before opening AI dock so dock does not intercept clicks
    const saveMasterBtn = page.locator('[data-testid="save-as-master-btn"]').first();
    if (await saveMasterBtn.isVisible()) {
      await saveMasterBtn.click();
      await page.waitForTimeout(800);
      await capture(page, "05-editor-master-dialog.png");
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
    }

    // Open AI Assistant panel if present
    const aiButton = page.locator('button:has-text("AI Assistant")').first();
    if (await aiButton.isVisible()) {
      await aiButton.click();
      await page.waitForTimeout(1200);
      await capture(page, "04-editor-ai-dock.png");
    }
  });

  test("06 - Evidence Bank Library", async ({ page }) => {
    await page.goto("/library");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);

    await capture(page, "06-evidence-bank.png");
  });

  test("07 & 08 - Job Tracker and Discover Feed", async ({ page }) => {
    // 07 - Applications Tracker
    await page.goto("/tracker");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);
    await capture(page, "07-job-tracker.png");

    // 08 - Discover Feed
    await page.goto("/tracker/feed");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);
    await capture(page, "08-job-discover-feed.png");
  });

  test("09 & 10 - Resume Tailor Workspace & ATS Diagnostics", async ({ page }) => {
    await page.goto("/tailor");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);

    // 09 - Tailor 3-pane workspace
    await capture(page, "09-tailor-workspace.png");

    // Switch to ATS tab or Diagnostics tab
    const atsTab = page.locator('[data-testid="tailor-tab-ats"], button:has-text("ATS"), button:has-text("Diagnostics")').first();
    if (await atsTab.isVisible()) {
      await atsTab.click();
      await page.waitForTimeout(1000);
      await capture(page, "10-tailor-ats-diagnostic.png");
    }
  });

  test("11 & 12 - Technical Practice Hub & DSA Sandbox", async ({ page }) => {
    // 11 - Practice Hub
    await page.goto("/practice");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);
    await capture(page, "11-practice-interview-hub.png");

    // 12 - DSA Code Runner
    await page.goto("/practice?tab=runner");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    await capture(page, "12-practice-dsa-runner.png");
  });

  test("13 - Settings and BYOK Vault", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);

    await capture(page, "13-settings-byok.png");
  });

  test("14 - Auth Login Screen", async ({ browser }) => {
    // Open clean incognito page without auth cookies
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.goto("http://127.0.0.1:3000/login");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1200);

    await capture(page, "14-auth-login.png");
    await context.close();
  });
});
