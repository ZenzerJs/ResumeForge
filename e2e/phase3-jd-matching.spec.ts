import { test, expect } from "@playwright/test";

test.describe("Phase 3 Job Description Parser & Evidence Matcher E2E Tests", () => {
  test("1. Paste JD -> Extract Requirements -> Remove Term -> View Ranked Matches -> Save Job", async ({
    page,
    request,
  }) => {
    await page.goto("/tailor");
    await page.waitForSelector("[data-testid='jd-textarea']", { timeout: 10000 });

    // 1. Click Sample Backend Posting button
    await page.click("[data-testid='sample-backend-btn']");

    // 2. Click Extract Requirements button
    await page.click("[data-testid='extract-reqs-btn']");

    // 3. Verify extracted skills appear
    await page.waitForSelector("[data-testid='req-skill-Python']", { timeout: 5000 });
    await page.waitForSelector("[data-testid='req-skill-PostgreSQL']", { timeout: 5000 });

    // 4. Verify ranked evidence matches appear with matched requirement badges
    await page.waitForSelector("[data-testid='matched-req-badge']", { timeout: 5000 });

    // 5. Test User Correction: Remove a term (e.g., Python)
    await page.click("[data-testid='remove-term-Python']");
    await expect(page.locator("[data-testid='req-skill-Python']")).not.toBeVisible();

    // 6. Click Save Job button
    await page.click("[data-testid='save-job-btn']");
    await page.waitForSelector("text=Job posting saved successfully!", { timeout: 5000 });

    // 7. Verify persistence via API
    const jobsRes = await request.get("/api/jobs");
    expect(jobsRes.ok()).toBeTruthy();

    const jobsJson = await jobsRes.json();
    expect(jobsJson.success).toBe(true);
    expect(jobsJson.data.length).toBeGreaterThan(0);

    const savedJob = jobsJson.data[0];
    expect(savedJob.rawDescription).toBeUndefined();
    const detailRes = await request.get(`/api/jobs/${savedJob.id}`);
    const detailJson = await detailRes.json();
    expect(detailJson.data.rawDescription).toContain("Senior Backend Engineer");
    expect(savedJob.extractedRequirements.requiredSkills).not.toContain("Python");
    expect(savedJob.extractedRequirements.requiredSkills).toContain("PostgreSQL");
  });

  test("2. Rejection Path: Malformed/Empty JD submission returns 400 Bad Request with Zod validation details", async ({
    request,
  }) => {
    // Test POST /api/jobs/extract with empty rawDescription
    const extractRes = await request.post("/api/jobs/extract", {
      data: { rawDescription: "" },
    });
    expect(extractRes.status()).toBe(400);

    const extractJson = await extractRes.json();
    expect(extractJson.success).toBe(false);
    expect(extractJson.error).toBe("Invalid request payload");
    expect(extractJson.details.rawDescription).toBeDefined();

    // Test POST /api/jobs with invalid payload
    const jobRes = await request.post("/api/jobs", {
      data: { company: "Acme Corp", rawDescription: "" },
    });
    expect(jobRes.status()).toBe(400);

    const jobJson = await jobRes.json();
    expect(jobJson.success).toBe(false);
    expect(jobJson.error).toBe("Invalid request payload");
    expect(jobJson.details.rawDescription).toBeDefined();
  });

  test("3. Frontend-Leaning Posting: Extract Requirements -> Verify React, Next.js, TypeScript -> Save Job", async ({
    page,
    request,
  }) => {
    await page.goto("/tailor");
    await page.waitForSelector("[data-testid='jd-textarea']", { timeout: 10000 });

    // 1. Click Sample Frontend Posting button
    await page.click("[data-testid='sample-frontend-btn']");

    // 2. Click Extract Requirements button
    await page.click("[data-testid='extract-reqs-btn']");

    // 3. Verify extracted frontend skills appear
    await page.waitForSelector("[data-testid='req-skill-TypeScript']", { timeout: 5000 });
    await page.waitForSelector("[data-testid='req-skill-React']", { timeout: 5000 });
    await page.waitForSelector("[data-testid='req-skill-Next.js']", { timeout: 5000 });

    // 4. Save Job
    await page.click("[data-testid='save-job-btn']");
    await page.waitForSelector("text=Job posting saved successfully!", { timeout: 5000 });

    // 5. Verify API persistence
    const jobsRes = await request.get("/api/jobs");
    const jobsJson = await jobsRes.json();
    expect(jobsJson.success).toBe(true);

    const savedJob = jobsJson.data.find((j: { id: string; roleTitle?: string }) =>
      (j.roleTitle || "").includes("Frontend")
    );
    expect(savedJob).toBeDefined();
    const detailRes = await request.get(`/api/jobs/${savedJob.id}`);
    const detailJson = await detailRes.json();
    expect(detailJson.data.rawDescription).toContain("Frontend Engineer");
    expect(savedJob.extractedRequirements.requiredSkills).toContain("TypeScript");
    expect(savedJob.extractedRequirements.requiredSkills).toContain("React");
  });
});
