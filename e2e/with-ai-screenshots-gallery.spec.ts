import { test, expect, Page } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

const PROJECT_DIR = process.cwd();
const SCREENSHOTS_ROOT = path.join(PROJECT_DIR, "test-results", "screenshots");
const WITH_AI_DIR = path.join(SCREENSHOTS_ROOT, "with-ai");

fs.mkdirSync(WITH_AI_DIR, { recursive: true });

const starterTypstPath = path.join(PROJECT_DIR, "public", "templates", "starter-resume.typ");
const typstSource = fs.readFileSync(starterTypstPath, "utf8");

const AI_CONFIG = {
  provider: "openai",
  baseUrl: "http://127.0.0.1:3001",
  apiKey: "test-redacted-placeholder-key",
  model: "gemini-2.5-flash",
};

async function capture(page: Page, filename: string, options: { fullPage?: boolean } = {}) {
  const p1 = path.join(WITH_AI_DIR, filename);
  const buffer = await page.screenshot({ ...options });
  fs.writeFileSync(p1, buffer);
  fs.writeFileSync(path.join(SCREENSHOTS_ROOT, filename), buffer);

  console.log(`[Captured With AI] ${filename} (${buffer.length} bytes)`);
}

test.describe("ResumeForge Showcase Gallery — With AI Integration", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(({ source, config }) => {
      localStorage.setItem("resumeforge_typst_source", source);
      localStorage.setItem("resumeforge_ai_settings", JSON.stringify(config));
    }, { source: typstSource, config: AI_CONFIG });
  });

  test("01 - Settings & BYOK Connection with FreeLLMAPI", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    // Select OpenAI provider
    const providerSelect = page.locator("#provider-select");
    await expect(providerSelect).toBeVisible();
    await providerSelect.selectOption("openai");

    // Fill Base URL
    const baseUrlInput = page.locator("#base-url-input");
    await baseUrlInput.fill(AI_CONFIG.baseUrl);

    // Fill API Key
    const apiKeyInput = page.locator("#api-key-input");
    await apiKeyInput.fill(AI_CONFIG.apiKey);

    // Fill Model
    const modelInput = page.locator("#model-input");
    await modelInput.fill(AI_CONFIG.model);

    // Click Test Connection button
    const testBtn = page.locator("#test-connection-btn");
    await testBtn.click();

    // Wait for the success result banner
    await expect(page.locator("#test-result-banner")).toBeVisible({ timeout: 20000 });

    await capture(page, "13-settings-byok-with-ai.png");
  });

  test("02 - Evidence Bank Library Populated with AI-Extracted Items", async ({ page }) => {
    await page.goto("/library");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1")).toBeVisible();

    await capture(page, "06-evidence-bank-with-ai.png");
    const p1 = path.join(SCREENSHOTS_ROOT, "evidence-bank-after-ai.png");
    const buffer = await page.screenshot();
    fs.writeFileSync(p1, buffer);
  });

  test("03 & 04 & 05 - Typst Editor, AI Assistant & Master Dialog", async ({ page }) => {
    await page.goto("/editor");
    await page.waitForLoadState("networkidle");

    await expect(page.locator('[data-testid="panel-code"]')).toBeVisible({ timeout: 25000 });
    await expect(page.locator(".typst-preview-svg svg").first()).toBeVisible({ timeout: 20000 });

    // 03 - Live editor with active AI configuration
    await capture(page, "03-editor-typst-preview-with-ai.png");

    // 05 - Save as Master Dialog
    const saveMasterBtn = page.locator('[data-testid="save-as-master-btn"]').first();
    if (await saveMasterBtn.isVisible()) {
      await saveMasterBtn.click();
      await expect(page.getByTestId("save-master-confirm-modal")).toBeVisible();
      await capture(page, "05-editor-master-dialog-with-ai.png");
      await page.keyboard.press("Escape");
      await expect(page.getByTestId("save-master-confirm-modal")).toBeHidden();
    }

    // 04 - AI Assistant Docked Panel
    const aiBtn = page.locator('button:has-text("AI Assistant")').first();
    if (await aiBtn.isVisible()) {
      await aiBtn.click();
      await expect(page.getByTestId("panel-ai")).toBeVisible();
      await capture(page, "04-editor-ai-dock-with-ai.png");
    }
  });

  test("06 & 07 - Resume Tailor Workspace & Diagnostics", async ({ page }) => {
    await page.goto("/tailor");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("tailor-tab-3-pane")).toBeVisible();

    await capture(page, "09-tailor-workspace-with-ai.png");

    // Click ATS Diagnostics tab
    const atsTab = page.locator('[data-testid="tailor-tab-ats"], button:has-text("ATS"), button:has-text("Diagnostics")').first();
    if (await atsTab.isVisible()) {
      await atsTab.click();
      await expect(page.getByTestId("ats-score-panel")).toBeVisible();
      await capture(page, "10-tailor-ats-diagnostic-with-ai.png");
    }
  });

  test("08 & 09 - Jobs Tracker Board & Discover Live Feed", async ({ page }) => {
    // Applications Board
    await page.goto("/tracker");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("tracker-page-title")).toBeVisible();
    await capture(page, "07-job-tracker-with-ai.png");

    // Live Ingested Discover Feed
    await page.goto("/tracker/feed");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("discover-search-input")).toBeVisible();
    await capture(page, "08-job-discover-feed-with-ai.png");
  });

  test("10 & 11 - Technical Practice Hub & DSA Sandbox", async ({ page }) => {
    // Problem Hub
    await page.goto("/practice");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("practice-main-tabs")).toBeVisible();
    await capture(page, "11-practice-interview-hub-with-ai.png");

    // DSA Code Runner
    await page.goto("/practice?tab=runner");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("dsa-run-btn")).toBeVisible();
    await capture(page, "12-practice-dsa-runner-with-ai.png");
  });

  test("12 & 13 - Landing Page Hero and Features", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1")).toBeVisible();

    await capture(page, "01-landing-hero-with-ai.png");

    await page.evaluate(() => window.scrollTo({ top: 750, behavior: "instant" }));
    await expect(page.getByTestId("capability-grid-section")).toBeVisible();
    await capture(page, "02-landing-features-with-ai.png");
  });

  test("14 - Authentication Portal", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1")).toBeVisible();

    await capture(page, "14-auth-login-with-ai.png");
    await context.close();
  });
});
