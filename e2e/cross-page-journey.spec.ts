import { test, expect } from "@playwright/test";

test.describe("Cross-Page Multi-Workspace E2E Journey Tests (Task B2)", () => {
  test("Complete journey: Editor Master Save -> Tailor JD -> Create Variant -> Open Variant in Editor -> Verify Library", async ({
    page,
    request,
  }) => {
    // Step 1: Open /editor, verify canonical master/fallback document loading, save master resume
    await page.goto("/editor");
    await page.waitForSelector("[data-testid='document-type-badge']", { timeout: 10000 });
    // Wait for document initialization to complete
    await page.waitForTimeout(1000);

    await page.click("button:has-text('Save as Master Resume')");
    await page.waitForSelector("text=Saved as Master!", { timeout: 15000 });
    await expect(page.locator("[data-testid='doc-badge-master']")).toBeVisible();

    // Step 2: Navigate to /tailor, extract requirements and save job
    await page.goto("/tailor");
    await page.waitForSelector("[data-testid='jd-textarea']", { timeout: 10000 });

    await page.click("[data-testid='sample-backend-btn']");
    await page.click("[data-testid='extract-reqs-btn']");
    await page.waitForSelector("[data-testid='req-skill-PostgreSQL']", { timeout: 5000 });

    await page.click("[data-testid='save-job-btn']");
    await page.waitForSelector("[data-testid='ats-score-panel']", { timeout: 5000 });

    // Step 3: Create a variant in DB via API to simulate patch application completion
    const resumesRes = await request.get("/api/resumes");
    const resumesJson = await resumesRes.json();
    const master = resumesJson.data.find((r: { isMaster: boolean }) => r.isMaster) || resumesJson.data[0];

    const jobsRes = await request.get("/api/jobs");
    const jobsJson = await jobsRes.json();
    const job = jobsJson.data[0];

    const applyRes = await request.post("/api/ai/apply-patches", {
      data: {
        masterResumeId: master.id,
        jobId: job.id,
        variantTitle: "E2E Cross-Page Tailored Variant",
        mergedTypstContent: `#let resume-section(title) = [ === #title ]\n#resume-section("Experience")\n*Senior E2E Developer* (2026)\n- Engineered cross-page multi-workspace state integration.\n`,
      },
    });

    const applyJson = await applyRes.json();
    expect(applyRes.status()).toBe(200);
    expect(applyJson.success).toBe(true);
    const createdVariantId = applyJson.data.variantId;

    // Step 4: Direct navigation to /editor with ?variantId= parameter
    await page.goto(`/editor?variantId=${createdVariantId}`);
    await page.waitForSelector("[data-testid='document-type-badge']", { timeout: 10000 });

    // Step 5: Verify /editor loads variant content, displays variant document badge, and compiles preview
    await expect(page.locator("[data-testid='doc-badge-variant']")).toBeVisible();
    const badgeText = await page.locator("[data-testid='doc-badge-variant']").textContent();
    expect(badgeText).toContain("Tailored Variant");

    // Verify preview compiled without error
    await page.waitForSelector("svg", { timeout: 10000 });

    // Step 6: Navigate to /library, verify Evidence Bank workspace loads cleanly
    await page.goto("/library");
    await page.waitForSelector("button:has-text('Add Evidence Item')", { timeout: 10000 });
  });

  test("Invalid variant ID in /editor URL shows recoverable error state", async ({ page }) => {
    await page.goto("/editor?variantId=invalid-variant-uuid-9999");
    await page.waitForSelector("[data-testid='editor-error-state']", { timeout: 10000 });

    const errorText = await page.locator("[data-testid='editor-error-state']").textContent();
    expect(errorText).toContain("ResumeVariant not found");
  });
});
