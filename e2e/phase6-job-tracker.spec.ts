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
        personal: true,
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

    // Select job card so detail pane (with notes) is visible
    await page.locator(`[data-testid='tracker-job-card-${jobId}']`).click();
    await expect(page.locator(`[data-testid='notes-textarea-${jobId}']`)).toBeVisible();

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

    // Toggle sub-page tab to Applied
    await page.click("[data-testid='tracker-tab-applied']");
    await expect(page.locator("text=Stripe").first()).toBeVisible();

    // Toggle back to All
    await page.click("[data-testid='tracker-tab-all']");
    await expect(page.locator("[data-testid='tracker-page-title']")).toBeVisible();
  });

  test("2. Navigation header links to /tracker across workspaces", async ({ page }) => {
    // Check Editor workspace header
    await page.goto("/editor");
    await page.waitForSelector("text=ResumeForge", { timeout: 10000 });
    await expect(page.locator("header a[href^='/tracker']").first()).toBeVisible();

    // Check Library workspace header
    await page.goto("/library");
    await page.waitForSelector("text=Verified Evidence Bank", { timeout: 10000 });
    await expect(page.locator("header a[href^='/tracker']").first()).toBeVisible();

    // Check Tailor workspace header
    await page.goto("/tailor");
    await page.waitForSelector("text=Target Job Posting", { timeout: 10000 });
    await expect(page.locator("header a[href^='/tracker']").first()).toBeVisible();

    // Check Settings workspace header
    await page.goto("/settings");
    await page.waitForSelector("text=AI Provider Gateway Settings", { timeout: 10000 });
    await expect(page.locator("header a[href^='/tracker']").first()).toBeVisible();
  });

  test("3. UI-09: Deleting a tracked job uses controlled ConfirmDialog focusing Cancel first with zero native confirm()", async ({
    page,
    request,
  }) => {
    let nativeDialogs = 0;
    page.on("dialog", async (dialog) => {
      nativeDialogs += 1;
      await dialog.dismiss();
    });

    const createRes = await request.post("/api/jobs", {
      data: {
        company: "Delete Confirm Corp",
        roleTitle: "QA Confirmation Engineer",
        rawDescription: "TypeScript, Playwright",
        source: "pasted",
        personal: true,
      },
    });
    expect(createRes.ok()).toBeTruthy();
    const { data } = await createRes.json();
    const jobId = data.id as string;

    await page.goto("/tracker");
    const card = page.locator(`[data-testid='tracker-job-card-${jobId}']`);
    await expect(card).toBeVisible({ timeout: 15000 });

    await card.getByRole("button", { name: "More actions" }).click();
    await card.locator(`[data-testid='delete-job-btn-${jobId}']`).click();

    const confirmModal = page.locator("[data-testid='delete-job-confirm-modal']");
    await expect(confirmModal).toBeVisible();
    await expect(confirmModal).toContainText("QA Confirmation Engineer at Delete Confirm Corp");
    await expect(page.locator("[data-testid='cancel-delete-job-btn']")).toBeFocused();

    // Cancel keeps the job in place
    await page.keyboard.press("Escape");
    await expect(confirmModal).toBeHidden();
    await expect(card).toBeVisible();

    // Failed DELETE keeps row intact, closes confirm dialog after response, and surfaces error notice
    let failNextDelete = true;
    await page.route(`**/api/jobs/${jobId}`, async (route) => {
      if (route.request().method() === "DELETE" && failNextDelete) {
        failNextDelete = false;
        await route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({ success: false, error: "Dependent history blocks delete." }),
        });
        return;
      }
      await route.continue();
    });
    await card.getByRole("button", { name: "More actions" }).click();
    await card.locator(`[data-testid='delete-job-btn-${jobId}']`).click();
    await expect(confirmModal).toBeVisible();
    await page.click("[data-testid='confirm-delete-job-btn']");
    await expect(confirmModal).toBeHidden();
    await expect(card).toBeVisible();
    await expect(page.getByText("Dependent history blocks delete.").first()).toBeVisible();

    // Confirm removes the job cleanly and restores focus inside tracker list (never document.body)
    await card.getByRole("button", { name: "More actions" }).click();
    await card.locator(`[data-testid='delete-job-btn-${jobId}']`).click();
    await expect(confirmModal).toBeVisible();
    const delPromise = page.waitForResponse(
      (resp) => resp.url().includes(`/api/jobs/${jobId}`) && resp.request().method() === "DELETE"
    );
    await page.click("[data-testid='confirm-delete-job-btn']");
    await delPromise;
    await expect(confirmModal).toBeHidden();
    await expect(card).toBeHidden();
    await expect.poll(async () => {
      return await page.evaluate(() => document.activeElement?.tagName ?? "BODY");
    }).not.toBe("BODY");

    expect(nativeDialogs).toBe(0);
  });
});
