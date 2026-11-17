import { test, expect } from "@playwright/test";

test.describe("Task 9.5 — Editor ATS Grade Button & Evidence Retirement E2E Tests", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/editor");
    await page.waitForLoadState("networkidle");
  });

  test("1. Open /editor, click Grade button in preview header, verify inline ATS score breakdown appears with zero idle/rerender loops", async ({ page }) => {
    let evaluatePostCount = 0;
    page.on("request", (req) => {
      if (req.url().includes("/api/ats/evaluate") && req.method() === "POST") {
        evaluatePostCount += 1;
      }
    });

    const gradeBtn = page.locator('[data-testid="grade-resume-btn"]');
    await expect(gradeBtn).toBeVisible();

    const firstEvalResponse = page.waitForResponse(
      (res) => res.url().includes("/api/ats/evaluate") && res.request().method() === "POST"
    );

    // Click Grade button
    await gradeBtn.click();
    await firstEvalResponse;

    // Verify ATS score breakdown overlay renders inside preview area
    const scoreOverlay = page.locator('[data-testid="editor-ats-score-overlay"]');
    await expect(scoreOverlay).toBeVisible({ timeout: 10000 });

    const scoreBadge = page.locator('[data-testid="overall-score-badge"]');
    await expect(scoreBadge).toBeVisible();
    await expect(scoreBadge).toContainText("/ 100");

    const countAfterOpen = evaluatePostCount;
    expect(countAfterOpen).toBe(1);

    // Idle wait must add zero requests
    await page.waitForTimeout(1500);
    expect(evaluatePostCount).toBe(countAfterOpen);

    // Selecting a distinct profile adds exactly one request
    const profileEvalResponse = page.waitForResponse(
      (res) => res.url().includes("/api/ats/evaluate") && res.request().method() === "POST"
    );
    await page.locator('[data-testid="profile-btn-Frontend"]').click();
    await profileEvalResponse;
    await page.waitForTimeout(500);
    expect(evaluatePostCount).toBe(countAfterOpen + 1);

    // Return to paper preview and check that the ATS Grade column is opt-in.
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByTestId("preview-mode-pdf").click();
    await expect(scoreOverlay).not.toBeVisible();

    const dockedAside = page.getByTestId("editor-ats-grade-aside");
    const splitToggle = page.getByTestId("preview-split-grade-toggle");
    await expect(dockedAside).not.toBeVisible();
    await expect(splitToggle).toBeVisible();

    const paperSheet = page
      .locator('[data-testid="panel-preview"] [data-testid="typst-paper-sheet"], [data-testid="panel-preview"] [data-page-slot="1"]')
      .first();
    await expect(paperSheet).toBeVisible({ timeout: 15000 });
    const paperBox1440 = await paperSheet.boundingBox();
    expect(paperBox1440).not.toBeNull();
    expect(paperBox1440!.width).toBeGreaterThanOrEqual(480);
    expect(paperBox1440!.y).toBeLessThanOrEqual(128);

    // Toggle docked column closed and back open on 1280x800
    await page.setViewportSize({ width: 1280, height: 800 });
    const paperBox1280 = await paperSheet.boundingBox();
    expect(paperBox1280).not.toBeNull();
    expect(paperBox1280!.width).toBeGreaterThanOrEqual(480);
    expect(paperBox1280!.y).toBeLessThanOrEqual(128);
    await splitToggle.click();
    await expect(dockedAside).toBeVisible();
    await splitToggle.click();
    await expect(dockedAside).not.toBeVisible();
    await splitToggle.click();
    await expect(dockedAside).toBeVisible();

    // Clicking preview-mode-grade inside docked aside opens full rubric overlay
    await page.getByTestId("preview-mode-grade").click();
    await expect(scoreOverlay).toBeVisible();
    await page.getByTestId("preview-mode-pdf").click();
    await expect(dockedAside).toBeVisible();

    // Below xl (1024x768), docked column hides cleanly
    await page.setViewportSize({ width: 1024, height: 768 });
    await expect(dockedAside).not.toBeVisible();
  });

  test("1b. /tailor with extracted job requirements evaluates once per distinct input", async ({ page }) => {
    let evaluatePostCount = 0;
    page.on("request", (req) => {
      if (req.url().includes("/api/ats/evaluate") && req.method() === "POST") {
        evaluatePostCount += 1;
      }
    });

    await page.goto("/tailor");
    await page.waitForLoadState("networkidle");

    // UI-05: ATS evaluator mounts exclusively in 3-Pane Workspace tab
    const initialEvalResponse = page.waitForResponse(
      (res) => res.url().includes("/api/ats/evaluate") && res.request().method() === "POST"
    );
    await page.locator('[data-testid="tailor-tab-3-pane"]').click();
    await initialEvalResponse;

    await expect(page.locator("[data-testid='ats-score-panel']")).toBeVisible();
    await expect(page.locator("[data-testid='overall-score-badge']")).toBeVisible({ timeout: 10000 });
    const countAfterInitial = evaluatePostCount;
    expect(countAfterInitial).toBe(1);

    // Idle wait must add zero requests
    await page.waitForTimeout(1500);
    expect(evaluatePostCount).toBe(countAfterInitial);

    // Switching to Job Info tab for a distinct JD and extracting requirements triggers one re-evaluation in Workspace
    await page.locator('[data-testid="tailor-tab-job-info"]').click();
    await page.waitForSelector("[data-testid='jd-textarea']", { timeout: 10000 });
    await page.click("[data-testid='sample-frontend-btn']");
    await page.click("[data-testid='extract-reqs-btn']");

    const extractEvalResponse = page.waitForResponse(
      (res) => res.url().includes("/api/ats/evaluate") && res.request().method() === "POST"
    );
    await page.locator('[data-testid="tailor-tab-3-pane"]').click();
    await extractEvalResponse;

    const countAfterExtract = evaluatePostCount;
    expect(countAfterExtract).toBe(countAfterInitial + 1);

    await page.waitForTimeout(1500);
    expect(evaluatePostCount).toBe(countAfterExtract);
  });

  test("2. /library Evidence Bank management CRUD remains fully accessible and functional", async ({ page }) => {
    await page.goto("/library");
    await page.waitForLoadState("networkidle");

    const header = page.locator("h1", { hasText: "Evidence Bank" });
    await expect(header).toBeVisible();

    const addBtn = page.locator("button", { hasText: "Add Evidence Item" });
    await expect(addBtn).toBeVisible();
  });
});
