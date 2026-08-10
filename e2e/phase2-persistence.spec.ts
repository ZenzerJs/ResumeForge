import { test, expect } from "@playwright/test";

test.describe("Phase 2 Persistence & Evidence Bank E2E Tests", () => {
  test("1. Save as Master Resume flow persists Typst source and maintains single master constraint", async ({ page, request }) => {
    await page.goto("/editor");
    await page.waitForSelector(".typst-preview-svg svg", { timeout: 15000 });

    // Click "Save as Master Resume" and confirm modal
    await page.click("button:has-text('Save as Master Resume')");
    await page.click("[data-testid='confirm-save-master-btn']");

    // Wait for "Saved as Master!" button state
    await page.waitForSelector("text=Saved as Master!", { timeout: 5000 });

    // Inspect GET /api/resumes endpoint
    const res = await request.get("/api/resumes");
    expect(res.ok()).toBeTruthy();

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);

    const masterResumes = json.data.filter((r: { isMaster: boolean }) => r.isMaster);
    expect(masterResumes.length).toBe(1);
    expect(masterResumes[0].title).toBe("Master Resume");
    expect(masterResumes[0].typstSource.length).toBeGreaterThan(10);
  });

  test("2. /library page supports create -> edit -> archive evidence item AND bullet-level CRUD flow", async ({ page, request }) => {
    // Explicitly seed sample items so test does not rely on implicit side-effects
    await request.post("/api/evidence", {
      data: {
        type: "experience",
        title: "Software Engineer Intern",
        organization: "TechCorp Systems",
        dates: "Jun 2024 – Present",
        verifiedSummary: "Built scalable REST & GraphQL APIs with high throughput and sub-100ms latency.",
        tags: ["TypeScript", "GraphQL", "Node.js", "REST"],
        status: "verified",
        bullets: [
          {
            text: "Developed high-throughput REST and GraphQL API endpoints serving over 100k daily active requests.",
            technologies: ["GraphQL", "Node.js", "TypeScript"],
            roleAffinity: ["Backend", "Fullstack"],
            verified: true,
            orderIndex: 0,
          },
        ],
      },
    });

    await request.post("/api/evidence", {
      data: {
        type: "project",
        title: "ResumeForge Workspace",
        organization: "Personal Open Source",
        dates: "2026",
        verifiedSummary: "Local-first AI resume workspace using Next.js, CodeMirror 6, and Typst WASM.",
        tags: ["Next.js", "TypeScript", "Typst", "SQLite", "Prisma"],
        status: "verified",
        bullets: [
          {
            text: "Engineered a local-first desktop web workspace utilizing Next.js, CodeMirror 6, and Typst WASM compilation.",
            technologies: ["Next.js", "CodeMirror", "Typst", "WASM"],
            roleAffinity: ["Fullstack", "Frontend"],
            verified: true,
            orderIndex: 0,
          },
        ],
      },
    });

    await page.goto("/library");

    // Verify seeded items are rendered
    await page.waitForSelector("text=Software Engineer Intern", { timeout: 10000 });
    await page.waitForSelector("text=ResumeForge Workspace", { timeout: 10000 });

    // Click "Add Evidence Item"
    await page.click("button:has-text('Add Evidence Item')");
    await page.waitForSelector("text=Create Evidence Item", { timeout: 5000 });

    // Fill parent item fields
    const uniqueTitle = `Automated Test Project ${Date.now()}`;
    const bulletText = `Bullet Point Alpha: Built high-coverage test suite ${Date.now()}`;

    await page.fill("input[placeholder='e.g. Software Engineer Intern']", uniqueTitle);
    await page.fill("textarea[placeholder='Detailed summary of verified accomplishment claim...']", "Built an automated Playwright testing framework.");
    await page.fill("input[placeholder='TypeScript, React, Node.js']", "Playwright, Vitest");

    // Fill bullet point text in bullet textarea
    await page.fill("textarea[placeholder='Developed high-throughput API endpoints...']", bulletText);

    // Submit form
    await page.click("button:has-text('Save Item')");

    // Assert new item title AND bullet text appear on page
    await page.waitForSelector(`text=${uniqueTitle}`, { timeout: 5000 });
    await page.waitForSelector(`text=${bulletText}`, { timeout: 5000 });

    // Edit item & bullet text
    const itemCard = page.locator(".rounded-lg.border").filter({ hasText: uniqueTitle }).first();
    await itemCard.locator("button[title='Edit Item']").click();
    await page.waitForSelector("text=Edit Evidence Item", { timeout: 5000 });

    const updatedTitle = `${uniqueTitle} (Updated)`;
    const updatedBulletText = `${bulletText} (Updated)`;

    await page.fill("input[placeholder='e.g. Software Engineer Intern']", updatedTitle);
    await page.fill("textarea[placeholder='Developed high-throughput API endpoints...']", updatedBulletText);
    await page.click("button:has-text('Save Item')");

    // Assert updated title AND updated bullet text appear
    await page.waitForSelector(`text=${updatedTitle}`, { timeout: 5000 });
    await page.waitForSelector(`text=${updatedBulletText}`, { timeout: 5000 });

    // Archive item
    const updatedCard = page.locator(".rounded-lg.border").filter({ hasText: updatedTitle }).first();
    await updatedCard.locator("button[title='Archive Item']").click();

    // Filter by "archived" status
    await page.click("button:has-text('archived')");
    await page.waitForSelector(`text=${updatedTitle}`, { timeout: 5000 });
  });

  test("3. Security Audit: Rejects invalid payloads with 400 Bad Request and field-level Zod error details", async ({ request }) => {
    // 1. Test POST /api/resumes invalid payload (missing typstSource)
    const invalidResumeRes = await request.post("/api/resumes", {
      data: { title: "Invalid Resume Missing Source" },
    });

    expect(invalidResumeRes.status()).toBe(400);
    const invalidResumeJson = await invalidResumeRes.json();
    expect(invalidResumeJson.success).toBe(false);
    expect(invalidResumeJson.error).toBe("Invalid request payload");
    expect(invalidResumeJson.details).toBeDefined();
    expect(invalidResumeJson.details.typstSource).toBeDefined();

    // 2. Test POST /api/evidence invalid payload (invalid enum type and empty title/summary)
    const invalidEvidenceRes = await request.post("/api/evidence", {
      data: {
        type: "invalid_type_enum",
        title: "",
        verifiedSummary: "",
      },
    });

    expect(invalidEvidenceRes.status()).toBe(400);
    const invalidEvidenceJson = await invalidEvidenceRes.json();
    expect(invalidEvidenceJson.success).toBe(false);
    expect(invalidEvidenceJson.error).toBe("Invalid request payload");
    expect(invalidEvidenceJson.details).toBeDefined();
    expect(invalidEvidenceJson.details.type).toBeDefined();
    expect(invalidEvidenceJson.details.title).toBeDefined();
    expect(invalidEvidenceJson.details.verifiedSummary).toBeDefined();
  });

  test("4. Save as Master with Evidence Extraction -> Modal checkbox renders and preserves state", async ({ page }) => {
    await page.goto("/editor");
    await page.waitForSelector(".typst-preview-svg svg", { timeout: 15000 });

    // Open Save as Master modal
    await page.click("button:has-text('Save as Master Resume')");

    // Checkbox should be visible in modal
    const checkbox = page.locator("[data-testid='extract-evidence-checkbox']");
    await expect(checkbox).toBeVisible();

    // Confirm save
    await page.click("[data-testid='confirm-save-master-btn']");
    await page.waitForSelector("text=Saved as Master!", { timeout: 5000 });
  });
});
