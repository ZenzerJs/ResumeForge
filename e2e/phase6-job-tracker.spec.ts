import { test, expect } from "@playwright/test";

test.describe("Phase 6 Job Application Tracker E2E Tests", () => {
  test("1. Seed job application -> Navigate to /tracker -> Change status to APPLIED -> Save notes -> Switch views", async ({
    page,
    request,
  }) => {
    // Create job posting via API
    const createRes = await request.post("/api/jobs", {
      data: {
        company: "Stripe",
        roleTitle: "Staff Software Engineer",
        rawDescription: "TypeScript, Node.js, Distributed Systems, PostgreSQL",
        source: "pasted",
      },
    });
    expect(createRes.ok()).toBeTruthy();
    const createJson = await createRes.json();
    const jobId = createJson.data.id;

    // Navigate to /tracker
    await page.goto("/tracker");
    await page.waitForSelector("[data-testid='tracker-page-title']", { timeout: 15000 });

    // Verify job card for "Stripe" is visible in SAVED column
    await expect(page.locator("text=Stripe").first()).toBeVisible();
    await expect(page.locator("text=Staff Software Engineer").first()).toBeVisible();

    // Update job status to APPLIED via status dropdown selector on specific job card
    const statusPatchPromise = page.waitForResponse(
      (resp) => resp.url().includes(`/api/jobs/${jobId}`) && resp.request().method() === "PATCH" && resp.status() === 200
    );
    const statusSelect = page.locator(`[data-testid='job-status-select-${jobId}']`);
    await statusSelect.selectOption("APPLIED");
    await statusPatchPromise;

    // Verify status update in DB via GET /api/jobs/[id]
    const getRes = await request.get(`/api/jobs/${jobId}`);
    expect(getRes.ok()).toBeTruthy();
    const getJson = await getRes.json();
    expect(getJson.data.status).toBe("APPLIED");
    expect(getJson.data.appliedAt).not.toBeNull();

    // Expand notes section for specific job card
    await page.click(`[data-testid='notes-toggle-btn-${jobId}']`);

    // Type notes and click Save Notes
    const patchPromise = page.waitForResponse(
      (resp) => resp.url().includes(`/api/jobs/${jobId}`) && resp.request().method() === "PATCH" && resp.status() === 200
    );
    await page.fill(`[data-testid='notes-textarea-${jobId}']`, "Referred by Alex. Initial screen scheduled for next Tuesday.");
    await page.click(`[data-testid='notes-save-btn-${jobId}']`);
    await patchPromise;

    // Verify saved notes via API
    const getRes2 = await request.get(`/api/jobs/${jobId}`);
    const getJson2 = await getRes2.json();
    expect(getJson2.data.notes).toBe("Referred by Alex. Initial screen scheduled for next Tuesday.");

    // Toggle sub-page tab to Applied & Active
    await page.click("a:has-text('Applied & Active')");
    await expect(page.locator("text=Stripe").first()).toBeVisible();

    // Toggle back to All Jobs
    await page.click("a:has-text('All Jobs')");
    await expect(page.locator("[data-testid='tracker-page-title']")).toBeVisible();
  });

  test("2. Navigation header links to /tracker across workspaces", async ({ page }) => {
    // Check Editor workspace header
    await page.goto("/editor");
    await page.waitForSelector("text=ResumeForge", { timeout: 10000 });
    await expect(page.locator("header a[href='/tracker']").first()).toBeVisible();

    // Check Library workspace header
    await page.goto("/library");
    await page.waitForSelector("text=Verified Evidence Bank", { timeout: 10000 });
    await expect(page.locator("header a[href='/tracker']").first()).toBeVisible();

    // Check Tailor workspace header
    await page.goto("/tailor");
    await page.waitForSelector("text=Target Job Posting", { timeout: 10000 });
    await expect(page.locator("header a[href='/tracker']").first()).toBeVisible();

    // Check Settings workspace header
    await page.goto("/settings");
    await page.waitForSelector("text=AI Provider Gateway Settings", { timeout: 10000 });
    await expect(page.locator("header a[href='/tracker']").first()).toBeVisible();
  });
});
