import { test, expect } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

const PROJECT_SCREENSHOTS_DIR = path.join(process.cwd(), "screenshots");
const BRAIN_SCREENSHOTS_DIR = "C:/Users/jayde/.gemini/antigravity/brain/d4a531ea-5f55-4906-92f1-dc2c20108fd4/screenshots";

// Ensure directories exist
fs.mkdirSync(PROJECT_SCREENSHOTS_DIR, { recursive: true });
fs.mkdirSync(BRAIN_SCREENSHOTS_DIR, { recursive: true });

const typstSourcePath = path.join(process.cwd(), "screenshots", "jayden_resume.typ");
const typstSource = fs.readFileSync(typstSourcePath, "utf8");

async function capture(page: any, filename: string) {
  const p1 = path.join(PROJECT_SCREENSHOTS_DIR, filename);
  const p2 = path.join(BRAIN_SCREENSHOTS_DIR, filename);
  const buffer = await page.screenshot();
  fs.writeFileSync(p1, buffer);
  fs.writeFileSync(p2, buffer);
  console.log(`[Captured] ${filename} (${buffer.length} bytes)`);
}

test.describe("User Requested Focus Screenshots", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("1. Resume Editor with Jayden Saha Resume Plugged In", async ({ page }) => {
    // Prime local storage with Jayden's resume before loading editor
    await page.addInitScript((source: string) => {
      localStorage.setItem("resumeforge_typst_source", source);
    }, typstSource);

    await page.goto("/editor");
    await page.waitForLoadState("networkidle");

    await expect(page.locator(".typst-preview-svg svg").first()).toBeVisible({ timeout: 25000 });

    // Save as primary focus screenshot and update preview gallery
    await capture(page, "editor-with-resume.png");
    await capture(page, "03-editor-typst-preview.png");
  });

  test("2. Jobs Page with Live Ingested Jobs Fetched", async ({ page }) => {
    // 1. Applications Tracker view
    await page.goto("/tracker");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("tracker-page-title")).toBeVisible();

    await capture(page, "jobs-page-fetched.png");
    await capture(page, "07-job-tracker.png");

    // 2. Discover Feed view (showing ingested jobs catalog)
    await page.goto("/tracker/feed");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("discover-search-input")).toBeVisible();

    await capture(page, "jobs-feed-fetched.png");
    await capture(page, "08-job-discover-feed.png");
  });
});
