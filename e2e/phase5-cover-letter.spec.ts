import { test, expect } from "@playwright/test";

test.describe("Phase 5 Tailored Cover Letter Generator E2E Tests", () => {
  test("1. Tailor Page -> Extract Reqs -> Save Job -> Render Cover Letter Panel -> Generate & Save Cover Letter", async ({
    page,
    request,
  }) => {
    // Mock POST /api/ai/generate-cover-letter to return valid evidence-grounded cover letter
    await page.route("/api/ai/generate-cover-letter", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            title: "Cover Letter — Acme Backend Developer",
            salutation: "Dear Acme Hiring Team,",
            openingParagraph: "I am writing to express my enthusiasm for the Backend Developer position at Acme Corp.",
            bodyParagraphs: [
              "Engineered scalable microservices architecture using Node.js, TypeScript, and PostgreSQL.",
              "Optimized SQL queries achieving a 45% reduction in latency across core API routes.",
            ],
            closingParagraph: "Thank you for your time and consideration. I look forward to discussing my qualifications.",
            fullMarkdown: "# Cover Letter\n\nDear Acme Hiring Team,\n\nI am writing to express my enthusiasm...",
            evidenceCitations: ["exp-1", "bullet-101"],
            gapsAddressed: [],
          },
        }),
      });
    });

    // Navigate to /tailor
    await page.goto("/tailor");
    await page.waitForSelector("[data-testid='jd-textarea']", { timeout: 10000 });

    // Fill sample backend JD and extract requirements
    await page.click("[data-testid='sample-backend-btn']");
    await page.click("[data-testid='extract-reqs-btn']");
    await page.waitForSelector("[data-testid='req-skill-PostgreSQL']", { timeout: 5000 });

    // Save Job
    await page.click("[data-testid='save-job-btn']");
    await page.waitForSelector("[data-testid='cover-letter-panel']", { timeout: 10000 });

    // Verify "Generate Tailored Cover Letter" button is present and clickable
    await expect(page.locator("[data-testid='generate-cover-letter-btn']")).toBeVisible();

    // Click "Generate Tailored Cover Letter"
    await page.click("[data-testid='generate-cover-letter-btn']");

    // Wait for cover letter workspace rendering
    await page.waitForSelector("[data-testid='cover-letter-workspace']", { timeout: 10000 });

    // Verify Evidence Citation Badges are rendered
    await expect(page.locator("[data-testid='evidence-citation-badge']").first()).toBeVisible();

    // Switch view format to Plain Text
    await page.click("[data-testid='format-text-btn']");

    // Click Copy to Clipboard
    await page.click("[data-testid='copy-cover-letter-btn']");
    await page.waitForSelector("text=Copied!", { timeout: 5000 });

    // Click Save Cover Letter
    await page.click("[data-testid='save-cover-letter-btn']");
    await page.waitForSelector("text=Saved to Database!", { timeout: 5000 });

    // Verify saved cover letter record in SQLite via API
    const coverLettersRes = await request.get("/api/cover-letters");
    expect(coverLettersRes.ok()).toBeTruthy();
    const json = await coverLettersRes.json();

    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.data.length).toBeGreaterThan(0);
    expect(json.data[0].bodyParagraphs.length).toBeGreaterThan(0);
  });

  test("2. Rejection Path: POST /api/ai/generate-cover-letter returns 400 on empty / invalid payload", async ({ request }) => {
    const res = await request.post("/api/ai/generate-cover-letter", {
      data: { invalidField: true },
    });

    expect(res.status()).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toBe("Invalid input payload for cover letter generation.");
  });
});
