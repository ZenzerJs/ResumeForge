import { test, expect } from "@playwright/test";

test.describe("Phase 4.3 ATS Quality Score Panel E2E Tests", () => {
  test("1. Tailor Page -> Extract Requirements -> Render ATS Score Panel -> Switch Role Profiles", async ({
    page,
  }) => {
    await page.goto("/tailor");
    await page.waitForSelector("[data-testid='jd-textarea']", { timeout: 10000 });

    // 1. Fill sample JD
    await page.click("[data-testid='sample-backend-btn']");

    // 2. Extract requirements
    await page.click("[data-testid='extract-reqs-btn']");

    // 3. Verify requirements extracted
    await page.waitForSelector("[data-testid='req-skill-PostgreSQL']", { timeout: 5000 });

    // 4. Verify ATS Score Panel renders
    await page.waitForSelector("[data-testid='ats-score-panel']", { timeout: 5000 });
    await page.waitForSelector("[data-testid='overall-score-badge']", { timeout: 5000 });
    await page.waitForSelector("[data-testid='category-breakdown-grid']", { timeout: 5000 });

    // 5. Test Role Profile Selector switching
    await page.waitForSelector("[data-testid='role-profile-selector']", { timeout: 5000 });
    await page.click("[data-testid='profile-btn-Frontend']");

    // Verify profile switch updates UI
    await page.waitForSelector("text=Role-Relevant Evidence (Frontend)", { timeout: 5000 });

    await page.click("[data-testid='profile-btn-AI/LLM']");
    await page.waitForSelector("text=Role-Relevant Evidence (AI/LLM)", { timeout: 5000 });

    await page.click("[data-testid='profile-btn-Backend']");
    await page.waitForSelector("text=Role-Relevant Evidence (Backend)", { timeout: 5000 });
  });

  test("2. Rejection Path: POST /api/ats/evaluate returns 400 on empty / invalid payload", async ({
    request,
  }) => {
    // Empty payload
    const res1 = await request.post("/api/ats/evaluate", {
      data: {},
    });
    expect(res1.status()).toBe(400);

    const json1 = await res1.json();
    expect(json1.success).toBe(false);
    expect(json1.error).toContain("Missing typstContent");

    // Invalid roleProfile payload
    const res2 = await request.post("/api/ats/evaluate", {
      data: {
        typstContent: "some content",
        roleProfile: "INVALID_PROFILE_OVERLAY",
      },
    });
    expect(res2.status()).toBe(400);

    const json2 = await res2.json();
    expect(json2.success).toBe(false);
    expect(json2.error).toContain("Invalid input");
  });
});
